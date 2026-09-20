# Open Skies — Saint-Cyr & Luxeuil

An educational browser-based 3D airplane simulator built with Three.js and Vite.

Choose a Cessna-style light aircraft at Saint-Cyr-l’École near Versailles, or a Mirage 2000 at Luxeuil–Saint-Sauveur. Explore cached, real-world-inspired scenery with arcade flight physics, three camera modes, live instruments, radar and a full-screen regional map. Free flight is the default; guides and landing challenges are optional.

## Choose your flight

The startup screen offers two visual cards captured from the game itself:

| Experience             | Aircraft                    | Flying style                                             |
| ---------------------- | --------------------------- | -------------------------------------------------------- |
| Saint-Cyr · Versailles | Cessna-style light aircraft | Relaxed sightseeing, gardens and villages                |
| Luxeuil · Haute-Saône  | Mirage 2000                 | Jet flight, banked turns and optional navigation circuit |

Select a card and press **Fly**. **Change flight** returns to selection with a
fresh simulation. Find it in the settings menu. The picker fits phone screens in
portrait and landscape; flying on phones uses landscape. Both experiences default to unrestricted free flight.

### Mirage controls and handling

The jet has no fixed top-speed clamp. Thrust and gravity compete with drag that
rises smoothly through the transonic range and at higher supersonic speeds.
Clean, level flight with sustained afterburner approaches roughly Mach 2; dives
can exceed that equilibrium, while gear, airbrakes and high-G maneuvers add drag.
This is arcade tuning inspired by the [manufacturer's Mach 2.2+ specification](https://www.dassault-aviation.com/fr/defense/soutien-militaire/avions-soutenus/mirage-2000/),
not a reproduction of its performance envelope. Mach uses a fixed 343 m/s reference;
air density, temperature and engine performance do not currently vary with altitude.

- **W/S** adjust thrust. Hold **W** at 100% to engage **110% afterburner**;
  release W to return to 100%. The orange/red exhaust lights only during boost.
- On mobile, hold the throttle slider beyond **100%** in the right end zone
  for afterburner. Release or cancel the touch to spring back to 100%.
  Hold the left end zone below **0%** for braking; release returns to 0%.
- **G** toggles gear in flight. Hold **S** to reduce thrust; at 0% it deploys
  airbrakes/wheel braking. Release S to retract, keeping zero thrust. Mobile
  has a **Gear** toggle button. Gear folds smoothly over 1.6 seconds; wait
  for **Gear: down** before touchdown. Retract gear after departure.
- Rotate around **260 km/h**. Approach at **260–340 km/h**, with gear down,
  wings level, and a gentle descent below 5 m/s. Reduce thrust and use airbrakes
  to stop. These are game operating targets, not real Mirage flight instructions.
- **Bank, then pull the elevator** to tighten a turn. Full rolls and loops are
  supported, with speed-dependent authority, up to 9 G of positive lift and
  energy loss under load. Rudder provides yaw correction. The mobile stick
  offers the same maximum control authority as the keyboard.
- Holding elevator preserves bank after releasing roll input. Release both
  elevator and bank to resume automatic wing leveling. This applies to ordinary
  turns as well as loops.
- The jet has engine spool-up, **Mach** (speed relative to sound) and estimated
  normal G-force readouts.
- Chase view keeps the horizon upright and follows turns with a little lag;
  cockpit view rotates with the aircraft.
- **Space** fires the visual-only rapid cannon (touch: Fire). Jet tracers and
  brief muzzle flashes use a bounded pool. No audio is included.
- **P** or the settings icon opens a paused menu for camera, graphics, guides,
  restart and changing flight. Close with P, Esc or × to resume. **C** still
  cycles cameras directly. Desktop jet buttons are hidden; Mach, G and gear/
  brake/afterburner status appear in Flight Data.
- Optional **Circuit challenge** adds four map waypoints and navigation hints.
  Fly through them above 150 m AGL, then return whenever you choose.

### Luxeuil scenery

A roughly **25.4 × 22.3 km** cached region surrounds Luxeuil–Saint-Sauveur (LFSX).
The north-up map labels Luxeuil-les-Bains, Abelcourt, Saint-Sauveur and surrounding
towns. Runways, taxiways, roads, woodland, water and relief share the same
coordinates as flight and collision detection. This is stylized scenery, not a
navigation chart or a representation of current base operations.

```bash
python3 scripts/scenery/download-scenery.py --luxeuil
python3 scripts/scenery/import-osm.py data/luxeuil/cache/osm.json.gz --luxeuil
python3 scripts/scenery/import-elevation.py --luxeuil
node scripts/flight/validate-jet-flight.mjs
```

Source layers and nine original elevation tiles stay in `data/luxeuil/cache/`.
Normal play loads only local `data/luxeuil/map.json` and `elevation.json`.
Credits below apply to both maps. Successful downloads are reused; the importer
works offline once the cache is complete. `OVERPASS_ENDPOINT` can select another
public instance if the default is unavailable; no authentication is required.

## Features

- Procedural Cessna-style light aircraft and Mirage 2000 models
- Arcade flight physics with thrust, lift, gravity, stalls, banking, rudder, and landing behavior
- Animated propeller and animated control surfaces for ailerons, elevator, rudder, and automatic flaps
- Chase, cockpit, and orbit camera modes
- Live flight HUD with speed, altitude, thrust, heading, pitch, roll, vertical speed, and energy state
- Cockpit overlay with analog-style attitude instrument
- Heading-up radar/minimap centered on the plane
- Warning banners for low altitude, stall risk, and crash states
- Crash handling with visual feedback and restart flow
- Machine-gun tracer fire with space bar
- Saint-Cyr–Versailles and Luxeuil scenery from cached OpenStreetMap geometry and regional elevation
- Zoomable full map with a selectable destination and a red world-space beacon
- Distance-based road/runway surface detail and three graphics presets
- Real runway alignment, town labels, palace, Grand Canal, roads, woodland and terrain collisions
- Unit tests and visual regression tests

## Saint-Cyr–Versailles scenery

The detailed area covers approximately 10.3 × 7.8 km. The aircraft starts on the
mapped grass runway at Saint-Cyr (LFPZ), heading approximately 113°. The map and
3D scene share coordinates and feature data. Explore the stylized Château de
Versailles, Grand Canal, formal garden paths, woodland, fields, and surrounding
neighborhoods. The map labels Versailles, Saint-Cyr-l’École, Fontenay-le-Fleury,
Bois-d’Arcy, Bailly, Rennemoulin, Noisy-le-Roi, and Le Chesnay-Rocquencourt;
labels are decluttered on smaller screens.

Hold **M** for the north-up map and release it to return to flight. On mobile,
tap the radar to open the map and **×** to close it. The map shows the entire
region with a live aircraft icon indicating your position and heading.

Altitude is above local ground.
Buildings and water can cause crashes; grass and fields remain usable for
forgiving off-field landings. Free flight continues beyond the detailed area.

Saint-Cyr source downloads are cached in `data/saint-cyr/cache/`. Normal play and builds use
only local `data/saint-cyr/map.json` and `data/saint-cyr/elevation.json`; no API token
or runtime Overpass/elevation connection is needed. Existing cached layers are
reused. To reproduce the scenery from the cache:

```bash
python3 scripts/scenery/download-scenery.py
python3 scripts/scenery/import-osm.py data/saint-cyr/cache/osm.json.gz
python3 scripts/scenery/import-elevation.py
```

The elevation import requires Python Pillow. The downloader fetches only missing
source layers; preserve the cache to avoid repeated requests to public services.
`node scripts/flight/plan-flight.mjs` generates a reproducible banked sightseeing flight
using the actual flight physics, ending back on the runway. It saves controls to
`tests/fixtures/flights/scenic-tour.json` for local automation testing.

Buildings are simplified and heights are estimated where OSM has no height;
the palace is a stylized footprint-based model. Real elevation is resampled onto
a 129 × 129 grid, with runway corridors flattened for gameplay. This is coarse
regional relief, not a surveyed airfield. The sections below describe sources,
rendering tradeoffs, and validation commands.

### Map and terrain credits

Thank you to the contributors and projects that make this scenery possible:

- **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** —
  airfield geometry, building footprints, roads, land cover, waterways, and place
  names. The map data is available under the **Open Database License (ODbL 1.0)**.
  Our simplified, projected derived databases for [Saint-Cyr](data/saint-cyr/map.json)
  and [Luxeuil](data/luxeuil/map.json) are distributed with the project and
  linked from each in-game full map.
- **[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API)** — the
  open-source query service used to extract the OSM features. Thanks to its
  maintainers and public instance operators. Extraction happens during data
  preparation; gameplay uses the local cache.
- **[Mapzen / Tilezen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)** —
  regional elevation, downloaded as Terrarium tiles from the public AWS-hosted
  dataset. The collection credits providers including **Copernicus / European
  Union EU-DEM** and the **U.S. Geological Survey** for global SRTM and GMTED2010
  data. Provider-specific attribution and license notices are preserved in
  [terrain-attribution.md](data/terrain-attribution.md), from the
  [upstream attribution document](https://github.com/tilezen/joerd/blob/master/docs/attribution.md).

Original downloads are preserved in [Saint-Cyr cache](data/saint-cyr/cache/) and
[Luxeuil cache](data/luxeuil/cache/), with source timestamps and checksums in
their respective `manifest.json` files.
Source dates can differ between layers; this is a cached scenery snapshot,
not a live map. These data-source credits and licenses apply to the geographic
data separately from the application code.

## Getting Started

### Prerequisites

- Node.js 24 (the version used by deployment)
- npm

### Installation

```bash
npm install
```

### Run Locally

```bash
npm start
```

The Vite development server runs at:

```text
http://127.0.0.1:5173/3d-plane/
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

The preview server runs at:

```text
http://127.0.0.1:4173/3d-plane/
```

## Controls

- **W / S**: Increase or decrease thrust
- **A / D**: Rudder left/right
- **Arrow Left / Arrow Right**: Bank and turn left/right
- **Arrow Down**: Pitch nose up
- **Arrow Up**: Pitch nose down
- **Space**: Fire tracer rounds. Clicking game buttons does not keep keyboard focus;
  Space remains gunfire during flight. Use Enter to activate a keyboard-focused minimap.
- **G**: Toggle Mirage landing gear in flight
- **P**: Open/close settings and pause/resume
- **C**: Cycle camera mode between chase, cockpit, and orbit
- **Hold M**: Show the full regional map; release to close
- **Click/tap radar**: Keep the map open; close with **×** or **Escape**

In orbit camera mode:

- **Left-click + drag**: Rotate around the plane
- **Right-click + drag**: Pan
- **Scroll**: Zoom

## Flight Notes

### Takeoff

1. Increase thrust with **W**.
2. Build enough runway speed.
3. Pitch up gently with **Arrow Down**.
4. Keep climb angle moderate so the plane does not lose too much speed.

### Flying

- The plane follows its nose direction more naturally when climbing or diving.
- Banking changes turn behavior, while rudder provides yaw control.
- Gravity affects speed: climbing costs speed, diving can gain speed.
- Low speed or high pitch can trigger stall behavior.

### Landing

1. Reduce thrust with **S**.
2. Descend gradually.
3. Keep the plane mostly level near the runway.
4. Avoid hard sink rates or steep pitch/roll angles on touchdown.

## Testing

Run unit tests:

```bash
npm test
```

Run linting and type checks:

```bash
npm run lint
npm run typecheck
```

Check formatting:

```bash
npm run format:check
```

Format the project:

```bash
npm run format
```

Install the browser once, then run visual regression tests:

```bash
npx playwright install chromium
npm run test:visual
```

Update visual baselines after intentional visual changes:

```bash
npm run test:visual:update
```

## Project Structure

```text
src/
  aircraft/     Procedural light aircraft and Mirage models
  flight/       Physics, controls, metrics and simulation clock
  scenery/      Geography, terrain, surfaces and airfield objects
  rendering/    Scene, cameras, quality and instancing
  effects/      Clouds, water, Mach transition and tracers
  audio/        Flight audio and sonic boom
  ui/           Mission selection, settings, HUD and styles
  map/          Cartography, minimap, full map and destinations
  automation/   Machine flight control and screenshot scenarios
  main.js       Application setup and game loop
scripts/
  scenery/      Offline map/elevation download and import tools
  flight/       Flight validation, planning and performance tools
  capture/      In-game preview capture
data/          Each region has map.json, elevation.json and cache/
tests/
  fixtures/     Deterministic flight data
  visual/       Browser tests and screenshot baselines
public/        Audio, icons, scenario previews and app manifest
note/          Ignored working notes and screenshots
```

Unit tests stay beside the modules they exercise. Run scripts from the repository
root. `dist/`, `test-results/` and dependency folders are generated and ignored;
original source caches and regression screenshot baselines are intentionally kept.


- `src/main.js`: App setup, render loop, and scene wiring
- `src/aircraft/airplane.js`: Procedural airplane model and animated control surfaces
- `src/flight/physics.js`: Light-aircraft physics and shared plane state
- `src/aircraft/mirage.js`, `src/flight/jetPhysics.js`, `src/flight/jetAttitude.js`: Jet model and handling
- `src/ui/missions.js`: Scenario picker and mission definitions
- `src/ui/experience.js`, `src/flight/jetControls.js`: Settings, guides and throttle/gear controls
- `src/map/worldMap.js`, `src/map/mapViewport.js`, `src/map/destination.js`: Full map and destination
- `src/scenery/groundDetail.js`: Nearby road/runway surfaces and tile cache
- `src/rendering/camera.js`: Chase, cockpit, and orbit camera handling
- `src/ui/hud.js`: Flight data HUD
- `src/ui/cockpitOverlay.js`: Cockpit instrument overlay
- `src/map/minimap.js`: Radar/minimap rendering
- `src/effects/machineGun.js`: Tracer firing behavior
- `src/scenery/terrain.js`: Geographic scenery and batched buildings/trees
- `src/scenery/geography.js`: Shared projection, terrain heights, runway and collision queries
- `data/`: Local scenery, elevation and download cache
- `src/effects/clouds.js`: Procedural clouds
- `src/ui/warnings.js`: Flight warning logic
- `tests/visual/`: Playwright visual regression tests and baselines

## Customization

The aircraft uses procedural Three.js geometry. The world combines cached OSM
footprints and land cover, real elevation, and generated building/tree meshes.

To change the plane model, edit:

```text
src/aircraft/airplane.js  # Light aircraft
src/aircraft/mirage.js    # Mirage 2000
```

To change flight behavior, edit:

```text
src/flight/physics.js     # Light aircraft
src/flight/jetPhysics.js  # Mirage 2000
```

To add larger world objects such as buildings or future targets, start with:

```text
src/scenery/terrain.js
```

## Asset Conventions

The app generates aircraft, building, tree, and cloud meshes in Three.js.
Geographic source data and processed scenery live in `data/`; the build packages
the processed map, elevation, and attribution files for local loading.

Runtime assets live in `public/audio/`, `public/icons/` and `public/previews/`.
Aircraft and scenery models are procedural; there are no external model or texture
folders until those assets are needed. Reference public assets using
`import.meta.env.BASE_URL` so deployment under `/3d-plane/` works.

## Deployment

This project can be deployed as a static site with GitHub Pages.

For a repository page at:

```text
https://sinataghva.github.io/3d-plane/
```

Vite should be configured with:

```js
base: '/3d-plane/';
```

Then a GitHub Actions workflow can build the app with `npm run build` and publish the `dist/` directory to GitHub Pages.

## Technologies Used

- Three.js
- Vite
- JavaScript
- HTML
- CSS
- Vitest
- Playwright

## Machine / agent controls

Open `/3d-plane/?automation=1` to opt into machine control. The simulation
starts paused, with a visible **Take control** button. Normal URLs retain
keyboard/touch play and do not expose the automation API.

Supporting browsers discover nine WebMCP tools: `get_flight_state`,
`set_flight_controls`, `step_flight`, `fly_flight`, `fly_route`,
`resume_flight`, `pause_flight`, `reset_flight`, and `release_flight`.
No HTTP API, server, credentials, or extra dependencies are needed.
If WebMCP is unavailable, the same API is available as `window.planeAutomation`.

```js
const flight = window.planeAutomation;
flight.setControls({ throttle: 1 }); // instant full throttle
flight.step({ seconds: 1 });
flight.setControls({ pitch: 0.3 });
flight.step({ seconds: 0.75 });
flight.setControls({ pitch: 0 });
flight.step({ seconds: 3 }); // airborne beyond the runway
flight.getState();
// flight.reset();   // paused, zero throttle, back at the runway
// flight.release(); // resume real time under keyboard/touch control
```

Throttle is 0–1. Pitch, roll, and rudder are -1–1: positive means nose up,
bank right, and yaw right respectively. `fire` is a boolean. Partial commands
preserve unspecified controls; inputs persist until changed. Invalid values
are rejected before any changes are applied.

`step` advances the existing physics at 60 Hz for 1/60–10 simulated seconds,
rounded to the nearest tick, and stops early on a crash. Telemetry includes
simulation time, a detached copy of plane state and controls, altitude in
meters and the HUD speed in km/h. No simulation time passes between calls.
Reset explicitly after a crash. Release preserves throttle but clears machine
steering/fire; reload the automation URL to regain machine ownership.

For a visible demonstration, use `await flight.fly({ seconds: 3 })` (WebMCP:
`fly_flight`) instead of `step`. It renders flight in real time using the same
60 Hz simulation, then pauses for the next command. Other step/fly/reset
commands are rejected while it runs; controls can be adjusted and **Take
control** interrupts machine advancement. Hidden tabs can delay animation.

For ongoing flight, call `flight.resume()` / `resume_flight`. It continues
between tool calls; `setControls` changes inputs while flying. Call
`flight.pause()` / `pause_flight` to stop continuous advancement. Crashes
automatically pause it. Keyboard/touch still require **Take control**.

For uninterrupted demonstrations with precise timing, call
`flight.flyRoute({ stages: [{ seconds: 1, controls: { throttle: 1 } }, ...] })`
or `fly_route`. Stages execute back-to-back in real time without tool latency
between them. Limits: 1–360 stages, up to 10 seconds each, 180 seconds total.
The whole route is validated first and stops on a crash or human takeover.

The WebMCP `fly_route` command starts in the background and returns immediately
to avoid browser-tool timeouts. Read `get_flight_state` for `routeStatus`
(`running`, `completed`, `crashed`, `released`, or `failed`) and `routeError`.
JavaScript callers can use `startRoute` for the same behavior or await `flyRoute`.

## Rendering performance

Open the settings icon, then use **Graphics**; the choice is saved locally.
High (default) caps pixel ratio at 2 and uses 2048px shadows. Balanced caps it
at 1.5 with 1024px shadows. Low caps it at 1 and disables shadows. Standard-DPI
screens keep their native resolution. Settings update without restarting.

Trees share geometry/materials in spatial instancing batches, preserving culling
of off-screen regions. Soft cloud billboards share one instanced draw call; wind
is applied in the shader without per-frame instance uploads. The HUD updates at 10 Hz
and radar at 15 Hz, while cameras, cockpit instruments and flight animation
follow the browser frame rate. Automation substeps no longer submit duplicate
render frames. Flight physics and automatic wing leveling are unchanged.

## Simulation timing and inputs

Keyboard/touch play advances the same 60 Hz physics ticks as automation,
independently of rendering refresh rate. Existing automatic wing leveling and
60 Hz flight tuning are preserved. Frames longer than 250 ms have bounded
catch-up, and hidden-page transitions clear leftover fractional time.

The vertical-speed instrument, flight condition labels, terrain warnings, and
agent telemetry include both the lift/gravity component and pitch-directed
vertical movement. HUD, cockpit and telemetry share the same display units;
stall warnings account for the same flap reduction used by physics. Heading
wraps to 000–359 through repeated turns.

Losing window focus or hiding the page releases held keyboard and touch input.
Touch cancellation/lost capture also releases controls; multiple fingers and
keyboard/touch presses no longer cancel each other prematurely. Camera cycling
ignores key repeat, and flight keys leave focused form controls alone.

### Flight experience

Free flight is the default. The Guide menu offers dismissible takeoff tips,
landing help, and optional circuit challenges: Saint-Cyr asks for a climb to
50 m and a full turn before landing in the takeoff direction; Luxeuil uses four
waypoints above 150 m AGL. There is no timer or forced
landing. Collapsible controls leave more room for the view.

The settings menu pauses flight and provides camera, guide, graphics and time-of-day
dropdowns, sound controls, and restart/change-flight buttons. Its compact grid fits
desktop and mobile screens, including phone landscape safe margins. The touch throttle slider sets thrust directly, including immediate
100%. Using pause, restart, or the slider takes control from an automation flight.
Crashes now wait for **Return to runway**; feedback explains excessive descent or
attitude. Successful touchdowns report runway/off-field location and descent rate.
The chase camera eases its position while cockpit view follows the aircraft bank.
Grass runway markings and edge boards help alignment; roads, field boundaries,
and woodland provide geographic landmarks and motion cues.

Hold **M** to view the full-screen, north-up world map; release it to close.
Click or tap the radar to keep the map open, then use **×** (or Escape) to close.
The map keeps fixed world bounds while the aircraft icon tracks position and
heading live. Flight continues while viewing the map. Outside the mapped terrain,
the icon stays at the map edge and the position readout indicates this explicitly.

### Clouds and wind

Cloud banks cover the whole region and continue beyond the detailed map. Varied
cumulus banks sit roughly 420–1,100 m above the airfield datum, with sparse,
stretched high clouds above them. Locally generated soft silhouettes replace the
old faceted spheres and straight cloud strips; no cloud images are downloaded.

A light westerly wind moves the clouds 3 m/s east and 1 m/s north. This is visual
weather and does not change aircraft handling. Clouds fade into the distance and
wrap outside visibility, so long flights do not exhaust the cloud field. Pause
freezes their movement; visual regression fixtures use a fixed cloud state.

## Experience development and automation

`src/ui/missions.js` defines experiences; `src/aircraft/mirage.js` creates the jet, and
`src/flight/jetPhysics.js` implements its handling. Use `?mission=luxeuil&automation=1`
for opt-in machine control. `setControls` accepts `boost`, `gearDown`, and
`airbrake` booleans in addition to the existing inputs. Hold boost with
`{throttle: 1, boost: true}` and release with `{boost: false}`. Pausing, human
takeover, reset, focus loss, or the end of a bounded animated flight clears boost.
Telemetry includes `plane.aircraft`, `plane.mission`, engine power and gear state.

To regenerate the selection artwork, run the dev server on port 5174 and then
`node scripts/capture/capture-previews.mjs`. It captures the actual local scene with the
HUD hidden at 2× pixel density. Pass `luxeuil` or `saint-cyr` to capture only
one card; `PREVIEW_ORIGIN` overrides the default `http://127.0.0.1:5174`.
Artwork is stored in `public/previews/` and uses the same map credits.
Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:visual` and
`npm run build` locally before pushing. GitHub Actions only builds and deploys.

### Custom destination

Open the full map by holding **M** or clicking/tapping the minimap. Click or tap
inside the mapped terrain to choose one destination. A red pin appears on both
maps and a red terrain-anchored beacon appears in the world, with a distance
label and an edge arrow when off screen. Click elsewhere to replace it. Closing
the map keeps it active; **Clear destination**, restart, or changing flights
removes it. Reaching it never forces a landing or changes your controls.

The full map supports zoom and pan: scroll down to zoom in, up to zoom out;
click and drag to pan. On touchscreens, pinch to zoom and drag with one finger.
The +/− buttons change zoom by 20 percentage points, and **Fit map** resets zoom and pan. Zoom cannot go
below the whole-region view or above **400% (4×)**. Zoom/pan persist when closing the map;
restart or changing missions resets them. Dragging and pinching never place a
destination. Short clicks/taps still select accurately at the current zoom.

### Ground surface detail

Nearby roads, taxiways and runways now use separate terrain-aligned geometry.
Luxeuil has sharp runway edges, centre lines, threshold stripes and numbers;
Saint-Cyr retains grass strips with sparse boundary indicators. Markings are
stylized from cached map geometry and runway references. Asphalt/grass grain
and restrained tyre wear are generated locally; there are no new image downloads.

| Preset   | Nearby ground detail                                                  | Maximum requested tiles |
| -------- | --------------------------------------------------------------------- | ----------------------- |
| Low      | Regional texture only                                                 | 0                       |
| Balanced | Road/runway surfaces and crisp markings within 850 m; simple grain    | 20                      |
| High     | Detail within 1,700 m; finer grain, subtle bump shading and tyre wear | 48                      |

Distance includes altitude. Detail fades through the outer 40% of the range and
blends over time. A shared pool keeps at most 80 cached tiles, building at most
two per frame. Recently used tiles remain available beyond the activation
range to avoid rebuilding when crossing a boundary. The original physics and
collision terrain remain authoritative. Distant fields and forests still use
the regional texture; this is a focused road/runway upgrade, not satellite scenery.

For local comparative measurements, run `node scripts/flight/benchmark-ground.mjs current`
with the dev server running. Results and ground screenshots go into
`test-results/ground-benchmark/`. Headless software-rendered timings are not
representative of native GPU performance.

### iPhone / mobile Home Screen

Use Safari's Share menu → **Add to Home Screen** to launch Open Skies without
Safari's address bar. The app includes its own aircraft icon and a standalone
web manifest. Network access is still needed to load the app: offline caching
is not included. Re-add an older shortcut if iOS retains its old icon/settings.

Mobile flight uses a compact Flight Data panel; tap **Flight details** for the
secondary instruments. The smaller radar still rotates with heading and opens
the full map on tap. Game surfaces suppress text selection, long-press callouts
and browser zoom gestures while the map retains its own pinch zoom. Safe-area
padding keeps touch controls away from the notch and home indicator. The scenario
picker, settings button/dialog, and full-screen map also leave space inside the
iPhone safe areas, including landscape and Home Screen layouts. Desktop
Flight Data is unchanged; radar headings are removed on both layouts.

### Audio

Both aircraft have locally bundled CC0 engine sounds and firing effects, with generated wind, afterburner, gear motion, and touchdown audio. Engine pitch and volume follow power; cockpit view muffles exterior sound. Settings → Sound provides saved mute and volume controls. Audio starts after a user gesture and stops while paused or in the background.

The Mirage gives a brief vapor-cone effect and procedural sonic-boom cue when
accelerating through Mach 1. The cone fades after 1.4 seconds and is hidden in
cockpit view; cockpit audio remains muffled. The trigger re-arms below Mach 0.96
after a six-second cooldown, preventing repeated booms near the threshold. These
are stylized gameplay cues, not a simulation of atmospheric condensation or
sound propagation to ground observers.

See the [audio credits and listening checklist](public/audio/README.md) for every sound, its source, and how to trigger it individually.

### Nearby railways and water

Both regions now share the road-detail tile budget with railway and water surfaces.
Balanced shows ballast, rails, and sharp water geometry; High adds repeating
rail sleepers and finer gravel. Low keeps the lightweight regional map texture.
Nearby detail fades with distance and altitude; no more than 80 tiles are cached,
with up to two built per frame and a time check before starting the second tile.

Rivers, streams, canals, lakes and ponds use separate surfaces, preserving polygon
islands. Mapped tunnels, culverts, covered channels and inactive railway sections
are excluded from surface detail. Existing water polygons take precedence over
centreline detail. Stream widths are estimated by type when absent from OSM.
Bridges use approximate endpoint elevations; detailed bridge structures are not
modeled. Narrow shoreline heights remain limited by the regional elevation grid.

Surface waterways participate in water-landing detection; covered channels do not.
Water shading follows the graphics preset:

- **Low:** the static regional map, prioritizing rendering speed.
- **Balanced:** gentle animated ripples and soft sunlight highlights.
- **High:** two ripple layers, subtle moving color variation and richer highlights.

Lakes and canals are calmer than rivers; narrow or intermittent streams use weaker
effects. Fine ripples fade with viewing distance to reduce shimmering. Motion is
wind-driven decoration, not a simulation of downstream currents. Highlights come
from the scene's sun; water does not mirror aircraft or buildings. The effect adds
no reflection render pass or extra surface draw calls and uses one shared 128×128
procedural texture. Animation freezes while paused or in the background and resets
with the flight. Surface geometry, shorelines and collision heights stay unchanged.

All data comes from the existing local caches; no new downloads were needed. See [scenery data notes](data/README.md) for reproduction and attribution.

### Airfield scenery

Saint-Cyr retains its grass runways and modest aeroclub character, with pale
hangars, sliding-door panels and upper windows. Luxeuil uses larger utilitarian
hangars, rounded shelter roofs and its mapped control tower. Buildings follow
cached OpenStreetMap footprints and existing height estimates; facade colors,
doors and roof profiles are stylized, not surveyed architectural reproductions.
No new building locations are invented. Parked aircraft and service vehicles are separate fictional scenery, as described below.

Nearby mapped aprons now have crisp terrain-aligned surfaces. Explicit grass,
asphalt and concrete tags take precedence over mission defaults, including
Saint-Cyr's mix of grass and paved taxiways. Unspecified surfaces use paved
Luxeuil taxiways and aprons, and grass Saint-Cyr taxiways. Yellow centerlines
follow mapped paved taxiway lines; they are illustrative markings, not surveyed
paint layouts. Grass runway boards remain at Saint-Cyr. Luxeuil's mapped
landing-light row has simple unlit-in-daylight fixture geometry with a bright
material; it does not add dynamic lights or a complete night-lighting system.

Building detail shares the existing spatial batches on every graphics preset.
Apron and taxiway detail uses the same Balanced/High distance ranges and bounded
tile cache as roads; Low keeps the regional ground texture. All data is local,
and the additional aviation tags were restored from the preserved source caches.


### Parked aircraft

Saint-Cyr has eight parked light aircraft on suitable mapped apron areas,
including grass parking. Luxeuil has twelve parked Mirage 2000s on mapped aprons.
These are fictional decorative placements, not a representation of present-day
base inventories or operations. They reuse the game aircraft models with engines
off, stationary propellers and landing gear down; they have no separate audio,
flight simulation or collision bodies.

Placement is reproducible and keeps the aircraft envelope inside each apron,
outside holes, clear of buildings, roads, runway/taxiway corridors and the departure
spawn. Steep ground and crowded areas are skipped. One shared baked mesh per
mission is instanced in spatial batches, with visibility ranges of 700 m on Low,
1,400 m on Balanced and 2,500 m on High. No external models or textures are loaded.


### Service vehicles

Five parked service vehicles at Saint-Cyr and twelve at Luxeuil add activity to
mapped aprons. The fleet includes vans, towing tugs and fuel trucks, with civilian
white/blue paint at Saint-Cyr and muted military colors at Luxeuil. These original
procedural models are fictional scenery, not a record of either airfield’s fleet.
They are stationary, with no engines, audio or collision bodies.

Placement shares the apron, building, route and slope checks used for parked
aircraft, and also reserves clearance around every parked aircraft. Vehicles use
at most three instanced draw calls per mission and visibility ranges of 500 m on
Low, 1,000 m on Balanced and 1,800 m on High. No external assets or network data
are needed.

The bottom-left FPS counter shows rendered frames per second, averaged over half
a second. It resets after switching tabs and does not cap high-refresh displays.
A stable 60 FPS is the target on a 60 Hz screen; simulation ticks remain separate.


### Time of day

In Settings, choose **Day**, **Sunset** or **Night**. Day is the default;
your choice is saved on this device and applies to both scenarios. Changing
the setting updates the lighting immediately without restarting the flight.

Sunset and Night include decorative runway edge and threshold lights.
These are navigation aids for the game, not surveyed lighting installations
or a claim that Saint-Cyr supports real night operations. All graphics presets
use the same time choices; the existing quality setting controls shadow detail.
