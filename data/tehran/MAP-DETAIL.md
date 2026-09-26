# Tehran detailed flight map

The full Tehran map has three fixed surface resolutions:

| Zoom | Equivalent whole-region width | Approximate ground resolution |
| --- | --- | --- |
| 100–400% | 2,048 pixels | 24.7 m/pixel |
| Above 400–800% | 4,096 pixels | 12.4 m/pixel |
| Above 800–1,200% | 8,192 pixels | 6.2 m/pixel |

The hard zoom cap is 1,200%. Both detail levels use locally generated 512-pixel
tiles, not whole-region high-resolution canvases. Labels are drawn separately
at screen resolution. This is vector cartography, not satellite imagery.
French maps retain their 400% cap. The radar is unchanged. Tehran's 3D ground
uses an independent, label-free local detail level described below.

## Geographic data and POIs

The local map contains 231,215 features, including 144,660 road segments and
71,209 building features, plus 953 place labels. Counts describe source geometry,
not unique streets or a surveyed building inventory. Existing geometry is
sufficient for the current 6.2 m/pixel rendering: imported building boundaries
are simplified to about 1 m and roads to about 3 m. Higher raster resolution
sharpens existing shapes but cannot supply missing geography.

The curated public-place layer contains **40 POIs**, all recovered from preserved
raw OSM caches. No additional downloads were needed for this selection. The
cache is not a complete civic POI database; this conclusion applies to the
selected records, not every possible public place. Missing names, addresses or
business listings are not invented.

The first 19 POIs appear progressively above 400% through 700%: Sarband Square,
the National Museum, Parliament, Laleh and Mellat parks, the National Library,
Rah Ahan Square, Honarmandan Park, the Museum of Contemporary Art, Qasr Museum
Garden, Imam Khomeini Square, the National Botanical Garden, Malek Museum/Library,
Dar ul-Funun, Time Museum, K. N. Toosi University's central administration,
Imam Hossein Square, Iranian Artists Forum and Parliament Library.

The third level adds:

- From 801%: Chitgar, Pardisan, Nahjol Balagheh, Park-e Shahr, Sa'i, Qeytarieh
  and Jamshidieh parks, Marble Palace Museum and the East bus terminal.
- From 1,000%: Parvaz and Daneshjoo parks, Iranian Art Museum Garden, Map Museum,
  Geological Survey, National Cartographic Centre, provincial government and
  Sanat bus terminal.
- From 1,150%: Ministry of Science, Sharif central library, Nezami Ganjavi public
  library and Attar Neyshabouri cultural centre.

These cyan markers represent public/civic places, not businesses, restaurants,
shops or hotels. They are map-only; the eight modeled monuments retain separate
gold markers. Source names, including Persian, are rendered with browser text
shaping. Lower-priority POIs yield to more important labels when they overlap.
Street labels have a screen-area-dependent count and spacing limit.

Rebuild the layer from the merged raw cache:

```sh
node scripts/scenery/import-map-pois.mjs
```

The importer performs no network requests and fails if a selected record, name
or usable geometry is missing, or if its center lies outside the region. It
retains source IDs and available English names. Geometry bounding-box centers
are orientation markers, not surveyed public entrances. Full source provenance
is preserved in `cache/manifest.json`; snapshots are not live operational data.

## Tile generation and memory

Two lazily populated spatial grids reference the same existing feature objects,
without copying geographic geometry. Each resolution has its own grid spacing
and level-qualified cache keys. Only visible cells are generated, prioritized
near the viewport center. The overview remains available while loading, with
cached coarser detail underneath finer tiles when available. Returning to a lower
zoom uses that level's own resolution, not finer tiles stretched into its place.

One shared least-recently-used cache permits at most **24 backing canvases,
including the in-progress tile**, across both detail levels. A padded tile is
516 × 516 pixels, so the RGBA backing-store budget is approximately **24.4 MiB**,
excluding the overview, visible canvas, indexes and browser/GPU overhead.
Peripheral cells use fallback imagery if an extreme viewport exposes more tiles
than the budget allows.

Generation targets a 3 ms work slice, throttled against repeated input events;
a single complex feature can exceed the target, so this is not a real-time
guarantee. Panning or changing levels cancels obsolete partial tiles. Closing,
fitting or resetting the map releases tile canvases; indexes are reusable for
the current world. No external services or background network requests are used.

## Low-altitude 3D ground

Balanced and High use one **8,192-pixel-equivalent** local level, approximately
**6.2 m/pixel**, over the existing 4,096-pixel-wide regional texture. Low keeps
only the regional texture. Detail is fully enabled below 550 m above local
ground and fades out between 550 and 950 m. Horizontal blending ends at 2.4 km
on Balanced / 3 km on High. These thresholds are independent of 2D map zoom.

The shared spatial-index implementation and surface painter generate label-free
ground tiles with the existing terrain colors and relief shading. Building
footprints, map labels, POI icons and markers are not painted onto the terrain.
The shader samples detail on the existing terrain mesh: there is no overlay
mesh, added elevation or change to collision geometry. Padded tiles, edge
blending and a half-second tile fade keep loading boundaries unobtrusive.
The regional texture remains the fallback while new tiles are prepared.

A nine-slot atlas retains a 3 × 3 neighborhood (each cell about 3.17 km across),
prefetching in every direction for flight and turns. Moving away cancels obsolete
partial work; slots outside the neighborhood are reused. Generation targets
2 ms per frame and completes at most one tile/upload per frame. A complex
feature, canvas allocation or GPU upload can exceed that target. High-altitude
flight stops generation; Low, restart and mission disposal release the atlas.

The fixed budget is a 1,548 × 1,548 canvas and matching GPU texture without
mipmaps, one 516 × 516 staging canvas and a 256 × 256 relief canvas: approximately
**19.6 MiB**, plus indexes and driver/browser overhead. Together with the 2D
map's maximum 24 backing tiles this is approximately **44 MiB** of additional
texture/backing storage. This excludes the existing regional texture, overview,
visible map canvas and the rest of the scene; it is not total process memory.

### Surface-data audit and limits

The packaged geometry includes 144,660 roads, 1,140 waterways, 767 rail features,
1,019 water polygons, 1,703 forest polygons, 8,215 grass features, 335 fields,
1,776 urban areas and 50 dry-land features. Existing geometry and holes are
sufficient for this raster-resolution improvement, so **no new downloads or
source imports are required**. Geographic gaps remain gaps, not invented detail.

Preserved raw highway records include 26,794 surface tags, 389 width tags,
1,127 sidewalk tags and 1,312 crossing tags. These could support a separate
cache-only enrichment; this renderer does not claim to model those details.
Road widths still use the existing imported class estimates. Individual paving,
lane-level markings and sidewalk reconstruction would require additional
modeling and, where absent from the cache, new surveyed/geographic data.
Satellite imagery would require a separately licensed imagery source. Neither
POI labels nor sharper textures supply higher-resolution elevation, extra
buildings or trees. French scenery is not opted into this ground-detail system.

## Validation and measurements

Ground-texture checks cover runway starts, departure, low passes, fast travel
and turns, altitude transitions, tile replacement, concurrent 1,200% map use,
quality changes, restart and disposal. Fixed-camera before/after captures cover
the cockpit/airfield, central city, southern neighborhoods and southeastern
desert. The aircraft, camera, lighting, viewport and graphics settings match;
the sharper imagery is most visible at land-cover boundaries. Existing close-up
road geometry was already sharp and is unchanged. French ground and map checks
remain passing.

On Apple M4 Pro / Metal-backed Chromium at High, 1280 × 720 desktop and
844 × 390 touch emulation, settled median frame intervals were **8.3 ms**, with
**9.2–9.3 ms p95**. Nine tiles were ready within approximately **one second**
of the test's post-load observation point. In-game maximum measured CPU work
slices were **2.0–2.8 ms**. An accelerated, rendered 81-second simulated flight
with turns, speeds up to about 1,166 km/h, and climbing/descending through the
detail range measured **8.3 ms median / 9.7 ms p95**; it finished near 420 m AGL
without crashing. Tile storage stayed fixed while slots were replaced.
Opening the finest 2D map in the measured view used eight map tiles alongside
the nine ground tiles, about **27.7 MiB** combined backing/texture storage,
within the approximately 44 MiB maximum. These estimates exclude driver
overhead and the rest of the scene. Native iOS Safari and physical-phone
performance are not established by touch emulation.

Unit checks cover level boundaries, spatial grids, feature sharing, progressive
POIs, shared cache limits and cleanup. Browser checks cover 400% and 800%
transitions, the 1,200% cap, repeated switching, panning, destination retention,
Fit, close/reopen, touch pinch and unchanged French map behavior. Visual review
covers central civic sites, parks, northern public places and southeastern desert
at 800%, 801%, 1,000% and 1,200%, plus mobile-sized layouts.

Run the local server and then:

```sh
node scripts/flight/benchmark-map.mjs
```

On Apple M4 Pro / Metal-backed Chromium, High graphics, 120 settled frames per
view, desktop 1280 × 720 and mobile-sized 844 × 390 at DPR 2:

| Measurement | Desktop | Mobile-sized |
| --- | --- | --- |
| Initial indexed detail preparation | 817 ms | 852 ms |
| First finer-level preparation with index ready | 133 ms | 187 ms |
| Cached 1,200% view preparation | 2.6 ms | 2.4 ms |
| Median frame interval | 8.3 ms | 8.3 ms |
| P95 across measured views | 9.0–9.3 ms | 8.8–9.2 ms |
| Tiles retained across detail levels | 20 | 24 |
| Maximum measured work slice | 3.5 ms | 3.1 ms |

The coarse whole-page JavaScript heap estimate was 894–949 MB; it is not a
measurement of incremental tile memory. Measurements and screenshots live in
ignored `note/map-detail/`. Native iOS Safari and physical-phone memory and
performance remain unverified. These results are not an FPS guarantee.

## Credits

© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The curated POI layer
is a derived geographic database under those terms, separate from application
code. Original sources, queries and attribution are preserved in the cache and
[region documentation](README.md). No third-party map tiles or external imagery
are bundled.
