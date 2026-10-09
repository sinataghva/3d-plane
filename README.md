# Open Skies

An arcade-style 3D flight simulator for your browser, built with Three.js and Vite. Fly a light aircraft over Saint-Cyr and Versailles, a Mirage 2000 around Luxeuil, or an IIAF-liveried F-4 Phantom over Tehran and Mehrabad, where you can also take command of the Golden Crown F-5 team.

## Play now

**[Launch Open Skies](https://sinataghva.github.io/3d-plane/)** — choose a flight and press **Fly**. Free flight is the default; guides and landing challenges are optional. On a phone, fly in landscape orientation.

## Basic controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Thrust | **W / S** | Throttle slider |
| Bank | **← / →** | Flight stick |
| Pitch up / down | **↓ / ↑** | Flight stick |
| Rudder | **A / D** | Touch controls |
| Camera | **C** | Camera button |
| Map | Hold **M** or select the radar | Tap the radar |
| Settings and pause | **P** | Settings button |
| Jet landing gear | **G** | Gear button |
| Aircraft action | **Space** | Smoke, Fire, Drop bomb, or Maneuver button |

The aircraft action toggles blue smoke at Saint-Cyr, fires the Mirage cannon while held, drops one bomb per press in the F-4, or commands formation maneuvers while leading Golden Crown. See the [full flight guide](docs/full-reference.md#controls) for handling, landing, map, photo mode, and mobile details. The simulator uses stylized arcade physics and is not real-world flight guidance.

## Run locally

Use Node.js 24 and npm:

```bash
npm ci
npm start
```

Open [http://127.0.0.1:5173/3d-plane/](http://127.0.0.1:5173/3d-plane/). The `/3d-plane/` path is part of the Vite configuration.

Build and preview the production site with `npm run build` and `npm run preview`; preview runs at [http://127.0.0.1:4173/3d-plane/](http://127.0.0.1:4173/3d-plane/).

## Golden Crown model study

Open the standalone [F-5E garage](https://sinataghva.github.io/3d-plane/golden-crown.html), or [preview it locally](http://127.0.0.1:5173/3d-plane/golden-crown.html) with the development server running. Drag to orbit, scroll to zoom, choose side, upper, or underside views, toggle the landing gear, or select aircraft 1–6 to inspect both English and Persian tail numbers. The procedural Three.js model lives in `src/aircraft/goldenCrown.js`; it is shared by the ambient show and playable leader flight inside the Mehrabad scenario. The garage is included in the production build at its own shareable URL; it is not linked from the game menu.

The airframe is refined against [USAF F-5E photographs](<https://commons.wikimedia.org/wiki/File:Northrop_F-5E_(SN_72-01401)_061006-F-1234S-066.jpg>). The livery is an original interpretation informed by user-supplied Golden Crown plan and model images (using the HA3397 multi-view sheet for the distinct upper/lower paint and English/Persian side markings), [IIAF historical photographs](https://commons.wikimedia.org/wiki/File:6_Imperial_Iranian_Air_Force_F-5Es_in_an_arobatic_exhibit.jpg) and [Fred Shammas's Golden Crown F-5E model](https://www.arcair.com/Gal3/2301-2400/Gal2339-F-5-Shammas/00.shtm). Geometry and paint are procedural. The Pahlavi crown decal uses the supplied reference artwork; its source note is in `public/textures/golden-crown/README.md`.

## Fly Golden Crown at Mehrabad

The Tehran F-4 mission includes six Golden Crown F-5Es with individual tail numbers and matching serials from the supplied decal reference: 1 → 3-7099, 2 → 3-7015, 3 → 3-7046, 4 → 3-7078, 5 → 3-7079, 6 → 3-7136. Serials use Latin digits on the English side and Persian digits on the Persian side. Their four-minute, continuously looping routine includes a formation arrival, coordinated turn, mirrored solo looping breaks with outward exits, opposed 360° rolls by two of the core four while the other two fly level, upright/inverted solo pair, rejoin, gear-down pass with lights, and departure. Smoke follows each aircraft's recent path as continuous, soft-edged trails that stay attached to the exhausts, widen, and fade with age. The default stylized smoke uses green on the left, white in the centre and red on the right (two jets per colour); choose **Smoke → White** in review for neutral smoke. The flag-colour smoke is an artistic addition, not a historical claim. Choreography is inspired by the [Manoto Golden Crown documentary](https://www.youtube.com/watch?v=1umNa1gHjb4&t=2214s) and supplied archival stills; timing, spacing and routes are authored for the game, not an exact historical reconstruction.

Choose **Fly Golden Crown** in the Mehrabad flight to take control of leader **#1 at its current position and speed**. The same five wingmen follow you; solos already performing a maneuver finish it and then rejoin. There is no separate main-menu scenario or player-facing video timeline.

- **Space** releases the two solos when the formation is settled, level, and at a suitable speed/altitude. While they are away, each fresh press commands one full outward opposed roll by two core wingmen (left counterclockwise, right clockwise when viewed from behind), about **2.5 seconds** per roll. Each roll follows a continuous shallow arc: the pair rise as they rotate, then descend through the second half and meet formation altitude as the rotation finishes. Another press queues another roll; holding Space does not repeat it. Mobile has a **Maneuver** button and a speed slider.
- **W/S** changes the F-5's target speed; arrows and **A/D** retain pitch, bank, and rudder controls. **C** cycles chase, cockpit, and orbit views, with a temporary camera-view toast in F-5 mode (also shown when using the mobile camera button). Temporary toasts explain when to hold steady or adjust speed. Every rejected Space press or maneuver tap shows the current blocking reason again, even if its earlier toast has faded. Temporary prompts explain when to press **Space** for maneuvers; no permanent desktop maneuver button is shown. On mobile, the maneuver action replaces bomb/fire. A **Return to F-4** button beside the camera controls returns control to the Phantom. **Fly Golden Crown** uses the same position, and Photo mode remains available while flying the F-5. The radar and world map show all six Golden Crown aircraft in both F-4 and F-5 modes; the radar follows the controlled aircraft at the usual jet scale. The large yellow marker always represents the F-4, and the six small blue markers represent the F-5s. Radar and Flight Data keep the same positions in both modes. Smoke is always on for all six aircraft; Space never toggles it.
- Solos automatically intercept your moving formation. Keep a reasonable speed and heading to help them return. New rolls are unavailable once solos start rejoining; accepted rolls finish before the solos close into their slots.
- **Return to F-4** restores control of the F-4 wherever it has reached. An unattended airborne F-4 maintains its handoff speed and direction, with terrain/obstacle checks; a parked F-4 stays parked. The same F-5 team regroups and flies a connecting leg back into its scripted show, without teleporting. You can take control again during that return.

The F-5 uses arcade aerobatic handling with bounded follower acceleration and catch-up speed. It is an airborne leader experience; coordinated takeoffs/landings, guidance gates, actual-flight replay, and video export are not included. Local terrain detail follows the controlled aircraft. Aircraft geometry/materials are shared and batched; smoke keeps a bounded history across control handoffs and has fewer samples on low graphics quality. Clouds and smoke share camera-depth layers. Settings/photo pause and a hidden tab pause the active simulation. Native phone performance still requires device testing.

### Development / filming viewer

With the development server running, [the dedicated display review URL](http://127.0.0.1:5173/3d-plane/?mission=tehran&goldenCrown=review) retains the scripted viewer: play/pause, seeking, one-second stepping, maneuver selection, aerial/solo/ground views, white or tricolour smoke, and collapsible controls. It starts paused and holds the F-4 while reviewing. This viewer has no entry in the normal game UI; its code is excluded from production, where the legacy query parameter does not enable it.

## What is included

- Three cached geographic regions with procedural scenery and local assets; three starting aircraft plus the playable Golden Crown F-5 team in Tehran.
- Chase, cockpit, and orbit cameras (orbit zooms out to 300 m); flight instruments; a radar and a zoomable regional map.
- Optional guides, circuits, destinations, photo mode, graphics presets, and time-of-day settings.
- An opt-in [automation interface](docs/full-reference.md#machine--agent-controls) for scripted flight and browser testing.

Gameplay loads processed map and elevation files from this site. It does not call third-party map APIs. The site does not provide offline caching.

## Development

The application starts in `src/main.js`. Scenario definitions are in `src/ui/missions.js`; flight behavior is in `src/flight/`; scenery and maps are in `src/scenery/` and `src/map/`. Local geographic data and preserved source caches are in `data/`.

For code changes, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm run test:visual` for affected rendering, layout, or input changes. See the [full reference](docs/full-reference.md#testing) for Playwright setup, project structure, automation, and implementation notes. GitHub Actions builds and deploys the site to GitHub Pages from `main`.

## Further reading

- [Full flight and development reference](docs/full-reference.md)
- [Geographic data, reproduction, and attribution](data/README.md)
- [Saint-Cyr](data/saint-cyr/README.md), [Luxeuil](data/luxeuil/README.md), and [Tehran](data/tehran/README.md) regional notes
- [Tehran landmarks](data/tehran/LANDMARKS.md) and [map detail](data/tehran/MAP-DETAIL.md)
- [Audio sources and listening checklist](public/audio/README.md)

## Map and terrain credits

Geographic scenery uses **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)** data under the **Open Database License (ODbL 1.0)**. The simplified derived databases for [Saint-Cyr](data/saint-cyr/map.json), [Luxeuil](data/luxeuil/map.json), and [Tehran](data/tehran/map.json) are distributed with this project. [Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) supplied the source extracts during data preparation.

Elevation comes from [Mapzen / Tilezen Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), whose providers include Copernicus / European Union EU-DEM and the U.S. Geological Survey. Provider-specific notices and licenses are preserved in [terrain-attribution.md](data/terrain-attribution.md). Original downloads and source manifests remain in each region's `cache/` directory. See the [complete source credits](docs/full-reference.md#map-and-terrain-credits).
