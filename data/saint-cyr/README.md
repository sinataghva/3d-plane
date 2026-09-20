# Saint-Cyr · Versailles scenery

`map.json` contains the processed OpenStreetMap scenery. `elevation.json` contains
the 129 × 129 regional height grid. `cache/` preserves original OSM layer responses,
the source manifest and six Terrarium elevation tiles. Keep original cache files;
only the merged `osm.json.gz` intermediate is regenerable and ignored.

See [shared data documentation](../README.md) and
[elevation attribution](../terrain-attribution.md) for provenance and licenses.
Run scenery scripts from the repository root under `scripts/scenery/`, without
`--luxeuil`, to select this region. The game loads these assets locally.
