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
    return { height, inside, sweep };
}
