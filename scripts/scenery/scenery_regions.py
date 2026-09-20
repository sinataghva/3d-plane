"""Public scenery bounds and cache destinations shared by offline import tools."""
import sys
from pathlib import Path
REGION = 'luxeuil' if '--luxeuil' in sys.argv else 'saint-cyr'
BOUNDS = [47.69, 6.20, 47.89, 6.54] if REGION == 'luxeuil' else [48.775, 2.015, 48.845, 2.155]
ORIGIN = [(BOUNDS[0]+BOUNDS[2])/2, (BOUNDS[1]+BOUNDS[3])/2]
OUTPUT = Path('data') / REGION
CACHE = OUTPUT / 'cache'
OUTPUT.mkdir(parents=True, exist_ok=True)
MAP_FILE = OUTPUT / 'map.json'
DEM_FILE = OUTPUT / 'elevation.json'
