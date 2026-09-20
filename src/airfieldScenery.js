import * as THREE from 'three';
import { inFeature } from './geography.js';
import { clipRectangle } from './scenerySurfaces.js';

/** @param {import('./geography.js').GeoFeature} f @param {import('./geography.js').GeoFeature[]} boundaries */
export function airfieldBuilding(f, boundaries) {
    return (
        f.kind === 'building' &&
        (['hangar', 'shelter', 'tower'].includes(f.aeroway || '') ||
            f.buildingType === 'hangar') &&
        boundaries.some((b) => inFeature(f.points[0][0], f.points[0][1], b))
    );
}
/** Stylized architecture on the source footprint, bounded by the collision height.
 * No inferred operational details, signs, or additional buildings.
 * @param {import('./geography.js').GeoFeature} f
 * @param {import('./geography.js').Geography} world
 * @param {{positions:number[],colors:number[]}} chunk
 * @param {boolean} military */
export function appendAirfieldBuilding(f, world, chunk, military) {
    const ring = f.points.slice(0, -1);
    const edges = ring.map((a, i) => {
        const b = ring[(i + 1) % ring.length];
        return { a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) };
    });
    const longest = [...edges].sort((a, b) => b.length - a.length)[0];
    if (!longest || longest.length < 0.1) return;
    const ux = (longest.b[0] - longest.a[0]) / longest.length;
    const uz = (longest.b[1] - longest.a[1]) / longest.length;
    const origin = ring[0];
    const local = (/** @type {number[]} */ p) => [
        (p[0] - origin[0]) * ux + (p[1] - origin[1]) * uz,
        -(p[0] - origin[0]) * uz + (p[1] - origin[1]) * ux
    ];
    const outer = ring.map(local),
        holes = f.holes.map((h) => h.slice(0, -1).map(local));
    const all = [...outer, ...holes.flat()];
    const min = Math.min(...outer.map((p) => p[1])),
        max = Math.max(...outer.map((p) => p[1]));
    const span = max - min || 1;
    const base = world.height(.../** @type {[number,number]} */ (origin));
    const height = f.height || 8,
        top = base + height;
    const tower = f.aeroway === 'tower',
        shelter = f.aeroway === 'shelter';
    const flat = tower || f.roofShape === 'flat' || holes.length > 0;
    const bands = flat ? 1 : shelter ? 8 : 2;
    const rise = flat
        ? 0
        : Math.min(height * (shelter ? 0.5 : 0.25), span * 0.22);
    const roofHeight = (/** @type {number} */ v) => {
        const t = Math.max(0, Math.min(1, (v - min) / span));
        // Linear interpolation between profile samples keeps wall and roof edges identical.
        const profile = (/** @type {number} */ s) =>
            shelter ? Math.sin(Math.PI * s) : 1 - Math.abs(s * 2 - 1);
        const k = Math.min(bands - 1, Math.floor(t * bands)),
            a = k / bands,
            b = (k + 1) / bands;
        return (
            top -
            rise +
            rise * (profile(a) + (profile(b) - profile(a)) * (t - a) * bands)
        );
    };
    const wall = new THREE.Color(
        military ? (shelter ? 0x858b70 : 0xa5aca2) : 0xd4d0b9
    );
    const roof = new THREE.Color(
        military ? (shelter ? 0x626b50 : 0x717e79) : 0x768b91
    );
    const door = new THREE.Color(military ? 0x4d5c52 : 0x829da4);
    const trim = new THREE.Color(military ? 0x333c36 : 0x455963);
    const glass = new THREE.Color(0x365b6a);
    const tri = (
        /** @type {number[]} */ a,
        /** @type {number[]} */ b,
        /** @type {number[]} */ c,
        /** @type {THREE.Color} */ color
    ) => {
        chunk.positions.push(...a, ...b, ...c);
        for (let k = 0; k < 3; k++)
            chunk.colors.push(color.r, color.g, color.b);
    };
    const point = (/** @type {number[]} */ p, /** @type {number} */ y) => [
        origin[0] + p[0] * ux - p[1] * uz,
        y,
        origin[1] + p[0] * uz + p[1] * ux
    ];
    const triangles = THREE.ShapeUtils.triangulateShape(
        outer.map((p) => new THREE.Vector2(...p)),
        holes.map((h) => h.map((p) => new THREE.Vector2(...p)))
    );
    for (const t of triangles)
        for (let k = 0; k < bands; k++) {
            const polygon = clipRectangle(
                t.map((i) => all[i]),
                -1e6,
                min + (span * k) / bands,
                1e6,
                min + (span * (k + 1)) / bands
            );
            for (let i = 1; i < polygon.length - 1; i++)
                tri(
                    point(polygon[0], roofHeight(polygon[0][1])),
                    point(polygon[i + 1], roofHeight(polygon[i + 1][1])),
                    point(polygon[i], roofHeight(polygon[i][1])),
                    roof
                );
        }
    // Choose the broad facade nearest a mapped taxiway/apron for the hangar doors.
    const surfaces = world.data.features.filter((g) => g.kind === 'taxiway');
    const candidates = edges.filter((e) => e.length >= longest.length * 0.55);
    const frontage = [...candidates].sort((a, b) => {
        const distance = (/** @type {typeof a} */ e) =>
            Math.min(
                ...surfaces.flatMap((g) =>
                    g.points.map((p) =>
                        Math.hypot(
                            p[0] - (e.a[0] + e.b[0]) / 2,
                            p[1] - (e.a[1] + e.b[1]) / 2
                        )
                    )
                )
            );
        return distance(a) - distance(b);
    })[0];
    for (const r of [ring, ...f.holes.map((h) => h.slice(0, -1))]) {
        const area = r.reduce((s, a, i) => {
            const b = r[(i + 1) % r.length];
            return s + a[0] * b[1] - b[0] * a[1];
        }, 0);
        for (let i = 0; i < r.length; i++) {
            const a = r[i],
                b = r[(i + 1) % r.length],
                dx = b[0] - a[0],
                dz = b[1] - a[1],
                len = Math.hypot(dx, dz);
            if (len < 0.01) continue;
            const bottom =
                Math.min(
                    base,
                    world.height(.../** @type {[number,number]} */ (a)),
                    world.height(.../** @type {[number,number]} */ (b))
                ) - 1;
            const va = local(a)[1],
                vb = local(b)[1],
                cuts = [0, 1];
            if (Math.abs(vb - va) > 1e-6)
                for (let k = 1; k < bands; k++) {
                    const t = (min + (span * k) / bands - va) / (vb - va);
                    if (t > 0 && t < 1) cuts.push(t);
                }
            cuts.sort((a, b) => a - b);
            for (let k = 1; k < cuts.length; k++) {
                const s = cuts[k - 1],
                    t = cuts[k],
                    p = [a[0] + dx * s, bottom, a[1] + dz * s],
                    q = [a[0] + dx * t, bottom, a[1] + dz * t];
                const hiP = [p[0], roofHeight(va + (vb - va) * s), p[2]],
                    hiQ = [q[0], roofHeight(va + (vb - va) * t), q[2]];
                tri(p, q, hiQ, wall);
                tri(p, hiQ, hiP, wall);
            }
            const sign = area >= 0 ? 1 : -1,
                nx = (dz / len) * 0.045 * sign,
                nz = (-dx / len) * 0.045 * sign;
            const quad = (
                /** @type {number} */ from,
                /** @type {number} */ to,
                /** @type {number} */ y,
                /** @type {number} */ h,
                /** @type {THREE.Color} */ color
            ) => {
                const p = [a[0] + dx * from + nx, y, a[1] + dz * from + nz],
                    q = [a[0] + dx * to + nx, y, a[1] + dz * to + nz];
                tri(p, q, [q[0], y + h, q[2]], color);
                tri(p, [q[0], y + h, q[2]], [p[0], y + h, p[2]], color);
            };
            if (tower) {
                quad(0.06, 0.94, top - height * 0.28, height * 0.18, glass);
                for (let t = 0.06; t < 0.95; t += Math.max(0.08, 2 / len))
                    quad(
                        t,
                        Math.min(0.96, t + 0.15 / len),
                        top - height * 0.29,
                        height * 0.2,
                        trim
                    );
            } else if (a === frontage?.a && len > 6) {
                const doorHeight = Math.min(height - rise - 0.6, height * 0.73);
                // Alternating panels avoid coplanar overlays/z-fighting.
                const count = Math.max(2, Math.min(12, Math.round(len / 3)));
                for (let j = 0; j < count; j++) {
                    const s = 0.08 + (0.84 * j) / count,
                        t = 0.08 + (0.84 * (j + 1)) / count;
                    quad(s, t - 0.12 / len, base + 0.12, doorHeight, door);
                    quad(t - 0.12 / len, t, base + 0.12, doorHeight, trim);
                }
                quad(0.06, 0.94, base + 0.12 + doorHeight, 0.2, trim);
            } else if (!shelter && len > 8) {
                for (let t = 2; t < len - 2; t += 4)
                    quad(
                        (t - 0.7) / len,
                        (t + 0.7) / len,
                        base + (height - rise) * 0.66,
                        Math.min(1.2, height * 0.15),
                        glass
                    );
            }
        }
    }
}
