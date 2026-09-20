"""Convert Overpass `out geom` data to a compact local, attributed feature set.
Usage: python3 scripts/import-osm.py /tmp/saint-cyr-osm.json
Coordinates are meters east/south from the local origin. No network requests.
"""
import json,math,sys,pathlib,gzip
from scenery_metadata import surface_metadata
from airfield_metadata import airfield_metadata
raw=json.load(gzip.open(sys.argv[1], 'rt') if sys.argv[1].endswith('.gz') else open(sys.argv[1])); assert 'remark' not in raw,raw.get('remark')
from scenery_regions import ORIGIN, BOUNDS, MAP_FILE
origin=ORIGIN; south,west,north,east=BOUNDS
mx=111320*math.cos(math.radians(origin[0])); my=111320
def project(g):return [round((g['lon']-origin[1])*mx,1),round((origin[0]-g['lat'])*my,1)]
def area(r):return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]+r[:1])))/2
# RDP simplification; preserve rings and narrow water/airfield shapes.
def simplify(p,tol):
    if len(p)<4:return p
    a,b=p[0],p[-1]; dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
    distances=[]
    for q in p[1:-1]:
        t=max(0,min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/den)) if den else 0
        distances.append(math.hypot(q[0]-a[0]-t*dx,q[1]-a[1]-t*dy))
    m=max(distances,default=0)
    if m<=tol:return [a,b]
    i=distances.index(m)+1
    return simplify(p[:i+1],tol)[:-1]+simplify(p[i:],tol)
def inside(p,poly):
    c=False
    for a,b in zip(poly,poly[1:]+poly[:1]):
        if (a[1]>p[1])!=(b[1]>p[1]) and p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:c=not c
    return c
def join(parts):
    rings=[]
    while parts:
        ring=parts.pop()
        while ring[0]!=ring[-1]:
            found=False
            for i,q in enumerate(parts):
                if ring[-1]==q[0]:ring+=q[1:]
                elif ring[-1]==q[-1]:ring+=q[-2::-1]
                elif ring[0]==q[-1]:ring=q[:-1]+ring
                elif ring[0]==q[0]:ring=q[:0:-1]+ring
                else:continue
                parts.pop(i);found=True;break
            if not found:break
        if len(ring)>3 and ring[0]==ring[-1]:rings.append(ring)
    return rings
def category(t):
    if t.get('aeroway') in ('hangar','shelter','tower'):return 'building'
    if t.get('aeroway')=='landing_light':return 'airfieldLight'
    if t.get('building') and t.get('building')!='no':return 'building'
    if t.get('aeroway')=='runway':return 'runway'
    if t.get('aeroway') in ('taxiway','apron'):return 'taxiway'
    if t.get('aeroway')=='aerodrome':return 'airfield'
    if t.get('natural')=='water':return 'water'
    if t.get('waterway'):return 'waterway'
    if t.get('natural')=='wood' or t.get('landuse')=='forest':return 'forest'
    if t.get('highway'):return 'road'
    if t.get('railway'):return 'rail'
    if t.get('landuse')=='farmland':return 'field'
    if t.get('landuse') in ('residential','industrial'):return 'urban'
    if t.get('landuse') or t.get('leisure'):return 'grass'
    return None
features=[];places=[];consumed=set()
for e in raw['elements']:
    if e['type']=='relation' and category(e.get('tags',{})):
        for m in e.get('members',[]):
            if m.get('type')=='way':consumed.add(m['ref'])
for e in raw['elements']:
    t=e.get('tags',{});kind=category(t)
    if e['type']=='node' and t.get('place'):
        places.append(dict(id=e['id'],name=t.get('name',''),kind=t['place'],point=project(e)));continue
    if not kind or e['type']=='node' or (e['type']=='way' and e['id'] in consumed):continue
    rings=[];holes=[];line=False
    if e['type']=='way':
        p=[project(g) for g in e.get('geometry',[]) if g]
        if len(p)<2:continue
        line=p[0]!=p[-1]
        if line and kind not in ('road','rail','waterway','runway','taxiway','airfieldLight'):continue
        rings=[p]
    else:
        outer=[];inner=[]
        for m in e.get('members',[]):
            p=[project(g) for g in m.get('geometry',[]) if g]
            if len(p)>1:(inner if m.get('role')=='inner' else outer).append(p)
        rings=join(outer);holes=join(inner)
    for ri,r in enumerate(rings):
        r=simplify(r,.2 if kind in ('rail','waterway') else 1 if kind in ('building','runway','water') else 3)
        if not line and (len(r)<4 or area(r)<(35 if kind=='building' else 12)):continue
        if max(p[0] for p in r)<(west-origin[1])*mx or min(p[0] for p in r)>(east-origin[1])*mx or max(p[1] for p in r)<(origin[0]-north)*my or min(p[1] for p in r)>(origin[0]-south)*my:continue
        def number(v,default):
            try:return float(str(v).split(';')[0].replace(' m',''))
            except:return default
        height=max(3,min(70,number(t.get('height'),number(t.get('building:levels'),2)*3+2)))
        width=number(t.get('width'),{'runway':50,'taxiway':12,'road':6,'waterway':4,'rail':3}.get(kind,0))
        name=t.get('name','')
        f=dict(id=f"{e['type'][0]}{e['id']}-{ri}",kind=kind,name=name,points=r,holes=[simplify(h,1) for h in holes if inside(h[0],r)],line=line)
        f.update(surface_metadata(t,kind))
        f.update(airfield_metadata(t))
        if kind=='building':f.update(height=height,roof=t.get('roof:shape',''),palace=('château de versailles' in name.lower() or t.get('wikidata')=='Q2946'))
        if line and 'width' not in f:f['width']=width
        if kind=='runway':f['ref']=t.get('ref','11/29')
        if kind=='road':f['class']=t.get('highway');f['width']={'motorway':16,'trunk':12,'primary':10,'secondary':8,'tertiary':7,'path':2,'footway':2,'track':3}.get(t.get('highway'),6)
        features.append(f)
result=dict(origin=origin,bounds=[south,west,north,east],features=features,places=places,source='© OpenStreetMap contributors',license='ODbL-1.0',sourceUrl='https://www.openstreetmap.org/copyright',timestamp=raw.get('osm3s',{}).get('timestamp_osm_base'),retrieved=__import__('datetime').date.today().isoformat())
out=MAP_FILE;out.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')))
from collections import Counter
print(Counter(f['kind'] for f in features));print('Places:',[(p['name'],p['point']) for p in places]);print('Runways:',[f for f in features if f['kind']=='runway']);print('Palace:',[f['name'] for f in features if f.get('palace')]);print(out.stat().st_size,'bytes')
