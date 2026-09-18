# Cached geographic scenery

All geography is downloaded once and kept here. The game does not call external
map or elevation APIs. Vite packages the two processed JSON files and elevation
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
See the import scripts and `DECISIONS.md` for exact processing choices.
