# 3D Plane Model

An educational browser-based 3D airplane simulator built with Three.js and Vite.

The project started as a simple third-person airplane on a runway and now includes arcade flight physics, a procedural Cessna-style plane model, camera modes, live instruments, radar, warnings, crash handling, and tracer fire.

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
- Larger procedural world with runway, airfield elements, trees, clouds, sky, lighting, and atmosphere
- Unit tests and visual regression tests

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
http://127.0.0.1:5173
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
http://127.0.0.1:4173
```

## Controls

- **W / S**: Increase or decrease thrust
- **A / D**: Rudder left/right
- **Arrow Left / Arrow Right**: Bank and turn left/right
- **Arrow Down**: Pitch nose up
- **Arrow Up**: Pitch nose down
- **Space**: Fire tracer rounds
- **C**: Cycle camera mode between chase, cockpit, and orbit

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
- `src/airbase.js`: Runway, airfield, and world details
- `src/clouds.js`: Procedural clouds
- `src/warnings.js`: Flight warning logic
- `tests/visual/`: Playwright visual regression tests and baselines

## Customization

The airplane and world are currently built with procedural Three.js geometry.

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
src/airbase.js
```

## Asset Conventions

The app currently uses procedural Three.js geometry for the airplane, runway, trees, clouds, and airfield objects. Keep that as the default unless a future change intentionally swaps in model assets.

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
between them. Limits: 1–30 stages, up to 10 seconds each, 60 seconds total.
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

Trees and cloud puffs share geometry/materials and use spatial instancing
batches, preserving culling of off-screen regions. The HUD updates at 10 Hz
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
Runway markings and subtle tiled grass texture improve alignment and motion cues.

Hold **M** to view the full-screen, north-up world map; release it to close.
Click or tap the radar to keep the map open, then use **×** (or Escape) to close.
The map keeps fixed world bounds while the aircraft icon tracks position and
heading live. Flight continues while viewing the map. Outside the mapped terrain,
the icon stays at the map edge and the position readout indicates this explicitly.
