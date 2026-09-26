# Cached geographic scenery

Geographic sources are downloaded during data preparation and reused from
preserved caches. Development scripts can download missing source files;
gameplay never calls external map or elevation APIs. Vite packages all three
regions’ processed map/elevation JSON files, Tehran's POIs and elevation credits
in the production build. Players load these bundled files from the game's own
website. This is not a guarantee of browser caching or offline play: the app
does not include an offline cache.

- `saint-cyr/map.json`: simplified, projected OpenStreetMap-derived database.
  © OpenStreetMap contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).
- `saint-cyr/elevation.json`: 129 × 129 regional elevation samples in meters ASL.
- `terrain-attribution.md`: original Terrain Tiles attribution and source licenses.
- `saint-cyr/cache/`: original successful OSM layer responses (lossless `.json.gz`) and six Terrarium PNG tiles.
  Preserve these files: the downloader skips existing layers.

The generated sightseeing control sequence is stored separately in
`tests/fixtures/flights/scenic-tour.json`; it is a local validation fixture, not
scenery loaded during normal play.

The processed OSM database is linked from the full-screen map. Geometry is
simplified and reprojected; building heights may be estimated. Elevation is
resampled and runway corridors are flattened in the runtime representation.
Source snapshot timestamps are stored separately from the download date.
See the import scripts in `scripts/scenery/` and [project README](../README.md) for
processing details.

## Luxeuil

`luxeuil/map.json` and `luxeuil/elevation.json` use the same formats and licenses.
The larger region is approximately 25.4 × 22.3 km, with a 257 × 257 DEM. Original
Overpass responses and nine zoom-11 Terrarium tiles live in `luxeuil/cache/`.
Run the three scenery scripts with `--luxeuil` to reproduce this region. The
merged `osm.json.gz` is regenerable and ignored, while original layer responses
are kept. Gameplay never downloads map data from third-party services.

## Tehran / Mehrabad

The playable [Tehran / Mehrabad region](tehran/README.md) covers
**35.53–35.85 N, 51.10–51.66 E**, approximately **50.6 × 35.6 km**, including
Darband and the full mapped Saadabad complex. Its processed map contains
**231,215 features: 71,209 building features, 144,660 road segments** and other
scenery, plus **953 place labels**. Road segments do not represent distinct
named streets. Elevation uses a 257 × 257 grid from twelve cached terrain tiles.
Use `--tehran` with the scenery scripts; the region README documents the
source cache, reproduction steps and measurement procedure.

## Railway and water detail

Processed surface features retain bridge/tunnel/covered tags, waterway type,
intermittency, railway gauge, and width metadata from the existing caches. Railway
and waterway line coordinates preserve the original geometry at decimetre projected
precision for nearby rendering. Missing waterway widths use conservative estimates:
river 12 m, stream 2 m, canal 4 m, ditch 0.7 m, drain 0.5 m; `widthEstimated` records
this distinction. These are visual approximations, not measured channel widths.

All three regions' OSM importers read cached sources without network requests
and retain these fields and line coordinates. For Saint-Cyr and Luxeuil,
`python3 scripts/scenery/upgrade-surface-cache.py` also provides a targeted
offline update of existing processed files, preserving unrelated features and
source dates. Tehran includes this metadata directly through `import-osm.py`.

## Airfield detail

`python3 scripts/scenery/upgrade-airfield-cache.py` restores allowlisted aviation tags
(`aeroway`, `surface`, `lit`, building type and roof shape) from the Saint-Cyr and
Luxeuil caches, without downloads or changing source timestamps. It also restores missing
explicitly mapped hangar, shelter and tower footprints, plus landing-light rows.
The Luxeuil cache includes 27 shelter footprints, one tower and one landing-light
row identified by aviation tags rather than a general `building` tag. Structures
participate in ordinary building collision checks. The offline OSM importer
retains these categories and tags for all three regions, including Tehran.

Only tagged aviation buildings inside the mapped airfield boundary receive the
special facade treatment. Roof shapes and door placement are illustrative when
not provided by OSM; door facades face the nearest mapped taxiway/apron. Estimated
heights retain the existing collision envelope. Unknown apron surfaces are treated
as paved; unknown taxiways use the mission's paved/grass default. Light spacing
within a mapped row is illustrative. None of this depicts current base operations.
