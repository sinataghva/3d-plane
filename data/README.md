# Cached geographic scenery

All geography is downloaded once and kept here. The game does not call external
map or elevation APIs. Vite packages both regions’ processed map/elevation JSON files and elevation
credits in the production build.

- `saint-cyr.json`: simplified, projected OpenStreetMap-derived database.
  © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).
- `saint-cyr-elevation.json`: 129 × 129 regional elevation samples in meters ASL.
- `terrain-attribution.md`: original Terrain Tiles attribution and source licenses.
- `cache/`: original successful OSM layer responses (lossless `.json.gz`) and six Terrarium PNG tiles.
  Preserve these files: the downloader skips existing layers.
- `scenic-tour.json`: generated control sequence for a deterministic sightseeing
  circuit; local validation fixture, not loaded during normal play.

The processed OSM database is linked from the full-screen map. Geometry is
simplified and reprojected; building heights may be estimated. Elevation is
resampled and runway corridors are flattened in the runtime representation.
Source snapshot timestamps are stored separately from the download date.
See the import scripts in `scripts/` and [project README](../README.md) for
processing details.

## Luxeuil

`luxeuil/map.json` and `luxeuil/elevation.json` use the same formats and licenses.
The larger region is approximately 25.4 × 22.3 km, with a 257 × 257 DEM. Original
Overpass responses and nine zoom-11 Terrarium tiles live in `luxeuil/cache/`.
Run the three scenery scripts with `--luxeuil` to reproduce this region. The
merged `osm.json.gz` is regenerable and ignored, while original layer responses
are kept. Gameplay never downloads map data from third-party services.

## Railway and water detail

Processed surface features retain bridge/tunnel/covered tags, waterway type,
intermittency, railway gauge, and width metadata from the existing caches. Railway
and waterway line coordinates preserve the original geometry at decimetre projected
precision for nearby rendering. Missing waterway widths use conservative estimates:
river 12 m, stream 2 m, canal 4 m, ditch 0.7 m, drain 0.5 m; `widthEstimated` records
this distinction. These are visual approximations, not measured channel widths.

`python3 scripts/upgrade-surface-cache.py` restores these fields and line coordinates
from both regions' original cached responses without network access or changing
unrelated features/source dates. The normal OSM importer also retains this metadata.

## Airfield detail

`python3 scripts/upgrade-airfield-cache.py` restores allowlisted aviation tags
(`aeroway`, `surface`, `lit`, building type and roof shape) from both existing
caches, without downloads or changing source timestamps. It also restores missing
explicitly mapped hangar, shelter and tower footprints, plus landing-light rows.
The Luxeuil cache supplies 27 previously omitted shelter footprints, one tower
and one landing-light row. These aviation features lacked a general `building`
tag and were skipped by the earlier importer. They now participate in ordinary
building collision checks. The normal importer retains these categories/tags too.

Only tagged aviation buildings inside the mapped airfield boundary receive the
special facade treatment. Roof shapes and door placement are illustrative when
not provided by OSM; door facades face the nearest mapped taxiway/apron. Estimated
heights retain the existing collision envelope. Unknown apron surfaces are treated
as paved; unknown taxiways use the mission's paved/grass default. Light spacing
within a mapped row is illustrative. None of this depicts current base operations.
