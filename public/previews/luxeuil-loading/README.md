# Luxeuil loading photographs

These WebP images are captures of the actual Luxeuil game scene, with the HUD
hidden:

- `countryside.webp`: the Mirage 2000 over Haute-Saône in daylight.
- `afterburner.webp`: an afterburner departure along the Luxeuil runway.
- `evening.webp`: the Mirage above the countryside at sunset.

Start the development server on port 5173, install `cwebp` (libwebp), and run
with Node.js 24:

```sh
node scripts/capture/capture-loading.mjs luxeuil
```

`PREVIEW_ORIGIN` overrides the local server origin. Omit the scenario argument
to capture all three destinations. Captures use a 1600 × 900 viewport and WebP
quality 82. No external artwork or geographic downloads are used.

Map imagery derives from **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)**,
under ODbL 1.0; see [the geographic data credits](../../../data/README.md)
and [elevation attribution](../../../data/terrain-attribution.md).
