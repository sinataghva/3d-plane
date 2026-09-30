"""Preserve explicit car restrictions for the Phase 3 roads, offline from OSM caches."""
import gzip
import json
from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
data = json.loads((root / 'data/tehran/map.json').read_text())
ids = {int(f['id'].split('-')[0][1:]) for f in data['features']
       if f['kind'] == 'road' and f['id'].startswith('w')}
tags_by_id = {}
for path in sorted((root / 'data/tehran/cache').glob('*.json.gz')):
    with gzip.open(path, 'rt') as source:
        for element in json.load(source).get('elements', []):
            if element.get('type') == 'way' and element['id'] in ids:
                tags_by_id[element['id']] = element.get('tags', {})
for path in sorted((root / 'data/tehran/cache').glob('*.osm.gz')):
    with gzip.open(path, 'rt') as source:
        for element in ET.parse(source).getroot().findall('way'):
            id = int(element.attrib['id'])
            if id in ids:
                tags_by_id[id] = {t.attrib['k']: t.attrib['v'] for t in element.findall('tag')}
restricted = []
for id, tags in tags_by_id.items():
    value = next((tags[k] for k in ['motorcar', 'motor_vehicle', 'vehicle', 'access'] if k in tags), '')
    if value in ['no', 'private', 'agricultural', 'forestry', 'delivery', 'destination', 'customers']:
        restricted.append('w' + str(id))
out = {'source': 'OpenStreetMap contributors; preserved data/tehran/cache, offline extraction',
       'license': 'ODbL-1.0', 'sourceUrl': 'https://www.openstreetmap.org/copyright',
       'description': 'Conservative exclusion of explicitly restricted car routes; missing tags are not proof of public access.',
       'excludedWayIds': sorted(restricted)}
(root / 'data/tehran/structure-access.json').write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
print(f'{len(restricted)} restricted ways; {len(tags_by_id)} cached road records audited')
