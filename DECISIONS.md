# Open Skies — implementation decisions

This log records decisions in implementation order. Later follow-ups supersede
earlier choices; README.md describes the current controls and configuration.

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

## Two flight experiences (2026-09-19)

- Startup presents Saint-Cyr/light aircraft and Luxeuil/Mirage 2000 cards. Card
  artwork is captured from our Three.js aircraft and scenery using
  `scripts/capture-previews.mjs`; no external photos, stock art, or AI images.
- `src/missions.js` owns the selected aircraft, scenery paths, labels, and card
  copy. Only the selected map and elevation are loaded. Change flight navigates
  to a fresh document: the browser releases the old WebGL context, scene assets,
  event handlers, timers, and machine-control tasks instead of accumulating them.
  Direct `?mission=luxeuil` links are supported. Existing `?automation=1` and
  `?visual=...` links retain Saint-Cyr as their default for compatibility.
- Luxeuil uses a roughly 25.4 × 22.3 km region, 47.69–47.89 N / 6.20–6.54 E,
  around the publicly mapped LFSX airbase. Runway geometry comes from OSM. The
  public SIA aerodrome listing was used to cross-check the location and runway
  11/29 identity; this is a fictional flight playground, not real flight guidance.
  Reference: https://www.sia.aviation-civile.gouv.fr/media/dvd/eAIP_11_JUN_2026/FRANCE/AIRAC-2026-06-11/pdf/FR-AD-2.LFSX-fr-FR.pdf
- Source downloads are preserved in `data/luxeuil/cache/`; runtime data is under
  `data/luxeuil/`. Elevation uses nine cached zoom-11 Terrarium tiles, resampled
  to 257 × 257 samples. The shared import scripts accept `--luxeuil`; no map or
  elevation requests occur during normal gameplay. Overpass errors are backed
  off and only missing layers are retried. Terrain outside the detailed area
  continues using the existing blended landscape, preserving free flight.
- The Mirage uses a separate arcade model in `src/jetPhysics.js`. Its speed is
  stored as meters per 60 Hz tick, and its displayed km/h converts actual world
  distance (×216). The light aircraft retains its existing tuning and display
  scale. Mach uses a fixed 343 m/s reference; G-force is an arcade estimate.
  There is no claim to aerodynamic or real aircraft performance accuracy.
- Normal jet throttle is 0–100%, with 1.5-second exponential engine spool-up.
  Holding W at full throttle, or holding mobile Boost with the slider at full,
  commands 110% and shows orange/red exhaust. Release returns to 100% immediately;
  lower normal settings persist. There is no cooldown or time allowance. Focus
  loss, hidden page, pause, restart, switching, and touch cancellation clear boost.
- Gear is toggled with G and airbrakes with B, with equivalent touch buttons.
  Ground retraction is inhibited. Landing requires gear down, a gentle descent,
  level wings, and appropriate speed; airbrakes also provide wheel braking.
  Wing leveling on released bank input is intentionally preserved.
- Fast jet motion checks obstacles and terrain along each step at <=1 m spacing.
  The existing fixed simulation clock remains shared. Aircraft meshes, moving
  elevons, gear, airbrake panels and additive exhaust are generated in code.
- Both experiences start in free flight. Luxeuil's optional four-waypoint circuit
  displays headings/distances and map labels, then invites a return in the takeoff
  direction. There are no time limits, forced landings, weapons or combat missions
  for the jet. The existing light-aircraft tracer feature is preserved.
- Machine controls add boolean `boost`, `gearDown`, and `airbrake`, with aircraft
  and mission in telemetry. Boost is held until explicitly released during
  continuous control; pause, completed bounded animation, focus loss, reset, and
  human takeover release it. Numeric throttle stays limited to 0–1.
- GitHub Actions remain build/deploy only, as requested. Validation runs locally.
  The implementation plan is a local working document and will be deleted after
  validation, without being committed. No commit/push is included in this task.

### Final scenery and validation

- The complete Luxeuil cache contains 21 OSM layers and nine original elevation
  tiles. Dense building data is divided into five bounded requests. All requested
  layers were eventually retrieved; cached successes were reused throughout.
  Source snapshots span 2026-07-28 through 2026-09-19 and are recorded per layer.
- The processed map contains 23,650 building footprints, 7,930 roads, woodland,
  waterways, water polygons, fields and town labels. It is 9.93 MB uncompressed
  (~2.28 MB gzip); elevation is 397 KB (~125 KB gzip). Only one map is loaded per
  flight. The shared production JS is ~664 KB (~176 KB gzip), with the existing
  non-fatal bundle-size advisory. Scenery retains spatial batching and the 9,000
  tree cap. Headless browser frame-rate readings are not hardware benchmarks.
- Unit checks cover boost hold/release, spool-up, takeoff, climb, banking and wing
  leveling, reset, automation pause/takeover, high-speed swept collisions, and
  visible gear/flame/airbrake state. Browser checks cover desktop and emulated
  touchscreen controls, selection, resource cleanup, and full-map town labels.
- The light aircraft completed its existing 123-second sightseeing circuit and
  stopped safely in desktop and mobile browser layouts. The Mirage completed a
  banked circuit through the browser's control API and the offline validator:
  264.87 simulated seconds, peak 686.8 m above runway reference, stopped on runway
  11/29 about 1,935 m from its spawn point, aligned with its takeoff direction.
  The validator also passes against the final complete building cache.

### Mirage maneuvering and gear follow-up

- Replaced capped jet Euler attitude with a normalized quaternion. Full rolls
  and elevator-led loops are possible. Lift follows the aircraft up axis, so
  pulling elevator while banked directly tightens the turn. Speed-dependent
  authority and induced drag constrain sustained maneuvering; the game envelope
  is -3 to +9 normal G. Rudder supplies modest yaw and associated energy loss.
- Preserved wing leveling on released bank. During active elevator input through
  steep or inverted flight, suspend leveling until elevator release to avoid
  interrupting loops. Light-aircraft handling stays unchanged.
- Chase camera uses aircraft up on the jet to remain coherent through vertical
  flight; the orbit camera remains horizon-oriented. Mobile jet stick now reaches
  full authority. The readout spells out Mach.
- Gear extension is physical state separate from the requested switch position.
  Each leg folds on a hinge with eased visual movement over 1.6 seconds. Reversing
  the switch reverses from the current position. Drag follows extension, and safe
  touchdown requires at least 98% extension. The UI reports transit explicitly.
- Regression checks include high-G bank-and-pull, full rolls, a complete loop,
  neutral recovery, gear reversal/reset, mobile input and detached telemetry.
  The complete cached-world circuit validator passes: 311.5 simulated seconds,
  peak 1,483.6 m above runway reference, stopped on the runway in the takeoff
  direction. Desktop browser checks also confirm full keyboard rolls and gear
  transit; bank-and-pull shows 7.6 G.
- Final checks: lint, typecheck, build and all 96 unit tests pass. All 21 browser
  tests pass, including touch-stick inverted flight and gear transitions. Three
  tests initially exceeded timing limits with seven concurrent WebGL sessions;
  all three passed when rerun serially. The existing bundle-size advisory remains.

### Flight comfort and interface refinement

- Chase view uses world up and a smoothed horizontal trailing position. It keeps
  the previous useful heading near vertical flight. Cockpit remains attached to
  aircraft attitude; orbit remains manual.
- Mirage wing leveling is suppressed whenever elevator is held, including
  ordinary banked turns, and resumes when elevator and roll are neutral.
- Holding S deploys the brake after thrust reaches zero; release leaves zero
  thrust and retracts the brake. Mobile has a separate momentary brake button.
  Brake panels animate over 0.35 seconds. Machine controls retain explicit brake
  commands. G remains the gear toggle; B is removed.
- Desktop jet controls are keyboard-driven. Touch users retain gear, boost,
  brake and Fire. Mach, G and equipment status are in Flight Data.
- A settings icon and P replace the persistent toolbar and pause button. The
  modal pauses flight, clears held inputs, traps focus, and closes with P, Esc
  or its close button. Settings include graphics, camera, guide and flight reset.
- Mirage firing uses a faster visual cannon with paired tracers, muzzle flashes,
  quaternion-aligned direction and pooled effects capped at 160 active tracers.
  All audio is explicitly deferred. No real weapon specifications are claimed.
- Validation: 100 unit tests, lint, typecheck and production build pass. All 23
  browser cases pass after adapting the graphics-focus test to open settings.
  Desktop and emulated touch flights, cannon visuals, modal layout and refreshed
  warning/crash baselines were inspected. The full cached-world landing validator
  still stops safely on the runway after 311.5 simulated seconds.

### Custom map destination

- One session-only destination is shared by the overview map, heading-up radar
  and 3D beacon. Clicking/tapping the minimap still opens the full map; only the
  overview places destinations. Overview drawing and hit testing share the same
  projection, including letterboxing and CSS pixel sizing. Padding clicks do
  nothing. Terrain height anchors the marker, including elevated terrain.
- Red pin, stem and ground ring identify the destination. Beacon scale is bounded
  with distance; depth testing is disabled to keep this navigation aid readable
  through intervening terrain. A distance label and camera-relative edge arrow
  guide the pilot without altering flight inputs or triggering arrival behavior.
- Clear destination disables itself when empty. Closing the map retains the
  marker; restart and mission changes clear it. Resources are reused per frame
  and disposed with the flight session. No external data or persistence added.
- Validation: 102 unit tests, lint, typecheck and build pass. Nine relevant
  browser cases pass (desktop/touch destination workflows, existing full-map
  controls and five camera/flight visual baselines). Destination workflows use
  a 60-second budget for repeated map interactions; both finish in about 29
  seconds. Beacon, full-map pin and off-screen guidance were visually reviewed.

### Full-map zoom and pan

- Full map only: positive wheel delta zooms in, negative zooms out, matching the
  requested scroll direction. Ctrl-wheel pinch and Safari gesture events retain
  natural pinch behavior; touch uses two captured pointers. Drag pans, short
  click/tap selects. A six-pixel motion threshold and multi-pointer suppression
  keep navigation gestures from creating destinations.
- Zoom and destination hit testing share a transformed projection. Icons remain
  fixed in screen pixels; additional hamlet/suburb labels appear above 1.5×.
  Off-screen labels are excluded and the scale bar follows visible zoom.
- Minimum zoom is the initial fitted region. Maximum is 2048 divided by the
  fitted image's longest CSS side, capped at 6× and never below 1×. This uses
  cached raster detail without extra downloads. Pan is bounded by the map edges,
  centering axes that fit within the viewport. Resize reclamps the view.
- Fit map resets only the view; Clear destination only clears the marker. View
  persists across closing/reopening, resets on restart or mission switch.
- Validation: 104 unit tests, lint, typecheck and build pass. Six browser cases
  cover wheel direction, anchored selection, drag suppression, Fit map, view
  persistence, touch pinch, destination replacement/reset and existing map keys.
  Desktop and emulated mobile zoomed layouts were visually inspected. Native
  Mac trackpad hardware was not directly tested; browser wheel/pinch paths were.

- Zoom limit follow-up: replaced the resolution-dependent maximum with a fixed
  300% maximum, as requested. The 100% fitted minimum remains unchanged.
- Map +/− buttons now change zoom by 20 percentage points per click, bounded
  to 100–300%; wheel and pinch remain continuous.
- Raised the map maximum to 400% at user request; the fitted 100% minimum
  and 20-percentage-point button increments remain unchanged.

### Distance-based road and runway surfaces

- Kept the regional terrain as the distant layer. Nearby road/taxiway/runway
  ribbons use cached OSM positions and widths, split into 500 m batches. Each
  ribbon is clipped onto the existing terrain's triangle grid, preventing
  corner-interpolated surfaces from cutting through the ground. Physics, source
  data and collision terrain remain unchanged. Footpaths stay in the base map.
- Luxeuil receives sharp edge/centre/threshold markings, runway numbers based on
  cached references and orientation, and restrained procedural tyre marks.
  Saint-Cyr remains grass with sparse boundary indicators. These markings are
  stylized, not a survey of every real-world marking. Roads retain simple surfaces
  without invented lane rules. All material textures are generated locally.
- Low shows the original surface only. Balanced requests up to 20 tiles within
  850 m with simpler grain; High up to 48 within 1,700 m with fine grain, subtle
  bump shading and tyre wear. Surface distance includes altitude, using tile
  horizontal bounds and local elevation. Outer-distance and temporal fades
  avoid abrupt switches. Nearby retention has a 15% distance buffer.
- Geometry is built at most two tiles per frame, reused through a hard 80-tile
  cache and disposed on eviction/mission change. Textures are shared, surface
  normals face upward and use one-sided rendering. Stress tests cover cache
  growth, altitude fade and disposal; geometry tests cover triangle conformity.
- A repeatable `node scripts/benchmark-ground.mjs <label>` benchmark writes
  ignored JSON/screenshots under `test-results/ground-benchmark`. At 1280×720,
  headless Chromium median frame times before/after were Saint-Cyr High
  266.7/300.2 ms and Luxeuil High 233.3/241.8 ms (about 13%/4% extra cost).
  Balanced measured 275.0/225.1 ms respectively after the change. High adds
  30/38 draw calls and about 25,814/10,616 triangles respectively. These slow
  software-rendered timings are relative checks, not native GPU FPS claims.
- The existing automated Mirage circuit still lands and stops on the runway.
  Static visual scenarios warm the tile cache before their single render so
  screenshot baselines include settled detail rather than partial construction.
- Validation: 107 unit tests, lint, typecheck and production build pass. All
  13 targeted browser checks pass, including flights on both maps in desktop
  and emulated mobile layouts, quality switching, cache stress, mission changes
  and visual states. Updated screenshot baselines were visually inspected and
  passed a separate repeat run. The existing large-bundle build advisory remains.
- Afterburner overlap fix: fading ground surfaces and markings now render before
  transparent airborne effects. Depth testing remains enabled; the ground layer
  no longer paints over the Mirage flame. Added a close-to-runway afterburner
  screenshot regression to cover this compositing order.

### Mobile controls and scenario picker

- Mirage's touch throttle has small end zones (-15 to 0 and 100 to 115 on the
  slider). These mean momentary airbrake and 110% afterburner, not negative or
  115% engine thrust. Release/cancel/blur/pause clears the temporary action and
  clamps thrust to 0–100%. Normal throttle values remain persistent.
- Kept the gear toggle with a 44px minimum touch target. Compact simulator
  layouts explicitly show it even when the browser reports a fine pointer.
  Brake/boost buttons are hidden on mobile in favor of labeled slider end zones.
- Small-screen selection uses a viewport-height grid, stacked visual cards in
  portrait and side-by-side in landscape. Compact layouts omit descriptions
  and trait chips, retaining airfield, aircraft, launch action and attribution.
  Dynamic viewport units and safe-area padding keep actions inside the screen.
- Validation: eight browser cases pass, covering iPhone-sized portrait/landscape
  selection, real emulated touch holds, spring-back, cancellation, pause release,
  gear toggling and existing desktop controls. Screenshots were inspected.
  All 107 unit tests, lint, typecheck and production build pass. These checks use
  Chromium touch emulation, not a physical iPhone or native iOS Safari.
