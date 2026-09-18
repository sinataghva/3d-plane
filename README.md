# 3D Plane — Saint-Cyr & Versailles

An educational browser-based 3D airplane simulator built with Three.js and Vite.

Take off from Saint-Cyr-l’École airfield, explore the Palace of Versailles and its gardens, and fly over nearby towns in a real-world-inspired landscape. The simulator combines a procedural Cessna-style aircraft, arcade flight physics, three camera modes, live instruments, radar, and a full-screen regional map. Free flight is the default; guides and landing challenges are optional.

## Features

- Procedural high-wing airplane model inspired by a small Cessna-style aircraft
- Arcade flight physics with thrust, lift, gravity, stalls, banking, rudder, and landing behavior
- Animated propeller and animated control surfaces for ailerons, elevator, rudder, and automatic flaps
- Chase, cockpit, and orbit camera modes
- Live flight HUD with speed, altitude, thrust, heading, pitch, roll, vertical speed, and energy state
- Cockpit overlay with analog-style attitude instrument
- Heading-up radar/minimap centered on the plane
- Warning banners for low altitude, stall risk, and crash states
- Crash handling with visual feedback and restart flow
- Machine-gun tracer fire with space bar
- Saint-Cyr–Versailles scenery from cached OpenStreetMap geometry and regional elevation
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

All source downloads are cached in `data/cache/`. Normal play and builds use
only local `data/saint-cyr.json` and `data/saint-cyr-elevation.json`; no API token
or runtime Overpass/elevation connection is needed. Existing cached layers are
reused. To reproduce the scenery from the cache:

```bash
python3 scripts/download-scenery.py
python3 scripts/import-osm.py data/cache/osm.json.gz
python3 scripts/import-elevation.py
```

The elevation import requires Python Pillow. The downloader fetches only missing
source layers; preserve the cache to avoid repeated requests to public services.
`node scripts/plan-flight.mjs` generates a reproducible banked sightseeing flight
using the actual flight physics, ending back on the runway. It saves controls to
`data/scenic-tour.json` for local automation testing.

Buildings are simplified and heights are estimated where OSM has no height;
the palace is a stylized footprint-based model. Real elevation is resampled onto
a 129 × 129 grid, with runway corridors flattened for gameplay. This is coarse
regional relief, not a surveyed airfield. See [DECISIONS.md](DECISIONS.md) for
scope, tradeoffs, and validation results.

### Map and terrain credits

Thank you to the contributors and projects that make this scenery possible:

- **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** —
  airfield geometry, building footprints, roads, land cover, waterways, and place
  names. The map data is available under the **Open Database License (ODbL 1.0)**.
  Our simplified, projected [derived database](data/saint-cyr.json) is distributed
  with the project and linked from the in-game full map.
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

Original downloads are preserved in [data/cache/](data/cache/), with OSM source
snapshot timestamps and checksums in the [manifest](data/cache/manifest.json).
Source dates can differ between layers; this is a cached scenery snapshot,
not a live map. These data-source credits and licenses apply to the geographic
data separately from the application code.

## Getting Started

### Prerequisites

- Node.js
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
- **Space**: Fire tracer rounds
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

Run visual regression tests:

```bash
npm run test:visual
```

Update visual baselines after intentional visual changes:

```bash
npm run test:visual:update
```

## Project Structure

- `src/main.js`: App setup, render loop, and scene wiring
- `src/airplane.js`: Procedural airplane model and animated control surfaces
- `src/physics.js`: Arcade flight physics and plane state updates
- `src/camera.js`: Chase, cockpit, and orbit camera handling
- `src/hud.js`: Flight data HUD
- `src/cockpitOverlay.js`: Cockpit instrument overlay
- `src/minimap.js`: Radar/minimap rendering
- `src/machineGun.js`: Tracer firing behavior
- `src/terrain.js`: Geographic scenery and batched buildings/trees
- `src/geography.js`: Shared projection, terrain heights, runway and collision queries
- `data/`: Local scenery, elevation and download cache
- `src/clouds.js`: Procedural clouds
- `src/warnings.js`: Flight warning logic
- `tests/visual/`: Playwright visual regression tests and baselines

## Customization

The aircraft uses procedural Three.js geometry. The world combines cached OSM
footprints and land cover, real elevation, and generated building/tree meshes.

To change the plane model, edit:

```text
src/airplane.js
```

To change flight behavior, edit:

```text
src/physics.js
```

To add larger world objects such as buildings or future targets, start with:

```text
src/terrain.js
```

## Asset Conventions

The app generates aircraft, building, tree, and cloud meshes in Three.js.
Geographic source data and processed scenery live in `data/`; the build packages
the processed map, elevation, and attribution files for local loading.

Use these locations for future static assets:

- `public/models/` for `.glb` and `.gltf` model files
- `public/textures/` for image textures
- `src/assets/` for asset-loading utilities

Files in `public/` are served from the site root. For example:

```text
public/models/airplane.glb
```

should be loaded with:

```text
/models/airplane.glb
```

Use `loadGltfModel()` from `src/assets/modelLoader.js` for future GLTF/GLB loading.

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

Use the **Graphics** selector in the top right; the choice is saved locally.
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
landing help, and an optional circuit challenge (climb to 50 m, fly a full turn,
and land on the runway in the original direction). There is no timer or forced
landing. Collapsible controls leave more room for the view.

The flight toolbar provides camera, pause/resume, and restart controls on desktop
and mobile. The touch throttle slider sets thrust directly, including immediate
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
