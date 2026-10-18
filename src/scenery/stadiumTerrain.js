import * as THREE from 'three';
import { stadiumToWorld } from './stadiumFrame.js';
import { subtractConvex } from './scenerySurfaces.js';

/** Cut the stadium bowl out of the terrain instead of lifting the pitch above it.
 * Preserve each original triangle's plane and UVs outside the opening.
 * @param {THREE.BufferGeometry} geometry
 * @param {{x:number,z:number}|null} stadium */
export function cutStadiumTerrain(geometry, stadium) {
    if (!stadium) return geometry;
    const p = geometry.getAttribute('position');
    const uv = geometry.getAttribute('uv');
    const index = geometry.getIndex();
    const mask = Array.from({ length: 128 }, (_, i) => {
        const a = (i * Math.PI) / 64;
        const [x, z] = stadiumToWorld(120 * Math.sin(a), 137 * Math.cos(a));
        return [x + stadium.x, z + stadium.z];
    });
    const positions = Array.from(p.array),
        uvs = Array.from(uv.array),
        indices = [];
    for (let i = 0; i < (index ? index.count : p.count); i += 3) {
        const ids = [0, 1, 2].map((k) => (index ? index.getX(i + k) : i + k));
        const triangle = ids.map((k) => [p.getX(k), p.getZ(k)]);
        const near =
            !triangle.every((v) => v[0] < stadium.x - 150) &&
            !triangle.every((v) => v[0] > stadium.x + 150) &&
            !triangle.every((v) => v[1] < stadium.z - 150) &&
            !triangle.every((v) => v[1] > stadium.z + 150);
        if (!near) {
            indices.push(...ids);
            continue;
        }
        const pieces = subtractConvex(triangle, mask);
        const [a, b, c] = triangle;
        const det =
            (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1]);
        for (const poly of pieces)
            for (let j = 1; j < poly.length - 1; j++) {
                for (const [x, z] of [poly[0], poly[j], poly[j + 1]]) {
                    const wa =
                        ((b[1] - c[1]) * (x - c[0]) +
                            (c[0] - b[0]) * (z - c[1])) /
                        det;
                    const wb =
                        ((c[1] - a[1]) * (x - c[0]) +
                            (a[0] - c[0]) * (z - c[1])) /
                        det;
                    const weights = [wa, wb, 1 - wa - wb];
                    indices.push(positions.length / 3);
                    positions.push(
                        x,
                        ids.reduce((s, k, n) => s + p.getY(k) * weights[n], 0),
                        z
                    );
                    uvs.push(
                        ids.reduce((s, k, n) => s + uv.getX(k) * weights[n], 0),
                        ids.reduce((s, k, n) => s + uv.getY(k) * weights[n], 0)
                    );
                }
            }
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    result.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    result.setIndex(indices);
    result.computeVertexNormals();
    geometry.dispose();
    return result;
}
