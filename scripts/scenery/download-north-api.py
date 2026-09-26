"""Cache the missing Tehran northern strip via the official OSM API fallback.

Preserves exact XML responses, completes relevant polygon relations, then emits
an Overpass-shaped offline intermediate for the existing importer. No old cache
is changed. Run with --tehran, followed by download-scenery.py --tehran to merge.
"""
import datetime
import gzip
import hashlib
import json
import subprocess
import time
import xml.etree.ElementTree as ET
from scenery_regions import CACHE, REGION, BOUNDS

assert REGION == 'tehran'
output = CACHE / 'extension-north-official.json.gz'
if output.exists():
    print('Reuse', output)
    raise SystemExit(0)
records = {}
sources = []

def fetch(name, url):
    path = CACHE / (name + '.osm.gz')
    if path.exists():
        content = gzip.decompress(path.read_bytes())
    else:
        print('Fetch', name, flush=True)
        content = subprocess.check_output(['curl', '-sS', '--fail', '--max-time', '90',
            '-A', 'Open-Skies-scenery/1.0', url])
        root = ET.fromstring(content)
        assert root.tag == 'osm', 'Not an OSM response'
        path.write_bytes(gzip.compress(content, mtime=0))
        time.sleep(1)
    sources.append(dict(file=path.name, url=url, sha256=hashlib.sha256(content).hexdigest()))
    for e in ET.fromstring(content):
        if e.tag in ('node','way','relation'):
            records[e.tag,int(e.attrib['id'])] = e

# Small, adjacent ~5 km wide cells avoid the API's node-count limit.
for col in range(12):
    west = round(BOUNDS[1]+(BOUNDS[3]-BOUNDS[1])*col/12,6)
    east = round(BOUNDS[1]+(BOUNDS[3]-BOUNDS[1])*(col+1)/12,6)
    fetch(f'north-api-{col:02}',f'https://api.openstreetmap.org/api/0.6/map?bbox={west},35.82,{east},{BOUNDS[2]}')

def tags(e):
    return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}

def useful(e):
    t=tags(e)
    return any(k in t for k in ('building','landuse','natural','aeroway','leisure')) and t.get('type') in ('multipolygon','boundary')

# /map includes touching relations but not necessarily all their members.
for (kind, ident), e in list(records.items()):
    if kind == 'relation' and useful(e):
        fetch(f'north-api-relation-{ident}',f'https://api.openstreetmap.org/api/0.6/relation/{ident}/full')

def geometry(way):
    result=[]
    for nd in way.findall('nd'):
        node=records.get(('node',int(nd.attrib['ref'])))
        if node is None:
            raise ValueError('Incomplete way '+way.attrib['id'])
        result.append(dict(lat=float(node.attrib['lat']),lon=float(node.attrib['lon'])))
    return result

elements=[]
for (kind,ident),e in records.items():
    t=tags(e)
    if kind=='node' and 'place' not in t: continue
    if kind=='relation' and not useful(e): continue
    if kind=='way' and not any(k in t for k in ('building','landuse','natural','aeroway','leisure','highway','railway','waterway')): continue
    item=dict(type=kind,id=ident,tags=t)
    if kind=='node': item.update(lat=float(e.attrib['lat']),lon=float(e.attrib['lon']))
    elif kind=='way': item['geometry']=geometry(e)
    else:
        members=[]
        for m in e.findall('member'):
            if m.attrib['type']!='way': continue
            way=records.get(('way',int(m.attrib['ref'])))
            if way is None: raise ValueError('Incomplete relation '+str(ident))
            members.append(dict(type='way',ref=int(m.attrib['ref']),role=m.attrib.get('role',''),geometry=geometry(way)))
        item['members']=members
    elements.append(item)
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
data=dict(osm3s=dict(timestamp_osm_base=stamp),elements=elements,
    provenance=dict(source='OpenStreetMap API 0.6',license='ODbL-1.0',
        note='Normalized from preserved official API XML; timestamp is assembly time, not a single Overpass snapshot.',sources=sources))
output.write_bytes(gzip.compress(json.dumps(data).encode(),mtime=0))
print('Cached complete northern strip:',len(elements),'features/places;',len(sources),'preserved source responses')
