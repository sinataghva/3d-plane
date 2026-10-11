import { segmentDistance } from './geography.js';

/** Interleave bounded woodland sampling across spatial cells instead of letting
 * the first source polygons consume the complete tree budget.
 * @param {{minX:number,maxX:number,minZ:number,maxZ:number,data:{features:import('./geography.js').GeoFeature[]}}} world */
export function woodlandSchedule(world) {
    /** @type {Map<string, {f:import('./geography.js').GeoFeature,minX:number,maxX:number,minZ:number,maxZ:number,count:number,phase:number}[]>} */
    const cells = new Map();
    for (const f of world.data.features) {
        if (f.kind !== 'forest' || !f.points.length) continue;
        const xs = f.points.map((p) => p[0]),
            zs = f.points.map((p) => p[1]);
        const minX = Math.max(world.minX, Math.min(...xs)),
            maxX = Math.min(world.maxX, Math.max(...xs)),
            minZ = Math.max(world.minZ, Math.min(...zs)),
            maxZ = Math.min(world.maxZ, Math.max(...zs));
        if (maxX <= minX || maxZ <= minZ) continue;
        const count = Math.min(
            900,
            Math.floor(((maxX - minX) * (maxZ - minZ)) / 1400)
        );
        const key = `${Math.floor((minX + maxX) / 1500)},${Math.floor((minZ + maxZ) / 1500)}`;
        if (!cells.has(key)) cells.set(key, []);
        let phase = 0;
        for (const c of f.id) phase = (phase * 31 + c.charCodeAt(0)) % 900;
        cells.get(key)?.push({ f, minX, maxX, minZ, maxZ, count, phase });
    }
    const ordered = [...cells.entries()].sort(([a], [b]) => a.localeCompare(b));
    for (const [, features] of ordered)
        features.sort((a, b) => a.f.id.localeCompare(b.f.id));
    return ordered.map(([, features]) => features);
}

/** Indexed road/rail clearance includes canopy radius. No trees on carriageways.
 * @param {import('./geography.js').GeoFeature[]} features */
export function vegetationClearance(features) {
    /** @type {Map<string, {a:number[],b:number[],radius:number}[]>} */
    const cells = new Map();
    for (const f of features) {
        if (!f.line || !['road', 'rail', 'taxiway', 'runway'].includes(f.kind))
            continue;
        if (f.tunnel === 'yes') continue;
        const radius = (f.width || 6) / 2 + 9;
        for (let i = 1; i < f.points.length; i++) {
            const a = f.points[i - 1],
                b = f.points[i];
            for (
                let x = Math.floor((Math.min(a[0], b[0]) - radius) / 250);
                x <= Math.floor((Math.max(a[0], b[0]) + radius) / 250);
                x++
            )
                for (
                    let z = Math.floor((Math.min(a[1], b[1]) - radius) / 250);
                    z <= Math.floor((Math.max(a[1], b[1]) + radius) / 250);
                    z++
                ) {
                    const key = `${x},${z}`;
                    if (!cells.has(key)) cells.set(key, []);
                    cells.get(key)?.push({ a, b, radius });
                }
        }
    }
    return (/** @type {number} */ x, /** @type {number} */ z) =>
        !(
            cells.get(`${Math.floor(x / 250)},${Math.floor(z / 250)}`) || []
        ).some((s) => segmentDistance(x, z, s.a, s.b) < s.radius);
}
