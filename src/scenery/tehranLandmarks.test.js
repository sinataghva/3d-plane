import { it, expect } from 'vitest';
import * as THREE from 'three';
import { azadiGroovePoint } from './azadiTower.js';
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

it('Azadi vault descends behind the pointed entrance and collision follows its depth', () => {
    const geometry = landmarkGeometry('azadi');
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    for (const side of [-1, 1]) {
        const hits = new THREE.Raycaster(
            new THREE.Vector3(side * 20, 28, 0),
            new THREE.Vector3(-side, 0, 0)
        ).intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        // A real vaulted opening: its ceiling recedes from the outer facade,
        // unlike a decorative V on an otherwise flat wall.
        const x = Math.abs(hits[0].point.x);
        expect(x).toBeGreaterThan(2);
        expect(x).toBeLessThan(6.6);
        expect(landmarkContains('azadi', side * (x + 0.6), 28, 0)).toBe(false);
        expect(landmarkContains('azadi', side * (x - 0.6), 28, 0)).toBe(true);
    }
    expect(landmarkContains('azadi', 0, 44.1, 0)).toBe(true);
    expect(landmarkContains('azadi', 3.5, 44.1, 0)).toBe(false);
    expect(landmarkContains('azadi', 6.55, 44.4, 0)).toBe(true);
    geometry.dispose();
    material.dispose();
});

it('Azadi crown has re-entrant corners rather than a rectangular roof cap', () => {
    const geometry = landmarkGeometry('azadi');
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
            const hits = new THREE.Raycaster(
                new THREE.Vector3(sx * 7, 50, sz * 8),
                new THREE.Vector3(0, -1, 0)
            ).intersectObject(mesh);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].point.y).toBeLessThan(36);
            expect(landmarkContains('azadi', sx * 7, 43.8, sz * 8)).toBe(false);
            expect(landmarkContains('azadi', sx * 3, 43.8, sz * 3)).toBe(true);
        }
    geometry.dispose();
    material.dispose();
});

// A narrowing cluster can look like a solid dark stripe even when the mesh
// remains finite. Check physical separation and relative upper-pier direction.
it('keeps Azadi upper pier grooves separated and nearly parallel', () => {
    const pointsAt = (/** @type {number} */ y) =>
        Array.from({ length: 12 }, (_, i) =>
            azadiGroovePoint(y, (i + 0.5) / 12)
        );
    for (const y of [36, 38, 40, 42, 43.65]) {
        const points = pointsAt(y);
        const gaps = points.slice(1).map((p, i) => p.distanceTo(points[i]));
        expect(Math.min(...gaps)).toBeGreaterThan(0.65);
        expect(Math.max(...gaps) / Math.min(...gaps)).toBeLessThan(1.2);
    }
    const lower = pointsAt(36);
    const directions = pointsAt(43.65).map((p, i) =>
        p.sub(lower[i]).normalize()
    );
    for (let i = 1; i < directions.length; i++)
        expect(directions[i].dot(directions[i - 1])).toBeGreaterThan(0.999);
});

it('Milad has a broad lower head, clear upper mast and grounded podium', () => {
    expect(landmarkContains('milad', 30, 281, 0)).toBe(true);
    expect(landmarkContains('milad', 24, 300, 0)).toBe(false);
    expect(landmarkContains('milad', 5, 330, 0)).toBe(false);
    expect(landmarkContains('milad', 50, 5, 0)).toBe(true);
    expect(landmarkContains('milad', 50, 15, 0)).toBe(false);
    const geometry = landmarkGeometry('milad');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);
    for (const direction of [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 1)
    ]) {
        const origin = direction.clone().multiplyScalar(100).setY(100);
        const hits = new THREE.Raycaster(
            origin,
            direction.clone().negate()
        ).intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].distance).toBeGreaterThan(88);
        expect(hits[0].distance).toBeLessThan(91);
    }
    geometry.dispose();
    mesh.material.dispose();
});

it('Milad glass dome has a curved shoulder beneath the mast collar', () => {
    const geometry = landmarkGeometry('milad');
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const radius = (/** @type {number} */ y) => {
        const hits = new THREE.Raycaster(
            new THREE.Vector3(40, y, 0),
            new THREE.Vector3(-1, 0, 0)
        ).intersectObject(mesh);
        expect(hits.length).toBeGreaterThan(0);
        return hits[0].point.x;
    };
    expect(radius(300)).toBeGreaterThan(15);
    expect(radius(308)).toBeGreaterThan(11);
    expect(radius(308)).toBeLessThan(12);
    expect(radius(312)).toBeLessThan(7.2);
    expect(landmarkContains('milad', 2, 360, 0)).toBe(true);
    geometry.dispose();
    material.dispose();
});
