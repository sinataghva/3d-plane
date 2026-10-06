# Open Skies

An arcade-style 3D flight simulator for your browser, built with Three.js and Vite. Fly a light aircraft over Saint-Cyr and Versailles, a Mirage 2000 around Luxeuil, or an IIAF-liveried F-4 Phantom over Tehran and Mehrabad.

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
| Aircraft action | **Space** | Smoke, Fire, or Drop bomb button |

The aircraft action toggles blue smoke at Saint-Cyr, fires the Mirage cannon while held, or drops one bomb per press in the F-4. See the [full flight guide](docs/full-reference.md#controls) for handling, landing, map, photo mode, and mobile details. The simulator uses stylized arcade physics and is not real-world flight guidance.

## Run locally

Use Node.js 24 and npm:

```bash
npm ci
npm start
```

Open [http://127.0.0.1:5173/3d-plane/](http://127.0.0.1:5173/3d-plane/). The `/3d-plane/` path is part of the Vite configuration.

Build and preview the production site with `npm run build` and `npm run preview`; preview runs at [http://127.0.0.1:4173/3d-plane/](http://127.0.0.1:4173/3d-plane/).

## Golden Crown model study

With the development server running, open [the F-5E model preview](http://127.0.0.1:5173/3d-plane/golden-crown.html). Drag to orbit, scroll to zoom, choose side, upper, or underside views, or toggle the landing gear. The procedural Three.js model lives in `src/aircraft/goldenCrown.js`; it is a visual prototype and is not yet a selectable flight. This development-only preview is not included in the production build.

The airframe is refined against [USAF F-5E photographs](https://commons.wikimedia.org/wiki/File:Northrop_F-5E_(SN_72-01401)_061006-F-1234S-066.jpg). The livery is an original interpretation informed by user-supplied Golden Crown plan and model images (using the HA3397 multi-view sheet for the distinct upper/lower paint and English/Persian side markings), [IIAF historical photographs](https://commons.wikimedia.org/wiki/File:6_Imperial_Iranian_Air_Force_F-5Es_in_an_arobatic_exhibit.jpg) and [Fred Shammas's Golden Crown F-5E model](https://www.arcair.com/Gal3/2301-2400/Gal2339-F-5-Shammas/00.shtm). Geometry and paint are procedural. The Pahlavi crown decal uses the supplied reference artwork; its source note is in `public/textures/golden-crown/README.md`.

## What is included

- Three aircraft and three cached geographic regions, with procedural scenery and local map assets.
- Chase, cockpit, and orbit cameras; flight instruments; a radar and a zoomable regional map.
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
