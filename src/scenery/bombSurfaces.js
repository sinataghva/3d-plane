import * as THREE from 'three';
import { createRenderedHeight } from './groundDetail.js';

/** Bombs use the rendered terrain triangles and the game's static obstacle envelopes.
 * No scenery damage or changes to flight collision rules.
 * @param {import('./geography.js').Geography} world */
export function createBombSurfaces(world) {
    const height = createRenderedHeight(world);
    /** @param {THREE.Vector3} p */
    const inside = (p) =>
        p.x >= world.minX &&
        p.x <= world.maxX &&
        p.z >= world.minZ &&
        p.z <= world.maxZ;
    /** @param {THREE.Vector3} p */
    const contact = (p) => {
        const obstacle = world.obstacle(p.x, p.z, p.y, 0);
        if (obstacle === 'building') return obstacle;
        if (p.y <= height(p.x, p.z) + 0.05)
            return world.obstacle(p.x, p.z, world.height(p.x, p.z), 0) ===
                'water'
                ? 'water'
                : 'ground';
        return '';
    };
    const probe = new THREE.Vector3(),
        low = new THREE.Vector3(),
        high = new THREE.Vector3();
    /** Sweep with <= 1 m samples and binary refinement to centimetres.
     * @param {THREE.Vector3} a @param {THREE.Vector3} b */
    function sweep(a, b) {
        const steps = Math.max(1, Math.ceil(a.distanceTo(b)));
        for (let i = 0; i <= steps; i++) {
            probe.lerpVectors(a, b, i / steps);
            if (!inside(probe)) continue;
            const kind = contact(probe);
            if (!kind) continue;
            low.lerpVectors(a, b, Math.max(0, i - 1) / steps);
            high.copy(probe);
            for (let j = 0; j < 8; j++) {
                probe.lerpVectors(low, high, 0.5);
                if (contact(probe)) high.copy(probe);
                else low.copy(probe);
            }
            return { position: high.clone(), kind };
        }
        return null;
    }
    /** Approximate surface for drawing only. Bounded vertical probes deliberately
     * ignore tiny architectural details; live collision still uses sweep().
     * @param {number} x @param {number} z @param {number} ceiling */
    function markerHeight(x, z, ceiling) {
        const ground = height(x, z);
        const top = Math.max(ground + 1, ceiling);
        let high = top;
        for (let i = 0; i <= 12; i++) {
            let low = top + ((ground - top) * i) / 12;
            if (world.obstacle(x, z, low, 0) === 'building') {
                for (let j = 0; j < 8; j++) {
                    const mid = (low + high) / 2;
                    if (world.obstacle(x, z, mid, 0) === 'building') low = mid;
                    else high = mid;
                }
                return Math.max(ground, high);
            }
            high = low;
        }
        return ground;
    }
    return { height, inside, sweep, markerHeight };
}
