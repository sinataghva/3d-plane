# Tehran / Mehrabad scenery

Tehran · Mehrabad is a locally cached flight region with a playable IIAF-liveried
F-4 Phantom, city and desert scenery, landmarks, parked aircraft and road traffic.
Gameplay loads bundled assets from the game's own website, without calls to
external map or elevation APIs. Source caches are preserved in the repository;
they are distinct from the player's browser cache. Network access is needed to
load the app and its assets unless already browser-cached; offline play is not
provided by the app.

## Coverage and map data

Bounds: **35.53–35.85 N, 51.10–51.66 E**, approximately **50.6 × 35.6 km**.
Coverage includes Mehrabad toward the west, central Tehran, the full mapped
Saadabad estate, Darband / Sarband Square, northern foothills, Rey and dry
terrain to the southeast. The northern edge is about 2.4 km beyond Sarband
Square. The airport is not the map center, and the region does not cover the
entire Tehran metropolitan area.

| Current processed data | Value |
| --- | --- |
| Geographic features | 231,215 |
| Building features | 71,209 |
| Road segments | 144,660 |
| Place labels | 953 |
| Curated map-only civic/public POIs | 40 |
| Map JSON | 49.67 MB; approximately 9.32 MB gzip |
| Elevation JSON | 0.46 MB |

Road segments are source-derived geometry features, not distinct named streets.
Building features describe mapped geometry, not a surveyed inventory. Coverage
is uneven: sparse source data does not necessarily mean empty city blocks.

The coordinate origin is **35.675 N, 51.38 E**. Mapped points use meters east
(+X) and south (+Z). Terrain and edge aprons use the geographic bounds rather
than assuming that the coordinate origin is the rectangle's center.
The flat distant backdrop exists only beyond the mapped terrain and its 3 km
transition border, so lower-elevation neighborhoods are not covered by it.
Elevation uses a **257 × 257** grid resampled from twelve zoom-11 Terrarium
tiles, with approximately 198 m east–west / 139 m north–south sample spacing.
Sampled heights range from 986 to 3,011 m above sea level. This is coarse regional
relief, not surveyed runway geometry.

Mapped sand, rock, scree, scrub and heath share a stylized dry-land category.
Unmapped ground uses an arid palette; this is not satellite imagery or a claim
that all unclassified land is desert.

## Aircraft and airfield

Departure is from the western end of Mehrabad runway **11R/29L**. Connected
source segments form one continuous runway. Runtime flattening covers the
terrain vertices supporting the runway footprint, with a smooth outer
transition. Neighboring airfields use their own locally sampled elevations.
Untagged airfield surfaces default to pavement; explicit surface tags, including
grass, take precedence. The overview and nearby surface detail share this default.

The F-4 has a continuous framed two-seat canopy, twin exhausts, retractable gear
and airbrakes, with a locally generated, era-inspired IIAF livery. It uses arcade
jet handling, shared camera modes, instruments and jet audio. It has **no gun in
this game**: Space produces neither gunfire nor gun audio. Six visible procedural
Mk-82 bombs release individually with Space or the mobile Drop bomb button,
only at least 10 m above local ground (a configurable game parameter).
The last release starts a 30-simulation-second full-loadout reload, continuing
on the ground; the HUD shows remaining stores and the countdown. A predicted
terrain-draped crosshair scales with distance for screen readability and tracks impacts on terrain and static building
collision envelopes, is hidden below the release limit, remains dimmed while
reloading, and disappears if the impact is off-screen or no intersection is found. Solid
impacts create enlarged arcade explosions, water impacts create splashes, and
neither causes damage or destruction. All motion, prediction and effects are
local, with bounded work and resources. See [bomb controls and limits](../../README.md#f-4-phantom--iiaf).

Eight static F-5 Tigers occupy mapped military apron way 28670023. Three generic
Airbus-style airliners occupy civilian apron ways 1044518738 and 1044507318.
These are procedural, non-playable decorations with fictional placements, not
an inventory of current airport operations. No external aircraft models, airline
logos or runtime network services are used.

Parking respects apron edges, holes, buildings, traffic routes, slopes and other
aircraft, using clearance radii of 8.5 m for fighters and 24 m for airliners.
Mapped airfield buildings within 100 m of the military apron receive military
hangar styling; other airfield buildings retain civilian styling.

## Landmarks, navigation and traffic

Eight stylized procedural landmarks appear at mapped locations: Azadi Tower,
Milad Tower, Golestan Palace, Tabiat Bridge, Saadabad's White Palace, Niavaran
Palace, the University of Tehran gate and Azadi Stadium. Gold full-map/minimap
markers identify them. The Saadabad model represents the White Palace, not a
detailed reconstruction of every building in the estate. An approximate distant
Alborz skyline includes Damavand. The menu image is an actual F-4/Azadi scene
capture. See [landmark references and modeling limits](LANDMARKS.md).

The full map has three display levels: a 2,048-pixel-wide overview through **400%**,
4,096-pixel-equivalent detail above **400–800%**, and 8,192-pixel-equivalent detail
above **800–1,200%**, with a hard **1,200%** cap. Detail tiles show building
footprints, roads and available street names. Forty curated civic/public POIs,
including Sarband Square, appear progressively
as zoom and label space permit. They exclude businesses and the eight modeled
landmarks. Detail generation is incremental, with a shared 24-tile limit across
both detail levels, including an in-progress tile; there
are no live map-service requests. See [map rendering and data notes](MAP-DETAIL.md).
The 3D ground retains its 4,096-pixel-wide regional texture (about 12.4 m/pixel),
with locally generated, label-free 8,192-pixel-equivalent detail (about 6.2 m/pixel)
near the aircraft on Balanced and High. Its altitude/distance transitions are
independent of map zoom. Low uses only the regional texture. Roads, waterways and
land-cover boundaries become sharper; terrain geometry and source coverage do not change.

Decorative cars follow surface highways and preserved one-way routes. Balanced
supports up to 120 nearby active cars and High up to 240; Low disables traffic.
Camera-view filtering limits the cars submitted to the instanced drawing batch.
Birds are not enabled.

## Rendering and performance

Building batches use 3 / 6 / 10 km draw ranges on Low / Balanced / High, with a
screen-door fade over the outer quarter of each range. Building shadows are
limited to nearby batches, approximately 1.5 km. Culling reduces rendering work,
not the memory needed to load the region or its collision data.

Parked aircraft share baked geometry by type in 500 m instance batches, with
700 / 1,400 / 2,500 m visibility ranges on Low / Balanced / High. Ground detail,
traffic and parked-aircraft caches have bounded budgets.

Performance depends on the device and graphics backend. Local benchmark
reports belong in ignored `note/`, not in the runtime specification. Desktop
browser tests and mobile-sized layouts do not establish native phone or iOS
Safari performance; real-phone performance remains unverified.

For scenery measurements, start Vite and run with Node.js 24:

```sh
HEADED=1 node scripts/scenery/measure-region.mjs tehran luxeuil saint-cyr
node scripts/flight/benchmark-map.mjs
```

The scenery probe records loading, construction, asset sizes, sampled JavaScript
heap, draw calls, triangles and frame times. It includes parked aircraft but
excludes the playable aircraft and traffic. Heap measurements exclude GPU memory
and do not represent peak process memory. Outputs are kept in ignored `note/`.

Deterministic views include `?mission=tehran&visual=tehran-city`,
`visual=tehran-desert` and `visual=tehran-north`, alongside landmark, card,
cockpit and exhaust views. Automated checks cover runway render/physics alignment,
takeoff and landing, map controls, all three zoom levels, desktop/mobile-sized layouts,
quality settings, lighting and audio.

## Sources and reproduction

- `map.json`: simplified geometry derived from **© OpenStreetMap contributors**,
  licensed under [ODbL 1.0](https://www.openstreetmap.org/copyright).
- `map-pois.json`: a curated OSM-derived public-place database under the same
  license, with source IDs and approximate centers rather than surveyed entrances.
- `elevation.json`: resampled [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/).
  Source URLs are embedded. Preserve the shared
  [terrain attribution](../terrain-attribution.md), including USGS SRTM/GMTED2010 credits.
- `cache/`: lossless Overpass responses, official OSM API XML and original terrain
  PNGs. `manifest.json` records queries, source timestamps and SHA-256 checksums.
  Public sources include `overpass-api.de`, `maps.mail.ru` and
  `api.openstreetmap.org/api/0.6`.

The OSM merge uses 58 cached inputs. The normalized official-API input is derived
from twelve bounded map responses and eight complete polygon-relation responses,
with their URLs and checksums preserved. Its timestamp identifies assembly time,
not a single Overpass snapshot. Geographic source snapshots do not describe
current airport operations.

`cache/region.json` records bounds, origin and elevation resolution. Import
scripts reject conflicting settings. Successful source files are reused;
`SCENERY_LAYERS` selects a comma-separated subset for targeted requests, and
`OVERPASS_ENDPOINT` selects a public endpoint for missing Overpass layers.
A full merge requires every required layer to be cached.

Run from the repository root with Python/Pillow and Node.js 24:

```sh
python3 scripts/scenery/download-north-api.py --tehran
python3 scripts/scenery/download-scenery.py --tehran
python3 scripts/scenery/import-osm.py data/tehran/cache/osm.json.gz --tehran
python3 scripts/scenery/import-elevation.py --tehran
node scripts/scenery/import-map-pois.mjs
```

The merged `cache/osm.json.gz` is an ignored intermediate that can be regenerated
offline from the preserved sources. Vite packages the processed JSON under
`/3d-plane/data/tehran/`.
