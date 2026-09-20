import { isSurfaceFeature } from './surfaceFeatures.js';
/** @typedef {import('./geography.js').Geography} Geography */
export const LAND_COLORS = {
    forest: '#345d3f',
    field: '#aaa773',
    grass: '#7d9b61',
    urban: '#aaa79a',
    airfield: '#899e67',
    water: '#4b8d9b',
    taxiway: '#a2ac79',
    building: '#ddd1b5'
};
/** Shared geographic surface for the 3D terrain and overview map.
 * @param {Geography} world @param {number} size @param {boolean} [map]
 */
export function createGeographicCanvas(world, size = 2048, map = false) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = Math.round((size * world.depth) / world.width);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Map drawing unavailable');
    const sx = canvas.width / world.width,
        sy = canvas.height / world.depth;
    ctx.fillStyle = '#859467';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    /** @param {number[][]} points */
    const path = (points) => {
        points.forEach(([x, z], i) => {
            const px = (x - world.minX) * sx,
                py = (z - world.minZ) * sy;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
    };
    const order = [
        'grass',
        'field',
        'urban',
        'forest',
        'airfield',
        'water',
        'road',
        'rail',
        'waterway',
        'taxiway',
        'runway',
        'building'
    ];
    for (const kind of order) {
        if (kind === 'building' && !map) continue;
        for (const f of world.data.features.filter((f) => f.kind === kind)) {
            if (!isSurfaceFeature(f)) continue;
            ctx.beginPath();
            path(f.points);
            for (const h of f.holes) {
                ctx.closePath();
                path(h);
                ctx.closePath();
            }
            if (f.line) {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.lineWidth = Math.max(map ? 1 : 0.6, (f.width || 4) * sx);
                ctx.strokeStyle =
                    kind === 'runway'
                        ? world.data.airfield?.includes('LFSX')
                            ? '#647078'
                            : '#bfd098'
                        : kind === 'waterway'
                          ? '#4b8d9b'
                          : kind === 'taxiway'
                            ? '#a2ac79'
                            : kind === 'rail'
                              ? '#756e63'
                              : '#c3baa4';
                ctx.stroke();
                if (kind === 'runway') {
                    ctx.strokeStyle = '#f4f3d5';
                    ctx.lineWidth = Math.max(0.8, sx * 1.5);
                    ctx.setLineDash([15 * sx, 15 * sx]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            } else {
                ctx.closePath();
                ctx.fillStyle =
                    LAND_COLORS[
                        /** @type {keyof typeof LAND_COLORS} */ (kind)
                    ] || '#879469';
                if (f.palace) ctx.fillStyle = '#edc979';
                ctx.fill('evenodd');
            }
        }
    }
    // Regional relief modulation also makes the 2D map show slopes.
    const n = world.dem.size;
    const relief = document.createElement('canvas');
    relief.width = relief.height = n - 1;
    const shading = relief.getContext('2d');
    if (!shading) return canvas;
    for (let j = 0; j < n - 1; j++)
        for (let i = 0; i < n - 1; i++) {
            const h = world.dem.values[j * n + i],
                east = world.dem.values[j * n + i + 1],
                south = world.dem.values[(j + 1) * n + i];
            const shade = Math.max(
                -0.16,
                Math.min(0.16, (east - h + south - h) * 0.014)
            );
            shading.fillStyle =
                shade > 0
                    ? `rgba(10,24,18,${shade})`
                    : `rgba(255,255,230,${-shade})`;
            shading.fillRect(i, j, 1, 1);
        }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(relief, 0, 0, canvas.width, canvas.height);
    return canvas;
}
