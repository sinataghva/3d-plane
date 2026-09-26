import { it, expect } from 'vitest';
import * as THREE from 'three';
import {
    TEHRAN_LANDMARKS,
    landmarkGeometry,
    landmarkContains,
    tabiatApproachHeight
} from './tehranLandmarks.js';
it('bakes finite landmark meshes with bounded geometry', () => {
    for (const spec of TEHRAN_LANDMARKS) {
        const g = landmarkGeometry(spec.id);
        expect([...g.attributes.position.array].every(Number.isFinite)).toBe(
            true
        );
        expect(g.attributes.position.count).toBeLessThan(130000);
        expect(g.attributes.color.count).toBe(g.attributes.position.count);
        g.computeBoundingBox();
        expect(g.boundingBox?.max.y).toBeGreaterThan(spec.height - 3);
        g.dispose();
    }
});
it('keeps gate openings below the solid canopy and plants both bridge ends', () => {
    expect(landmarkContains('university', -9.95, 2.8, 2.4)).toBe(true);
    expect(landmarkContains('university', -12, 5, 0)).toBe(false);
    expect(landmarkContains('university', -12, 11, -2.4)).toBe(true);
    expect(landmarkContains('university', 0, 5, 0)).toBe(false);
    for (const side of [-1, 1]) {
        expect(tabiatApproachHeight(side * 140, 0, 220, 225)).toBe(254.75);
        expect(tabiatApproachHeight(side * 220, 0, 220, 225)).toBeCloseTo(
            239.875
        );
        expect(tabiatApproachHeight(side * 300, 0, 220, 225)).toBe(225);
        expect(tabiatApproachHeight(side * 140, 77, 220, 225)).toBe(225);
    }
    expect(tabiatApproachHeight(0, 0, 220, 225)).toBe(225);
});
it('mirrors each university page across its book spine', () => {
    for (const spine of [-9.3, 9.3])
        for (const offset of [1, 3, 6, 8])
            for (const z of [-2.4, 0, 2.4])
                for (const y of [1, 5, 9, 9.8])
                    expect(
                        landmarkContains('university', spine - offset, y, z)
                    ).toBe(
                        landmarkContains('university', spine + offset, y, z)
                    );
});
it('extends the straight front piers before the pages turn outward', () => {
    for (const spine of [-9.3, 9.3])
        for (const direction of [-1, 1]) {
            const anchor = spine + direction * 0.65;
            expect(landmarkContains('university', anchor, 4.3, 2.4)).toBe(true);
            expect(landmarkContains('university', anchor, 5.2, 2.4)).toBe(
                false
            );
            expect(
                landmarkContains('university', anchor + direction, 4.3, 2.4)
            ).toBe(false);
        }
});
it('keeps the outer half of the university pages nearly level', () => {
    for (const spine of [-9.3, 9.3])
        for (const direction of [-1, 1]) {
            const x = spine + direction * (0.65 + 7.6 * 0.8);
            expect(landmarkContains('university', x, 9.65, 2.4)).toBe(true);
            expect(landmarkContains('university', x, 8.4, 2.4)).toBe(false);
        }
});
it('curves the rear edge down to its own pier and leaves the rear arch open', () => {
    for (const spine of [-9.3, 9.3])
        for (const direction of [-1, 1]) {
            const x = spine + direction * (0.65 + 7.6 * 0.8);
            expect(landmarkContains('university', x, 8.06, -2.4)).toBe(true);
            expect(landmarkContains('university', x, 11.3, -2.4)).toBe(false);
            expect(landmarkContains('university', x, 5, -2.4)).toBe(false);
        }
});
it('preserves open arches, bridge clearance and stadium interior', () => {
    expect(landmarkContains('azadi', 0, 10, 0)).toBe(false);
    expect(landmarkContains('azadi', 8, 4, 20)).toBe(true);
    expect(landmarkContains('azadi', 0, 32, 0)).toBe(true);
    expect(landmarkContains('milad', 0, 420, 0)).toBe(true);
    expect(landmarkContains('milad', 0, 440, 0)).toBe(false);
    expect(landmarkContains('tabiat', 40, 10, 0)).toBe(false);
    expect(landmarkContains('tabiat', 40, 30, 0)).toBe(true);
    expect(landmarkContains('stadium', 0, 10, 0)).toBe(false);
    expect(landmarkContains('stadium', 100, 10, 0)).toBe(true);
});

it('Azadi has four feet and unequal clear passages on both world axes', () => {
    const geometry = landmarkGeometry('azadi');
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    /** @param {'x'|'z'} axis @param {number} y */
    const ray = (axis, y) =>
        new THREE.Raycaster(
            new THREE.Vector3(
                axis === 'x' ? -100 : 0,
                y,
                axis === 'z' ? -100 : 0
            ),
            new THREE.Vector3(axis === 'x' ? 1 : 0, 0, axis === 'z' ? 1 : 0)
        ).intersectObject(mesh);
    for (const y of [2, 6, 10]) {
        expect(ray('x', y)).toHaveLength(0);
        expect(ray('z', y)).toHaveLength(0);
    }
    expect(ray('x', 20)).toHaveLength(0);
    expect(ray('z', 20).length).toBeGreaterThan(0);
    expect(ray('x', 35).length).toBeGreaterThan(0);
    for (const sx of [-1, 1])
        for (const sz of [-1, 1])
            expect(landmarkContains('azadi', sx * 8, 3, sz * 20)).toBe(true);
    for (let t = -35; t <= 35; t++) {
        expect(landmarkContains('azadi', t, 6, 0)).toBe(false);
        expect(landmarkContains('azadi', 0, 6, t)).toBe(false);
    }
    geometry.computeBoundingBox();
    if (!geometry.boundingBox) throw new Error('Missing Azadi bounds');
    expect(
        geometry.boundingBox.max.z - geometry.boundingBox.min.z
    ).toBeGreaterThan(60);
    expect(
        geometry.boundingBox.max.x - geometry.boundingBox.min.x
    ).toBeLessThan(25);
    geometry.dispose();
    material.dispose();
});
