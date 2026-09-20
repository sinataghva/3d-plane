"""Download missing OSM layers once; preserve sources in data/saint-cyr/cache/*.json.gz.
Run from repository root. Existing layers are never fetched again. A complete
cache can be merged offline into data/saint-cyr/cache/osm.json.gz for import-osm.py.
"""
import os
import gzip
import hashlib
import json
import pathlib
import subprocess
import time
import urllib.parse

from scenery_regions import CACHE, BOUNDS, REGION
cache = CACHE
cache.mkdir(parents=True, exist_ok=True)
bbox = '(' + ','.join(map(str, BOUNDS)) + ')'
endpoint = os.environ.get('OVERPASS_ENDPOINT', 'https://overpass-api.de/api/interpreter')
layers = {
    'palace': 'relation[wikidata=Q2946];',
    'airfield-places': f'(way[aeroway]{bbox};node[place]{bbox};);',
    'buildings': f'way[building]{bbox};',
    'roads': f'(way[highway]{bbox};way[railway=rail]{bbox};way[waterway]{bbox};);',
    'relations-water': f'rel[natural=water]{bbox};',
    'water': f'way[natural=water]{bbox};',
    'wood': f'way[natural=wood]{bbox};',
    'parks': f'(way[leisure=park]{bbox};way[leisure=garden]{bbox};);',
    **{f'relations-{key}': f'relation[{tag}]{bbox};' for key,tag in [('buildings','building'),('forest','landuse=forest'),('wood','natural=wood')]},
    **{f'land-{tag}': f'way[landuse={tag}]{bbox};' for tag in
       ['forest', 'farmland', 'meadow', 'grass', 'residential', 'industrial', 'commercial']}
}
if REGION == 'luxeuil':
    del layers['palace']
    # Bound dense geometry requests rather than repeatedly timing out one large layer.
    del layers['buildings']
    south, west, north, east = BOUNDS
    middle_lat, middle_lon = (south+north)/2, (west+east)/2
    for row, (s,n) in enumerate([(south,middle_lat),(middle_lat,north)]):
        for col, (w,e) in enumerate([(west,middle_lon),(middle_lon,east)]):
            if row == 1 and col == 0:
                mid = round((s+n)/2, 6)
                layers['buildings-1-0-south'] = f'way[building]({s},{w},{mid},{e});'
                layers['buildings-1-0-north'] = f'way[building]({mid},{w},{n},{e});'
            else:
                layers[f'buildings-{row}-{col}'] = f'way[building]({s},{w},{n},{e});'

missing = []
for name, body in layers.items():
    path = cache / f'{name}.json.gz'
    plain = cache / f'{name}.json'
    if path.exists():
        print('Reuse', path, flush=True)
        continue
    if plain.exists():
        content = plain.read_bytes()
    else:
        query = '[out:json][timeout:90];' + body + 'out geom qt;'
        url = endpoint + '?' + urllib.parse.urlencode({'data': query})
        print('Fetch', name, flush=True)
        try:
            content = subprocess.check_output([
                'curl', '-A', '3d-plane-scenery/1.0 (github.com/sinataghva/3d-plane)',
                '-sS', '--fail', '--max-time', '120', url])
            result = json.loads(content)
            if 'remark' in result:
                raise ValueError(result['remark'])
        except (subprocess.CalledProcessError, ValueError) as error:
            print('Layer unavailable:', name, error, flush=True)
            missing.append(name)
            # Back off public-service errors, including 429 and 406.
            time.sleep(30)
            continue
        print(name, len(result['elements']), 'elements', flush=True)
        time.sleep(5)
    json.loads(content)  # Never cache an error/partial response.
    path.write_bytes(gzip.compress(content, mtime=0))
    if plain.exists():
        plain.unlink()  # Exact response retained in lossless gzip cache.
if missing:
    raise SystemExit('Re-run to fetch only missing layers: ' + ', '.join(missing))

elements, stamps, manifest = {}, [], []
for name, body in layers.items():
    path = cache / f'{name}.json.gz'
    content = gzip.decompress(path.read_bytes())
    data = json.loads(content)
    stamp = data['osm3s']['timestamp_osm_base']
    stamps.append(stamp)
    manifest.append(dict(file=path.name, sha256=hashlib.sha256(content).hexdigest(),
                         snapshot=stamp, elements=len(data['elements']), query=body))
    for element in data['elements']:
        elements[element['type'], element['id']] = element
merged = json.dumps({'osm3s': {'timestamp_osm_base': min(stamps)},
                     'elements': list(elements.values())}).encode()
(cache / 'osm.json.gz').write_bytes(gzip.compress(merged, mtime=0))
(cache / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('Merged', len(elements), 'unique elements; source cache preserved')
