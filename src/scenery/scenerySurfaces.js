import * as THREE from 'three';
import { waterCharacter } from '../effects/waterEffects.js';
import {
    isSurfaceFeature,
    bridgeProfile,
    pavedAirfieldSurface,
    pavedAirfieldDefault
} from './surfaceFeatures.js';
/** @typedef {{points:number[][],kind:'road'|'ballast'|'rail'|'water'|'bank'|'asphalt'|'grass',origin?:number[],direction?:number[],offset?:number,bridge?:number[],waterCharacter?:number}} SurfacePatch */
/** Clip a convex polygon to a rectangle, retaining triangle/quad winding.
 * @param {number[][]} polygon @param {number} minX @param {number} minZ @param {number} maxX @param {number} maxZ */
export function clipRectangle(polygon, minX, minZ, maxX, maxZ) {
    let points = polygon;
    for (const [axis, bound, sign] of [
        [0, minX, 1],
        [0, maxX, -1],
        [1, minZ, 1],
        [1, maxZ, -1]
    ]) {
        const next = [];
        for (let i = 0; i < points.length; i++) {
            const a = points[i],
                b = points[(i + 1) % points.length];
            const da = (a[axis] - bound) * sign,
                db = (b[axis] - bound) * sign;
            if (da >= 0) next.push(a);
            if (da >= 0 !== db >= 0) {
                const t = da / (da - db);
                next.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
            }
        }
        points = next;
    }
    return points;
}
/** Remove a convex mask from a convex surface, preserving the outside pieces.
 * @param {number[][]} subject @param {number[][]} mask */
export function subtractConvex(subject, mask) {
    const area = mask.reduce((s, a, i) => {
        const b = mask[(i + 1) % mask.length];
        return s + a[0] * b[1] - b[0] * a[1];
    }, 0);
    const sign = area >= 0 ? 1 : -1;
    let inside = subject;
    const pieces = [];
    for (let edge = 0; edge < mask.length && inside.length >= 3; edge++) {
        const a = mask[edge],
            b = mask[(edge + 1) % mask.length];
        const keep = [],
            outside = [];
        for (let i = 0; i < inside.length; i++) {
            const p = inside[i],
                q = inside[(i + 1) % inside.length];
            const dp =
                sign *
                ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
            const dq =
                sign *
                ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]));
            if (dp >= 0) keep.push(p);
            if (dp < 0) outside.push(p);
            if (dp >= 0 !== dq >= 0) {
                const t = dp / (dp - dq),
                    r = [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])];
                keep.push(r);
                outside.push(r);
            }
        }
        if (outside.length >= 3) pieces.push(outside);
        inside = keep;
    }
    return pieces;
}
/** Miter joins clamped to twice the width to avoid spikes at sharp switches.
 * @param {number[][]} points @param {number} offset */
export function offsetLine(points, offset) {
    const normals = points.slice(1).map((p, i) => {
        const dx = p[0] - points[i][0],
            dz = p[1] - points[i][1],
            length = Math.hypot(dx, dz) || 1;
        return [-dz / length, dx / length];
    });
    return points.map((p, i) => {
        const a = normals[Math.max(0, i - 1)],
            b = normals[Math.min(i, normals.length - 1)];
        const nx = a[0] + b[0],
            nz = a[1] + b[1],
            length = Math.hypot(nx, nz) || 1;
        const dot = (nx * b[0] + nz * b[1]) / length;
        const scale = offset / Math.max(0.5, dot);
        return [p[0] + (nx / length) * scale, p[1] + (nz / length) * scale];
    });
}
/** @param {import('./geography.js').Geography} world @param {number} tileSize
 * @param {(x:number,z:number,patch:SurfacePatch)=>void} emit */
export function indexScenerySurfaces(world, tileSize, emit) {
    /** @type {Map<string,number[][][]>} */
    const waterMasks = new Map();
    /** @param {SurfacePatch} patch */
    function add(patch) {
        const xs = patch.points.map((p) => p[0]),
            zs = patch.points.map((p) => p[1]);
        const minX = Math.max(world.minX, Math.min(...xs)),
            maxX = Math.min(world.maxX, Math.max(...xs));
        const minZ = Math.max(world.minZ, Math.min(...zs)),
            maxZ = Math.min(world.maxZ, Math.max(...zs));
        for (
            let x = Math.floor(minX / tileSize);
            x <= Math.floor(maxX / tileSize);
            x++
        )
            for (
                let z = Math.floor(minZ / tileSize);
                z <= Math.floor(maxZ / tileSize);
                z++
            ) {
                const points = clipRectangle(
                    patch.points,
                    x * tileSize,
                    z * tileSize,
                    (x + 1) * tileSize,
                    (z + 1) * tileSize
                );
                if (
                    points.length < 3 ||
                    Math.abs(
                        points.reduce((s, a, i) => {
                            const b = points[(i + 1) % points.length];
                            return s + a[0] * b[1] - b[0] * a[1];
                        }, 0)
                    ) < 1e-6
                )
                    continue;
                const key = `${x},${z}`;
                if (patch.kind === 'water' && !patch.origin) {
                    const masks = waterMasks.get(key) || [];
                    masks.push(points);
                    waterMasks.set(key, masks);
                }
                let pieces = [points];
                if (
                    patch.origin &&
                    (patch.kind === 'water' || patch.kind === 'bank')
                ) {
                    for (const mask of waterMasks.get(key) || []) {
                        const mx = mask.map((p) => p[0]),
                            mz = mask.map((p) => p[1]);
                        const minx = Math.min(...mx),
                            maxx = Math.max(...mx),
                            minz = Math.min(...mz),
                            maxz = Math.max(...mz);
                        pieces = pieces.flatMap((p) =>
                            p.every((v) => v[0] < minx) ||
                            p.every((v) => v[0] > maxx) ||
                            p.every((v) => v[1] < minz) ||
                            p.every((v) => v[1] > maxz)
                                ? [p]
                                : subtractConvex(p, mask)
                        );
                        if (!pieces.length) break;
                    }
                }
                for (const p of pieces) {
                    const area = p.reduce((s, a, i) => {
                        const b = p[(i + 1) % p.length];
                        return s + a[0] * b[1] - b[0] * a[1];
                    }, 0);
                    if (Math.abs(area) > 1e-6)
                        emit(x, z, { ...patch, points: p });
                }
            }
    }
    // Build water masks first so centreline strips cannot paint banks across lakes.
    const features = world.data.features;
    for (const f of [
        ...features.filter((f) => f.kind === 'water'),
        ...features.filter((f) => f.kind !== 'water')
    ]) {
        if (!isSurfaceFeature(f)) continue;
        if (['water', 'taxiway'].includes(f.kind) && !f.line) {
            const outer = f.points.slice(0, -1),
                holes = f.holes.map((h) => h.slice(0, -1));
            const triangles = THREE.ShapeUtils.triangulateShape(
                outer.map((p) => new THREE.Vector2(...p)),
                holes.map((h) => h.map((p) => new THREE.Vector2(...p)))
            );
            const points = [...outer, ...holes.flat()];
            for (const tri of triangles)
                add({
                    points: tri.map((i) => points[i]),
                    kind:
                        f.kind === 'water'
                            ? 'water'
                            : pavedAirfieldSurface(
                                    f,
                                    pavedAirfieldDefault(world.data)
                                )
                              ? 'asphalt'
                              : 'grass',
                    offset: f.kind === 'water' ? 0.035 : 0.04,
                    waterCharacter:
                        f.kind === 'water' ? waterCharacter(f) : undefined
                });
            continue;
        }
        if (
            !f.line ||
            f.points.length < 2 ||
            !['rail', 'waterway'].includes(f.kind)
        )
            continue;
        const p = f.points;
        const isRail = f.kind === 'rail';
        const width = isRail
            ? 3.4
            : (f.width || 2) * (f.intermittent === 'yes' ? 0.6 : 1);
        /** @param {number} left @param {number} right @param {SurfacePatch['kind']} kind */
        function band(left, right, kind) {
            const a = offsetLine(p, left),
                b = offsetLine(p, right);
            for (let i = 1; i < p.length; i++) {
                const dx = p[i][0] - p[i - 1][0],
                    dz = p[i][1] - p[i - 1][1],
                    len = Math.hypot(dx, dz);
                if (len < 0.01) continue;
                add({
                    points: [a[i - 1], a[i], b[i], b[i - 1]],
                    kind,
                    waterCharacter: kind === 'water' ? waterCharacter(f) : 0,
                    origin: p[i - 1],
                    direction: [dx / len, dz / len],
                    offset:
                        kind === 'rail'
                            ? 0.13
                            : kind === 'ballast'
                              ? 0.08
                              : 0.035,
                    // Bridge decks interpolate endpoints instead of following a valley floor.
                    bridge: bridgeProfile(f, world.height)
                });
            }
        }
        if (isRail) {
            band(width / 2, -width / 2, 'ballast');
            const gauge = f.gauge || 1.435;
            for (const side of [-1, 1])
                band(
                    (side * gauge) / 2 + 0.055,
                    (side * gauge) / 2 - 0.055,
                    'rail'
                );
        } else {
            band(width / 2 + 0.22, width / 2, 'bank');
            band(-width / 2, -width / 2 - 0.22, 'bank');
            band(width / 2, -width / 2, 'water');
        }
    }
}
/** Repeating sleepers on gravel; no individual sleeper draw calls. */
export function createBallastTexture() {
    const size = 128,
        data = new Uint8Array(size * size * 4);
    let seed = 23;
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const tie = x > 14 && x < 114 && y > 42 && y < 80;
            const v = (tie ? 65 : 150) + (seed / 4294967296 - 0.5) * 35,
                i = (y * size + x) * 4;
            data[i] = v;
            data[i + 1] = v * (tie ? 0.84 : 0.97);
            data[i + 2] = v * (tie ? 0.68 : 0.92);
            data[i + 3] = 255;
        }
    const t = new THREE.DataTexture(data, size, size);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.needsUpdate = true;
    return t;
}
