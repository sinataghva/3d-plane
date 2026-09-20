# Luxeuil – Saint-Sauveur scenery

- `map.json`: projected and simplified OSM geometry, **© OpenStreetMap
  contributors**, [ODbL 1.0](https://www.openstreetmap.org/copyright).
- `elevation.json`: 257 × 257 resampled Terrain Tiles heights. Source URLs are
  embedded; provider credits and licenses are in `../terrain-attribution.md`.
- `cache/`: 21 original successful Overpass responses and nine original zoom-11
  Terrarium PNG tiles. The five building areas overlap only at their boundaries;
  import deduplicates OSM element identifiers. Dense queries were split to avoid
  public-service timeouts. Successful source files are never fetched again.
- `cache/manifest.json`: source query bodies, SHA-256 checksums of the decoded
  responses, element counts and OSM snapshot timestamps. Responses came from the
  public overpass-api.de, Private.coffee (legacy kumi.systems), and VK Maps
  endpoints listed on the [OSM Overpass wiki](https://wiki.openstreetmap.org/wiki/Overpass_API).

The source snapshots span **2026-07-28 to 2026-09-19**; download date is not the
same as every source snapshot date. This is not live operational airbase data.
Bounds are 47.69–47.89 N, 6.20–6.54 E. Buildings have estimated heights where OSM
provides none; missing widths use category defaults. Terrain is flattened around
runways by the runtime. The same data drives scenery, map and collision queries.

From the repository root, reproduce entirely from this cache:

```sh
python3 scripts/scenery/download-scenery.py --luxeuil
python3 scripts/scenery/import-osm.py data/luxeuil/cache/osm.json.gz --luxeuil
python3 scripts/scenery/import-elevation.py --luxeuil
```

Pillow is needed for elevation import. The merged `cache/osm.json.gz` is an ignored,
regenerable intermediate; all original source layers remain preserved.
