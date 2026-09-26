import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original stylized Mk-82 silhouette, +X forward. Shared by mounts and falling stores. */
export function createBombGeometry() {
    const body = new THREE.SphereGeometry(1, 12, 8);
    body.scale(1.05, 0.15, 0.15);
    /** @type {THREE.BufferGeometry[]} */ const parts = [body];
    for (const angle of [0, Math.PI / 2]) {
        const fin = new THREE.BoxGeometry(0.45, 0.025, 0.5);
        fin.rotateX(angle);
        fin.translate(-0.8, 0, 0);
        parts.push(fin);
    }
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return geometry;
}
