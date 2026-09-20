# Project guidance

## Public repository

This is a public, open-source repository. Treat everything committed as publicly
visible. Before committing, inspect the staged diff and file list for secrets,
credentials, tokens, private information, machine-specific paths, and unintended
artifacts. Never commit those items. Preserve source credits and license notices.
Do not commit or push unless the user requests it.

Keep temporary plans, session notes, and working decisions in the ignored
`note/` directory. Keep durable, user-facing documentation in README files.
This file contains shared project guidance and is intended to be tracked.

## Project structure

Open Skies is a Three.js/Vite browser flight simulator with two experiences:
Saint-Cyr/Versailles with a light aircraft and Luxeuil with a Mirage 2000.
Read `README.md` for current controls, setup, map sources, and automation APIs.

- `src/main.js`: application setup and simulation/render loop.
- `src/ui/missions.js`: scenario selection and mission definitions.
- `src/flight/physics.js`, `src/aircraft/airplane.js`: light aircraft and shared state.
- `src/flight/jetPhysics.js`, `src/flight/jetAttitude.js`, `src/aircraft/mirage.js`: jet handling/model.
- `src/scenery/geography.js`, `src/scenery/terrain.js`, `src/scenery/groundDetail.js`: scenery and surfaces.
- `src/flight/input.js`, `src/ui/experience.js`, `src/flight/jetControls.js`: flight controls/UI.
- `src/map/worldMap.js`, `src/map/mapViewport.js`, `src/map/destination.js`: map/navigation.
- `data/`: processed scenery and preserved source caches.

Reuse cached geographic data; do not repeatedly download existing source layers.
Gameplay should load local map assets without third-party map API calls.
Respect the Vite `/3d-plane/` base path when referencing assets.

## Changes and validation

Preserve existing user changes. Keep mobile-only requests scoped to mobile;
do not change desktop layout or behavior unless requested. Check touch controls
and responsive layouts when changing UI. Browser emulation does not establish
that native iOS Safari or Home Screen behavior is correct; report that limitation.

Use Node.js 24, matching deployment. For code changes, run relevant tests plus:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

For rendering, layout, or input changes, run the affected Playwright tests in
`tests/visual/` and inspect screenshots. Install Chromium with
`npx playwright install chromium` if needed. Update screenshot baselines only
for intentional visual changes, after reviewing the results. Documentation-only
changes do not require the full test suite.

Keep generated test output and build artifacts out of commits. Run checks locally;
GitHub Actions is intentionally limited to building and deploying, without added
lint/test jobs. Check staged contents again before an authorized commit.
