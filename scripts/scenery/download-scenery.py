"""Download missing OSM layers once; preserve sources in data/<region>/cache/*.json.gz.
Run from repository root. Existing layers are never fetched again. A complete
cache can be merged offline into data/<region>/cache/osm.json.gz for import-osm.py.
"""
import os
import gzip
import hashlib
import json
import subprocess
import time

from scenery_regions import CACHE, BOUNDS, REGION
cache = CACHE
cache.mkdir(parents=True, exist_ok=True)
# The initial Tehran layer identities keep their original footprint forever.
# Added east/west strips have distinct identities and do not redownload the core.
core_bounds = [35.53, 51.23, 35.82, 51.58] if REGION == 'tehran' else BOUNDS
bbox = '(' + ','.join(map(str, core_bounds)) + ')'
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

if REGION == 'tehran':
    del layers['palace']
    del layers['buildings']
    south, west, north, east = core_bounds
    # Small repeatable queries; preserve every successful response for offline reuse.
    for row in range(4):
        for col in range(4):
            s, n = [round(south + (north-south)*i/4, 6) for i in (row, row+1)]
            w, e = [round(west + (east-west)*i/4, 6) for i in (col, col+1)]
            layers[f'buildings-{row}-{col}'] = f'way[building]({s},{w},{n},{e});'
    layers['dry-land'] = f'(way[natural~"^(sand|bare_rock|scree|scrub|heath)$"]{bbox};relation[natural~"^(sand|bare_rock|scree|scrub|heath)$"]{bbox};);'
    layers['airfield-relations'] = f'relation[aeroway]{bbox};'
    for side, w, e in [('west', BOUNDS[1], west), ('east', east, BOUNDS[3])]:
        strip = f'({south},{w},{north},{e})'
        layers[f'extension-{side}-airfield-places'] = f'(way[aeroway]{strip};node[place]{strip};);'
        layers[f'extension-{side}-land'] = f'(way[landuse]{strip};way[natural~"^(water|wood|sand|bare_rock|scree|scrub|heath)$"]{strip};way[leisure~"^(park|garden)$"]{strip};);'
        layers[f'extension-{side}-relations'] = f'(relation[building]{strip};relation[landuse=forest]{strip};relation[natural~"^(water|wood|sand|bare_rock|scree|scrub|heath)$"]{strip};relation[aeroway]{strip};);'
        for row in range(4):
            s,n = [round(south+(north-south)*i/4,6) for i in (row,row+1)]
            cell = f'({s},{w},{n},{e})'
            layers[f'extension-{side}-buildings-{row}'] = f'way[building]{cell};'
            layers[f'extension-{side}-roads-{row}'] = f'(way[highway]{cell};way[railway=rail]{cell};way[waterway]{cell};);'
    # A separate northern strip preserves all 56 existing response identities.
    # Latitude limits on the original core and east/west strips stay fixed.
    strip = f'({north},{BOUNDS[1]},{BOUNDS[2]},{BOUNDS[3]})'
    layers['extension-north-places'] = f'(node[place]{strip};way[aeroway]{strip};);'
    layers['extension-north-buildings'] = f'way[building]{strip};'
    layers['extension-north-roads'] = f'(way[highway]{strip};way[railway=rail]{strip};way[waterway]{strip};);'
    layers['extension-north-land'] = f'(way[landuse]{strip};way[natural~"^(water|wood|sand|bare_rock|scree|scrub|heath)$"]{strip};way[leisure~"^(park|garden)$"]{strip};);'
    layers['extension-north-relations'] = f'(relation[building]{strip};relation[landuse]{strip};relation[natural~"^(water|wood|sand|bare_rock|scree|scrub|heath)$"]{strip};relation[leisure~"^(park|garden)$"]{strip};relation[aeroway]{strip};);'
    if (cache / 'extension-north-official.json.gz').exists():
        for suffix in ('buildings','roads','land','relations'):
            del layers['extension-north-'+suffix]
        layers['extension-north-official'] = 'Official OSM API northern strip; see preserved provenance.sources URLs.'

missing = []
selected = set(filter(None, os.environ.get('SCENERY_LAYERS', '').split(',')))
if selected - layers.keys():
    raise SystemExit('Unknown scenery layers: ' + ', '.join(sorted(selected - layers.keys())))
for name, body in layers.items():
    if selected and name not in selected:
        continue
    path = cache / f'{name}.json.gz'
    plain = cache / f'{name}.json'
    if path.exists():
        print('Reuse', path, flush=True)
        continue
    if plain.exists():
        content = plain.read_bytes()
    else:
        timeout = 25 if REGION == 'tehran' else 90
        query = f'[out:json][timeout:{timeout}];' + body + 'out geom qt;'
        print('Fetch', name, flush=True)
        try:
            content = subprocess.check_output([
                'curl', '-A', '3d-plane-scenery/1.0 (github.com/sinataghva/3d-plane)',
                '-sS', '--fail', '--max-time', '120',
                *(['--get'] if os.environ.get('OVERPASS_GET') == '1' else []),
                '--data-urlencode', 'data=' + query, endpoint])
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
        time.sleep(10 if REGION == 'tehran' else 5)
    json.loads(content)  # Never cache an error/partial response.
    path.write_bytes(gzip.compress(content, mtime=0))
    if plain.exists():
        plain.unlink()  # Exact response retained in lossless gzip cache.
if missing:
    raise SystemExit('Re-run to fetch only missing layers: ' + ', '.join(missing))
uncached = [name for name in layers if not (cache / f'{name}.json.gz').exists()]
if uncached:
    raise SystemExit('Selected layers cached; full merge still needs: ' + ', '.join(uncached))

elements, stamps, manifest = {}, [], []
for name, body in layers.items():
    path = cache / f'{name}.json.gz'
    content = gzip.decompress(path.read_bytes())
    data = json.loads(content)
    stamp = data['osm3s']['timestamp_osm_base']
    stamps.append(stamp)
    manifest.append(dict(file=path.name, sha256=hashlib.sha256(content).hexdigest(),
                         snapshot=stamp, elements=len(data['elements']), query=body))
    if 'provenance' in data:
        manifest[-1]['provenance'] = data['provenance']
    for element in data['elements']:
        elements[element['type'], element['id']] = element
merged = json.dumps({'osm3s': {'timestamp_osm_base': min(stamps)},
                     'elements': list(elements.values())}).encode()
(cache / 'osm.json.gz').write_bytes(gzip.compress(merged, mtime=0))
(cache / 'manifest.json').write_text(json.dumps(manifest, indent=2))
print('Merged', len(elements), 'unique elements; source cache preserved')
