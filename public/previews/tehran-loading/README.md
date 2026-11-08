# Tehran loading photographs

These WebP images are captures of Open Skies itself, with the HUD hidden:

- `azadi.webp`: F-4 Phantom over Azadi Square in daylight.
- `golden-crown.webp`: six F-5Es in the Golden Crown display, in daylight.
- `mountains.webp`: F-4 in the Alborz foothills at sunset, using Photo mode.

To regenerate, start the development server on port 5173, install `cwebp`
(libwebp), and run with Node.js 24:

```sh
node scripts/capture/capture-loading.mjs tehran
```

`PREVIEW_ORIGIN` overrides the local server origin. Captures use a 1600 × 900
viewport and WebP quality 82. The formation shot uses the development-only
Golden Crown viewer. No external photographs or geographic downloads are used.

Map imagery derives from **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)**,
under ODbL 1.0; see [the geographic data credits](../../../data/README.md)
and [elevation attribution](../../../data/terrain-attribution.md).
Aircraft and livery source credits remain in the [project README](../../../README.md).
