# Tehran detailed flight map

The full Tehran map has four fixed surface resolutions:

| Zoom | Equivalent whole-region width | Approximate ground resolution |
| --- | --- | --- |
| 100–400% | 2,048 pixels | 24.7 m/pixel |
| Above 400–800% | 4,096 pixels | 12.4 m/pixel |
| Above 800–1,200% | 8,192 pixels | 6.2 m/pixel |
| Above 1,200–1,600% | 16,384 pixels | 3.1 m/pixel |

The hard zoom cap is 1,600%. All three detail levels use locally generated 512-pixel
tiles, not whole-region high-resolution canvases. Labels are drawn separately
at screen resolution. This is vector cartography, not satellite imagery.
French maps retain their 400% cap. The radar is unchanged. Tehran's 3D ground
uses an independent, label-free local detail level described below.

## Closest map level style

The new 16,384 level uses the same locally cached geometry. Above 1,200%,
the selected hybrid style adds outlined buildings and courtyards, outlined roads
with separate casing/fill passes, defined water edges, sparse mapped one-way
arrows and additional named residential streets. Reverse one-way tags are
respected; `oneway=no` does not draw arrows. Green spaces retain the original
colors and pedestrian routes retain solid lines for contrast. Lower levels and
the 3D ground painter retain the existing style. There are no new downloads or
invented street features. This style is the default; no review query is needed.

The shared 24-canvas budget is unchanged. Only the index for the requested
resolution is built; cached coarser tiles remain the loading fallback. Text
is drawn separately at screen resolution. The map and terrain have independent
resolution choices; the ground levels have their own distance and altitude thresholds.

## Geographic data and POIs

The local map contains 231,215 features, including 144,660 road segments and
71,209 building features, plus 953 place labels. Counts describe source geometry,
not unique streets or a surveyed building inventory. The new level reuses this geometry: imported building boundaries
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

Three spatial grids, each built lazily on first use, reference the same existing
feature objects without copying geographic geometry. Each resolution has its own grid spacing
and level-qualified cache keys. Only visible cells are generated, prioritized
near the viewport center. The overview remains available while loading, with
cached coarser detail underneath finer tiles when available. Returning to a lower
zoom uses that level's own resolution, not finer tiles stretched into its place.

One shared least-recently-used cache permits at most **24 backing canvases,
including the in-progress tile**, across all three detail levels. A padded tile is
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

Balanced and High blend two local texture levels over the 4,096 regional
texture. Low keeps the regional texture alone. These thresholds are independent
of the 2D map zoom; all distances below are horizontal from the aircraft to the
ground fragment, and AGL is the aircraft altitude above local terrain.

| Level | Resolution | Balanced full / fade-end distance | High full / fade-end distance | AGL full / fade-end |
| --- | --- | --- | --- | --- |
| Regional | 4,096 (~12.4 m/pixel) | Underlying fallback everywhere | Underlying fallback everywhere | All |
| Intermediate | 8,192 (~6.2 m/pixel) | 1,200 / 2,400 m | 1,500 / 3,000 m | 550 / 950 m |
| Close | 16,384 (~3.1 m/pixel) | 400 / 800 m | 600 / 1,200 m | 250 / 500 m |

Between each full/fade-end pair, smoothstep reduces that level's strength.
Distance and altitude strengths multiply. The shader first blends intermediate
over regional, then close over that result, so a missing or fading close tile
retains the intermediate surface. There is no overlay mesh, added elevation or
change to collision geometry. Labels, POIs and building footprints are omitted.
The existing ground palette, solid paths and relief shading are retained;
Phase 1's geographic indexing and finer resolution are reused without map ink.

Each local level has a separate nine-slot atlas and a 3 × 3 aircraft-centered
neighborhood: intermediate cells span about 3.17 km; close cells about 1.58 km.
Padded tiles use linear filtering, a 55 m edge blend and a half-second load fade.
The close footprint fits within the finer neighborhood even near a cell edge.
Generation across both levels shares a **2 ms CPU target and at most one atlas
upload per frame**, with intermediate fallback prepared first. Individual
features, allocation and GPU upload may overrun the target. Low, restart and
mission disposal release both atlases. Altitude fades stop preparation for a
level once its target strength is zero; retained tiles can be reused on descent.

Each atlas is 1,548 × 1,548 with a matching GPU texture, no mipmaps, and a
516 × 516 staging canvas. The main world shares one 256 × 256 relief canvas.
Together the two levels use approximately **38.8 MiB** of backing/texture
storage; adding the map's maximum 24 backing tiles gives approximately
**63.2 MiB**. The new level adds approximately **19.3 MiB** within the agreed
nine-slot allowance. These totals exclude indexes, driver overhead, the existing
regional texture, visible map canvas and the rest of the scene. They are not
total process-memory measurements.

### Close-level validation and scheduling

Three alternating runs compared the previous two-level renderer, close detail
with all-direction preparation, and close detail with camera-prioritized
preparation. The 216 scene records cover Balanced/High, six locations/altitudes,
1280 × 720 DPR 1 and 844 × 390 DPR 2, on Apple M4 Pro / Metal Chromium.
Camera priority improved pooled visible preparation by about 5–10%, below the
15% adoption threshold, without a repeatable CPU saving. **All-direction
preparation is retained**; the experimental camera scheduler is not shipped.

Two noisy static frame comparisons were repeated with three alternating,
600-frame measurements. Baseline/close p95 was 13.0/13.0 ms for Balanced south
and 13.4/13.3 ms for High intermediate; p99 was 14.0/14.1 and 14.6/14.9 ms.
Both satisfy baseline plus the greater of 1 ms or 10%. High stress replays
with travel, quick turns, looking skyward and altitude changes also passed:
close p95/p99 was 11.8/13.2 ms desktop and 11.1/14.2 ms mobile-sized, versus
12.4/14.5 and 12.3/13.9 ms baseline. These comparisons establish no repeatable
regression in the measured cases, not a speed improvement.

Both local levels initially prepare in roughly 0.63–0.66 seconds, versus
0.31–0.33 seconds for intermediate alone, with fallback visible throughout.
Maximum completed uploads remained one per frame. Recorded CPU slices reached
about 2.9 ms; the 2 ms work budget is a cooperative target. The unchanged
initial distance thresholds are retained on Balanced and High. Matched park
and southern-neighborhood views show sharper paths and land-cover edges.
The protocol, raw records, before/after originals and transition replays are
saved locally under ignored `note/ground-close/`. Mobile-sized host emulation
does not establish native iOS Safari or physical-phone performance.

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

## 1,600% validation

Before the green-space/path revision, three runs per style and viewport compared the current and richer styles at
16,384 resolution, plus an 8,192-resolution reference at the same 1,600% framing.
Four fixed views covered central Tehran, an interchange, parks and the desert.
Measurements used Chromium/Metal on Apple M4 Pro, High graphics, 1280 × 720
at DPR 1 and 844 × 390 touch emulation at DPR 2. Existing ground detail was active.

| Measurement | Desktop current / rich | Mobile-sized current / rich |
| --- | --- | --- |
| Median initial index and visible-tile preparation | 414 / 546 ms | 456 / 623 ms |
| Settled median frame interval | 8.3 / 8.3 ms | 8.3 / 8.3 ms |
| Scene p95, median across three runs | 9.2–9.3 / 9.1–9.3 ms | 9.1–9.3 / 9.2–9.3 ms |
| Scene p99, median across three runs | 9.4–9.7 / 9.2–9.4 ms | 9.3–9.4 / 9.3 ms |
| Maximum observed map work slice | 4.0 / 4.0 ms | 3.0 / 3.6 ms |

Both candidates passed the comparison guardrail: scene p95 and p99 stayed within
their baseline plus the larger of 1 ms or 10%. The required resolution increase
also passed against the 8,192 reference. These results do not establish a speed
improvement. Rich styling consistently took longer to prepare initially.
The 3 ms work target can be exceeded by individual features or canvas work.

Map backing canvases remained within 24 slots (24.4 MiB); together with the
existing ground atlas and staging storage, the measured maximum was 43.9 MiB.
This excludes indexes, visible canvases, overview, driver overhead and other
scene memory. The coarse whole-page JavaScript heap estimate was 949–1,000 MB;
it is not incremental map memory.

Checks cover the new threshold and cap, wheel/buttons/touch events, panning,
destination retention, Fit, reopen, restart, mission changes, shared-cache
replacement and concurrent ground use. CPU-canvas comparison verifies that
both variants paint identical lower-level surfaces. Browser GPU canvas batching
can cause small raster differences even between two runs of the same style.
French maps retain their 400% cap. No new source data was fetched.

The review gallery, original screenshots, protocol and per-run measurements are
in ignored `note/map-1600/`. The user selected hybrid C (building treatment B, green spaces and paths A). Physical
phones and native iOS Safari remain unverified.

## Earlier 1,200% validation and measurements

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
