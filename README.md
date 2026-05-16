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
