"""Public scenery bounds and cache destinations shared by offline import tools."""
import sys
import json
from pathlib import Path
requested = [name for name in ('saint-cyr', 'luxeuil', 'tehran') if '--' + name in sys.argv]
unknown = [arg for arg in sys.argv[1:] if arg.startswith('--') and arg[2:] not in ('saint-cyr', 'luxeuil', 'tehran')]
if len(requested) > 1 or unknown:
    raise SystemExit('Select one region: --saint-cyr, --luxeuil or --tehran')
REGION = requested[0] if requested else 'saint-cyr'
REGIONS = {
    'saint-cyr': dict(bounds=[48.775, 2.015, 48.845, 2.155], zoom=12, size=129),
    'luxeuil': dict(bounds=[47.69, 6.20, 47.89, 6.54], zoom=11, size=257),
    # Mehrabad to the west, central/northern Tehran, Rey and dry southeastern hills.
    'tehran': dict(bounds=[35.53, 51.10, 35.85, 51.66], origin=[35.675, 51.379999999999995], zoom=11, size=257),
}
CONFIG = REGIONS[REGION]
BOUNDS = CONFIG['bounds']
ORIGIN = CONFIG.get('origin', [(BOUNDS[0]+BOUNDS[2])/2, (BOUNDS[1]+BOUNDS[3])/2])
OUTPUT = Path('data') / REGION
CACHE = OUTPUT / 'cache'
OUTPUT.mkdir(parents=True, exist_ok=True)
MAP_FILE = OUTPUT / 'map.json'
DEM_FILE = OUTPUT / 'elevation.json'
if REGION == 'tehran':
    CACHE.mkdir(parents=True, exist_ok=True)
    recipe = dict(region=REGION, **CONFIG)
    recipe_file = CACHE / 'region.json'
    if recipe_file.exists() and json.loads(recipe_file.read_text()) != recipe:
        raise SystemExit('Cached Tehran bounds/resolution differ. Preserve the old cache and use a separate cache before changing the region.')
    if not recipe_file.exists():
        recipe_file.write_text(json.dumps(recipe, indent=2) + '\n')
