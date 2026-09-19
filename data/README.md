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
