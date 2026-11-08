# Saint-Cyr loading photographs

These WebP images are captures of the actual Saint-Cyr/Versailles game scene,
with the HUD hidden:

- `versailles.webp`: light aircraft above the palace and gardens in daylight.
- `cockpit.webp`: a pilot's view over the airfield and surrounding town.
- `evening.webp`: the light aircraft at Saint-Cyr at sunset.

Start the development server on port 5173, install `cwebp` (libwebp), and run
with Node.js 24:

```sh
node scripts/capture/capture-loading.mjs saint-cyr
```

`PREVIEW_ORIGIN` overrides the local server origin. Omit the scenario argument
to capture all three destinations. Captures use a 1600 × 900 viewport and WebP
quality 82. No external artwork or geographic downloads are used.

Map imagery derives from **© [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)**,
under ODbL 1.0; see [the geographic data credits](../../../data/README.md)
and [elevation attribution](../../../data/terrain-attribution.md).
