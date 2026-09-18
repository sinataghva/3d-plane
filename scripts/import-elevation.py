"""Fetch a bounded set of public Terrarium tiles, resample to a local DEM grid.
Requires Pillow. Run from repository root. Original tiles cached in data/cache/.
"""
import math, json, urllib.request, pathlib, io
from PIL import Image
south,west,north,east=48.775,2.015,48.845,2.155
zoom=12
cache=pathlib.Path('data/cache');cache.mkdir(exist_ok=True)
def tile(lon,lat):
    return ((lon+180)/360*2**zoom,(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*2**zoom)
a,b=tile(west,north);c,d=tile(east,south)
images={};sources=[]
for x in range(math.floor(a),math.floor(c)+1):
    for y in range(math.floor(b),math.floor(d)+1):
        url=f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{zoom}/{x}/{y}.png'
        path=cache/f'{x}-{y}.png'
        if not path.exists(): path.write_bytes(urllib.request.urlopen(url,timeout=45).read())
        images[x,y]=Image.open(path).convert('RGB');sources.append(url)
def height(lon,lat):
    x,y=tile(lon,lat);image=images[math.floor(x),math.floor(y)]
    r,g,b=image.getpixel((min(255,int(x%1*256)),min(255,int(y%1*256))))
    return round(r*256+g+b/256-32768,1)
size=129
values=[height(west+(east-west)*i/(size-1),north-(north-south)*j/(size-1)) for j in range(size) for i in range(size)]
assert all(-50 < x < 500 for x in values)
result=dict(size=size,bounds=[south,west,north,east],values=values,sources=sources,source='Mapzen Terrain Tiles / Tilezen (SRTM and other open elevation sources)',license='See terrain-attribution.md',retrieved='2026-09-18')
pathlib.Path('data/saint-cyr-elevation.json').write_text(json.dumps(result,separators=(',',':')))
print('DEM:',len(sources),'tiles;',size,'x',size,'grid;',min(values),'to',max(values),'m')
