// Rebuild the deliberately small map-only civic selection from preserved OSM.
// No network access; missing selected records fail rather than invent locations.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import console from 'node:console';
const map = JSON.parse(readFileSync('data/tehran/map.json', 'utf8'));
const raw = JSON.parse(
    gunzipSync(readFileSync('data/tehran/cache/osm.json.gz'))
);
const selection = [
    ['node', 5904296730, 'square', 4], // Darband / Sarband, northern extension.
    ['relation', 5581508, 'museum', 4],
    ['way', 182083848, 'government', 4],
    ['way', 4294984, 'park', 4],
    ['way', 206602673, 'park', 4],
    ['relation', 2064918, 'library', 4],
    ['way', 1108354479, 'square', 4],
    ['way', 161072043, 'park', 5],
    ['way', 601652789, 'museum', 5],
    ['relation', 2954356, 'museum', 5],
    ['node', 10263363940, 'square', 5],
    ['way', 99886906, 'garden', 5],
    ['way', 211028560, 'museum', 6],
    ['relation', 4749898, 'museum', 6],
    ['way', 675091597, 'museum', 6],
    ['way', 279386264, 'university', 6],
    ['node', 9546674611, 'square', 6],
    ['way', 841633654, 'arts', 7],
    ['way', 609222998, 'library', 7],
    // Additional public orientation points, visible only in the third level.
    ['way', 99887137, 'park', 8.01], // Chitgar
    ['way', 222858917, 'park', 8.01], // Pardisan
    ['way', 340106928, 'park', 8.01], // Nahjol Balagheh
    ['way', 174312146, 'park', 8.01], // Park-e Shahr
    ['way', 30725482, 'park', 8.01], // Sa'i
    ['way', 175813833, 'park', 8.01], // Qeytarieh
    ['way', 206925858, 'park', 8.01], // Jamshidieh
    ['way', 330809815, 'museum', 8.01], // Marble Palace
    ['way', 606828257, 'transport', 8.01], // East bus terminal
    ['way', 220526199, 'park', 10], // Parvaz
    ['way', 390584475, 'park', 10], // Daneshjoo
    ['way', 31767608, 'museum', 10], // Iranian Art Museum Garden
    ['way', 1154040854, 'museum', 10], // Map Museum
    ['way', 324470403, 'government', 10], // Geological Survey
    ['way', 530406657, 'government', 10], // National Cartographic Centre
    ['way', 330482383, 'government', 10], // Provincial government
    ['way', 739183424, 'transport', 10], // Sanat terminal
    ['way', 615883391, 'government', 11.5], // Ministry of Science
    ['way', 180551019, 'library', 11.5], // Sharif central library
    ['way', 558042155, 'library', 11.5], // Nezami Ganjavi public library
    ['way', 486567543, 'arts', 11.5] // Attar Neyshabouri cultural centre
];
const mx = 111320 * Math.cos((map.origin[0] * Math.PI) / 180);
const pois = selection.map(([type, id, category, minZoom]) => {
    const e = raw.elements.find((e) => e.type === type && e.id === id);
    if (!e?.tags?.name) throw new Error(`Missing selected POI ${type}/${id}`);
    const geometry = e.geometry ||
        e.members?.flatMap((m) => m.geometry || []) || [e];
    const points = geometry.filter(
        (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lon)
    );
    if (!points.length) throw new Error(`Missing geometry ${id}`);
    // Bounding-box center is an orientation marker, not a surveyed entrance.
    const lat =
        (Math.min(...points.map((p) => p.lat)) +
            Math.max(...points.map((p) => p.lat))) /
        2;
    const lon =
        (Math.min(...points.map((p) => p.lon)) +
            Math.max(...points.map((p) => p.lon))) /
        2;
    if (
        lat < map.bounds[0] ||
        lat > map.bounds[2] ||
        lon < map.bounds[1] ||
        lon > map.bounds[3]
    )
        throw new Error(`POI outside region ${id}`);
    return {
        id: `${type}/${id}`,
        name: e.tags.name,
        nameEn: e.tags['name:en'] || '',
        category,
        minZoom,
        point: [
            Math.round((lon - map.origin[1]) * mx),
            Math.round((map.origin[0] - lat) * 111320)
        ]
    };
});
writeFileSync(
    'data/tehran/map-pois.json',
    JSON.stringify(
        {
            source: '© OpenStreetMap contributors',
            license: 'ODbL-1.0',
            sourceUrl: 'https://www.openstreetmap.org/copyright',
            sourceTimestamp: raw.osm3s?.timestamp_osm_base || map.timestamp,
            note: 'Curated map-only public places; incomplete by design. Centers are approximate, not entrances.',
            pois
        },
        null,
        2
    ) + '\n'
);
console.log(
    `Recovered ${pois.length} selected civic/public POIs from existing cache; no downloads.`
);
