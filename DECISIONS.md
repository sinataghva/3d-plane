# Saint-Cyr–Versailles world decisions

## Scope and sources

- Replace the fictional world with the region bounded by 48.775–48.845 N,
  2.015–2.155 E (about 10.25 × 7.78 km). Saint-Cyr and Versailles are included.
- Import OpenStreetMap geometry once through Overpass, then ship a compact local
  derived database. No third-party API calls during play. Record timestamps and
  retain the import query and conversion script for reproduction.
- Use Mapzen/Terrain Tiles elevation from the public AWS dataset, sampled onto a
  129 × 129 grid. This is real regional relief, not survey-grade ground geometry.
- OSM data is ODbL; expose attribution and the processed database for download.
  Terrain source attribution is included alongside the shipped elevation data.

## Coordinates and rendering

- One unit is one meter of ground distance; local equirectangular projection at
  48.81 N, 2.085 E. Positive X is east, positive Z south. Map is north-up.
- Share one feature collection between 3D scenery, radar, and the full-screen map.
- Simplified building footprints and estimated heights where tags are absent.
  Palace architecture is stylized, not a photogrammetric reconstruction.
- Bake roads/land cover/water into a ground texture and batch buildings/trees
  spatially. Preserve mobile quality controls and avoid thousands of draw calls.
- Smooth/flatten runway corridors for usable ground contact; blend into the DEM.
  Preserve automatic wing leveling and optional guidance; no forced route.

## Flight and geography

- Spawn on a mapped runway using its real axis. Remove the fictional red barrier.
- Flight altitude readouts are above local ground (AGL); terrain remains relative
  to the airfield elevation internally. Buildings and water affect collisions.
- Geographic scenery is a game interpretation, not operational aviation data.

## Validation

- 15 browser regressions pass, including the refreshed visual baselines.
- 82 unit tests pass, including a complete 123-second physics circuit over
  Versailles, reaching 149.7 m AGL and returning to the runway heading.
- Desktop and mobile landscape (844 × 390) animated flights both completed the
  circuit with no crash, zero speed at rest, and a runway touchdown. Mobile is a
  browser viewport test, not a physical-phone performance certification.
- Full-map town labels, palace/canal alignment, aircraft position/direction and
  mobile X close were inspected during flight. Keyboard hold/release map behavior
  and touch controls are covered by the browser regression suite.
- The production build packages local geography and elevation. A browser test
  asserts there are no external HTTP requests during scene/map initialization.
- Re-running the downloader and elevation importer reused every cached source
  without network access.

## Cache and import behavior

- Honor the requested `./data` cache: source responses are retained losslessly in
  `data/cache/*.json.gz`, and original elevation tiles are retained as PNGs.
  Compression reduces repository weight without discarding downloaded data.
- Cache hits never make a network request. Download failures are not cached; the
  script backs off for 30 seconds and can resume with only missing layers.
- Keep a source manifest with snapshot timestamps, queries and SHA-256 checksums.
  The merged source is reproducible from the individual layers and is ignored by
  Git to avoid storing the same source twice.
- Public Overpass requests needed smaller per-layer queries and an identifying
  application User-Agent. Sources remain local during gameplay and production
  builds; no API token, server component or runtime external dependency.
- Source snapshot dates may precede the download date. We retain those original
  timestamps rather than representing cached mapping as a live feed.

## Detailed implementation choices

- Preserve polygon courtyards and water/forest holes when joining multipolygons.
  Simplify building, runway and water outlines by 1 m; other outlines by 3 m.
  Drop tiny building footprints below 35 m² to reduce geometry cost.
- Buildings use their tagged height or an estimate from floor count. Spatial
  500 m batches retain culling; forest trees use deterministic shared instances.
  Palace windows and cornices are stylized on the mapped footprint.
- Flatten mapped water surfaces to a median local elevation. Runway corridors
  blend into the DEM; outside the detailed tile the terrain smoothly reaches a
  distant plain, using the same height function for rendering and flight.
- Cache the map texture once. Full map labels prioritize the airfield and palace
  and avoid overlapping town labels. Radar, full map and ground texture all use
  the same local projection and geometry. Canvas landmarks also have accessible
  text describing the towns and named features.
- Extend automation routes to 360 stages / 180 seconds for a regional circuit.
  Still opt-in and bounded, with human takeover preserved. The saved route is a
  validation fixture, not an imposed route or an automatic landing requirement.

## Final dataset and rendering measurements

- 18 cached OSM layers, 63,070 unique source elements, and six elevation PNGs.
  Original source cache totals about 8.83 MB after lossless compression.
- 50,618 processed features: 24,471 building footprints, 20,965 road segments,
  616 forest polygons, 190 water polygons, two runways, plus other land cover,
  railway, waterway and taxiway features. The palace preserves seven courtyards.
- Processed geography is 11.39 MB (about 2.42 MB with gzip); the elevation grid is
  100 KB. Initial loading is explicit; the game does not download these again
  from external services on each play.
- DEM source range is 83.6–186.1 m ASL. Its approximately 60–80 m grid spacing
  cannot reproduce small embankments or runway-level surveys.
- 8,913 deterministic tree instances use a combined trunk/canopy geometry in
  750 m spatial batches. Buildings use 272 batches. Trees are visual scenery;
  collision checks use terrain, building footprints and water, not individual
  tree trunks or aircraft wing volumes.
- The in-app browser showed about 30 rendered FPS during both flight layouts;
  this is an observation on this browser/host, not a benchmark across devices.
  Graphics quality remains adjustable. The production build retains Vite's
  advisory about the Three.js-containing JavaScript chunk exceeding 500 KB.
- OSM source snapshots range from 2026-06-01 to 2026-09-18 because successful
  responses from public services carry different snapshot dates. They are
  recorded individually in the cache manifest; the scenery is not a live map.

- Final optimized mobile palace-view sample: 156 draw calls and approximately
  467,000 triangles at Balanced quality, observed at about 30 FPS.
- Lint, type checking, unit tests, browser tests, and production build pass.
  Changed files are formatted. The repository-wide formatting check still flags
  the pre-existing `notes.md`; it was left untouched. The upstream attribution
  document is deliberately preserved verbatim and excluded from formatting.

## Regional clouds and wind

- Replace small airfield-centered sphere clusters with 196 irregular cumulus
  banks and 48 thin high-cloud patches across a 28 km repeating region.
- Use four deterministic, locally generated soft cloud silhouettes, varied
  sizes, flattened bases and raised billows. No downloaded texture dependency.
- Render all cloud puffs with one instanced billboard draw call. Use warm lit
  tops, cooler bases, soft transparency, distance fade and near-camera fade.
  These are lightweight cloud approximations, not a volumetric weather solver.
- Apply a light visual wind (3 m/s east, 1 m/s north) in the vertex shader.
  Keep flight forces unchanged. Wrap beyond the 12.5 km visibility fade and
  keep cloud coverage around the camera during unrestricted flight.
- Freeze cloud time on pause and in visual fixtures; cap resumed-frame deltas
  to avoid large jumps after tab suspension. Cloud distribution is deterministic.

- Validation for the cloud update: 84 unit tests and 15 browser regressions pass;
  type checking, lint and production build pass. Inspected desktop and mobile
  flights over Versailles with no shader errors, and refreshed sky baselines.

## Orbit camera entry

- Enter orbit with an 18 m horizontal offset and 7 m elevation, rather than
  inheriting the cockpit camera position. Apply this only when entering orbit,
  preserving the user's zoom and rotation while staying in that mode.
- Verified the cockpit-to-orbit transition in the browser; camera tracking test
  and type check pass. Updated the orbit screenshot baseline.
