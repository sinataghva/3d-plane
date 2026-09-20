"""Enrich airfields from preserved OSM caches, without network access.
Adds only missing, explicitly mapped aviation building footprints and landing lights.
"""
import gzip, json, math
from pathlib import Path
from airfield_metadata import airfield_metadata
for path, cache in [(Path('data/saint-cyr/map.json'), Path('data/saint-cyr/cache')), (Path('data/luxeuil/map.json'), Path('data/luxeuil/cache'))]:
    data = json.loads(path.read_text())
    originals = {}
    for source in sorted(cache.glob('*.json.gz')):
        if source.name == 'osm.json.gz': continue
        for item in json.load(gzip.open(source)).get('elements', []):
            if item.get('tags'): originals[(item['type'][0], item['id'])] = item
    lat, lon = data['origin']; mx = 111320 * math.cos(math.radians(lat))
    def points(item):
        return [[round((g['lon']-lon)*mx, 1), round((lat-g['lat'])*111320, 1)] for g in item.get('geometry', []) if g]
    def height(tags):
        try: return max(3, min(70, float(tags.get('height', float(tags.get('building:levels', 2))*3+2))))
        except (ValueError, TypeError): return 8
    existing = set(); enriched = 0; added = 0
    for feature in data['features']:
        ident = feature['id'].split('-')[0]; key = (ident[0], int(ident[1:])); existing.add(key)
        source = originals.get(key)
        if source:
            metadata = airfield_metadata(source['tags'])
            if metadata:
                feature.update(metadata); enriched += 1
    for key, source in sorted(originals.items()):
        tags = source['tags']; aviation = tags.get('aeroway')
        if key in existing or source['type'] != 'way' or aviation not in ('hangar', 'shelter', 'tower', 'landing_light'): continue
        p = points(source)
        if len(p) < 2: continue
        building = aviation != 'landing_light'
        if building and (len(p) < 4 or p[0] != p[-1]): continue
        # Caches include query margins: never bring outside-region features into the map.
        south, west, north, east = data['bounds']
        if not any(south <= g['lat'] <= north and west <= g['lon'] <= east for g in source['geometry'] if g): continue
        f = dict(id=f"w{source['id']}-0", kind='building' if building else 'airfieldLight',
                 name=tags.get('name',''), points=p, holes=[], line=not building)
        f.update(airfield_metadata(tags))
        if building: f.update(height=height(tags), roof=tags.get('roof:shape',''), palace=False)
        data['features'].append(f); added += 1
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
    print(path, 'enriched', enriched, 'added mapped features', added)
