"""Restore surface metadata and line fidelity from local cached OSM. No network.
Run from the repository root: python3 scripts/upgrade-surface-cache.py
Unrelated features, credits and snapshot dates remain unchanged.
"""
import gzip, json, math
from pathlib import Path
from scenery_metadata import surface_metadata
for map_path, cache in [(Path('data/saint-cyr.json'), Path('data/cache')), (Path('data/luxeuil/map.json'), Path('data/luxeuil/cache'))]:
    data = json.loads(map_path.read_text())
    originals = {}
    for path in sorted(cache.glob('*.json.gz')):
        if path.name == 'osm.json.gz': continue
        for element in json.load(gzip.open(path))['elements']:
            if element.get('tags'):
                originals[(element['type'][0], element['id'])] = element
    latitude, longitude = data['origin']
    mx = 111320 * math.cos(math.radians(latitude))
    count = 0
    for feature in data['features']:
        if feature['kind'] not in ('rail', 'water', 'waterway', 'road'): continue
        osm_id = feature['id'].split('-')[0]
        original = originals.get((osm_id[0], int(osm_id[1:])))
        if not original: continue
        feature.update(surface_metadata(original['tags'], feature['kind']))
        if feature['kind'] in ('rail', 'waterway') and feature['line'] and original['type'] == 'way':
            # Retain decimetre projection without 3 m RDP loss on nearby curves.
            points = [[round((g['lon']-longitude)*mx,1), round((latitude-g['lat'])*111320,1)] for g in original.get('geometry',[]) if g]
            feature['points'] = [p for i,p in enumerate(points) if i == 0 or p != points[i-1]]
        count += 1
    map_path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print(map_path, count, 'surface features enriched')
