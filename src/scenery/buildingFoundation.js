import * as THREE from 'three';
import { clipToTerrain } from './groundDetail.js';

/** @typedef {{width:number,depth:number,minX:number,minZ:number,height:(x:number,z:number)=>number}} Ground */
/** @type {WeakMap<Ground, WeakMap<object, number>>} */
const bases = new WeakMap();

/** Foundation for buildings: a level floor above the highest rendered
 * terrain point in the footprint, including terrain vertices inside large hangars.
 * @param {import('./geography.js').GeoFeature} f @param {Ground} world */
export function buildingBase(f, world) {
    const original = world.height(f.points[0][0], f.points[0][1]);
    let cache = bases.get(world);
    if (!cache) bases.set(world, (cache = new WeakMap()));
    const saved = cache.get(f);
    if (saved !== undefined) return saved;
    const rings = [f.points, ...f.holes].map((r) => r.slice(0, -1));
    const vectors = rings.map((r) =>
        r.map(([x, z]) => new THREE.Vector2(x, z))
    );
    const points = rings.flat();
    let base = original;
    // Minimal fixtures without a rendered grid still use footprint elevations.
    if (!(world.width > 0 && world.depth > 0)) {
        for (const [x, z] of points) base = Math.max(base, world.height(x, z));
    } else {
        const sx = world.width / 256,
            sz = world.depth / 256;
        for (const triangle of THREE.ShapeUtils.triangulateShape(
            vectors[0],
            vectors.slice(1)
        )) {
            for (const [x, z] of clipToTerrain(
                triangle.map((i) => points[i]),
                world
            )) {
                const gx = Math.max(
                    0,
                    Math.min(255.999999, (x - world.minX) / sx)
                );
                const gz = Math.max(
                    0,
                    Math.min(255.999999, (z - world.minZ) / sz)
                );
                const ix = Math.floor(gx),
                    iz = Math.floor(gz),
                    fx = gx - ix,
                    fz = gz - iz;
                const h = (
                    /** @type {number} */ dx,
                    /** @type {number} */ dz
                ) =>
                    Math.fround(
                        world.height(
                            world.minX + (ix + dx) * sx,
                            world.minZ + (iz + dz) * sz
                        )
                    );
                const y =
                    fx + fz <= 1
                        ? h(0, 0) +
                          (h(1, 0) - h(0, 0)) * fx +
                          (h(0, 1) - h(0, 0)) * fz
                        : h(1, 1) +
                          (h(0, 1) - h(1, 1)) * (1 - fx) +
                          (h(1, 0) - h(1, 1)) * (1 - fz);
                base = Math.max(base, y);
            }
        }
    }
    cache.set(f, base);
    return base;
}
