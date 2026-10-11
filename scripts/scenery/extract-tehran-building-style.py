"""Extract optional building style tags from preserved local OSM caches.

No geometry, names, or network requests. Run from the repository root.
Source: OpenStreetMap contributors, ODbL; see data/terrain-attribution.md.
"""
import gzip
import json
from pathlib import Path

root = Path('data/tehran')
features = json.loads((root / 'map.json').read_text())['features']
ids = {f['id'].split('-')[0] for f in features if f['kind'] == 'building'}
keys = ('building', 'building:material', 'building:colour', 'roof:shape', 'roof:material', 'roof:colour')
styles = {}
for path in sorted((root / 'cache').glob('*buildings*.json.gz')):
    with gzip.open(path, 'rt') as file:
        for element in json.load(file).get('elements', []):
            key = element.get('type', '')[:1] + str(element['id'])
            if key not in ids:
                continue
            tags = element.get('tags', {})
            style = {k: tags[k] for k in keys if tags.get(k) and tags[k] != 'yes'}
            if style:
                styles.setdefault(key, {}).update(style)
(root / 'building-style.json').write_text(json.dumps(styles, sort_keys=True, ensure_ascii=False, separators=(',', ':')) + '\n')
print(f'Extracted style tags for {len(styles)} existing building sources')
