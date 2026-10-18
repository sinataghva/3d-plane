import { test, expect } from 'vitest';
import * as THREE from 'three';
import { cutStadiumTerrain } from './stadiumTerrain.js';
import { STADIUM_PORTALS, STADIUM_SOUTH_APPROACH } from './stadiumExterior.js';

test('terrain opening exposes the recessed pitch while preserving terrain and UVs outside', () => {
    const original = new THREE.PlaneGeometry(800, 800, 16, 16).rotateX(
        -Math.PI / 2
    );
    const p = original.getAttribute('position');
    for (let i = 0; i < p.count; i++) p.setY(i, 20 + p.getX(i) * 0.01);
    const clipped = cutStadiumTerrain(original, { x: 0, z: 0 });
    const mesh = new THREE.Mesh(
        clipped,
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    mesh.updateMatrixWorld();
    const hit = (x, z) =>
        new THREE.Raycaster(
            new THREE.Vector3(x, 100, z),
            new THREE.Vector3(0, -1, 0)
        ).intersectObject(mesh);
    expect(hit(0, 0)).toHaveLength(0);
    expect(hit(0, 90)).toHaveLength(0);
    const outside = hit(200, 30)[0];
    expect(outside.point.y).toBeCloseTo(22, 5);
    expect(outside.uv.x).toBeCloseTo(0.75, 5);
    clipped.dispose();
    mesh.material.dispose();
});

test('southern portals share an approach axis through two different embankments', () => {
    const [inner, outer] = STADIUM_PORTALS.slice(-2);
    expect(inner.floor).toBeGreaterThan(outer.floor);
    expect(inner.nx).toBe(outer.nx);
    expect(inner.nz).toBe(outer.nz);
    expect(
        (outer.x - inner.x) * inner.nz - (outer.z - inner.z) * inner.nx
    ).toBeCloseTo(0, 8);
    expect(
        (outer.x - inner.x) * inner.nx + (outer.z - inner.z) * inner.nz
    ).toBeGreaterThan(inner.depth);
});

test('southern tunnel mouths follow the existing cached road, not a radial approximation', () => {
    const [a, b] = STADIUM_SOUTH_APPROACH;
    const dx = b[0] - a[0],
        dz = b[1] - a[1];
    const length = Math.hypot(dx, dz);
    for (const p of STADIUM_PORTALS.slice(-2)) {
        expect(((p.x - a[0]) * dz - (p.z - a[1]) * dx) / length).toBeCloseTo(
            0,
            8
        );
        expect(p.nx).toBeCloseTo(dx / length, 8);
        expect(p.nz).toBeCloseTo(dz / length, 8);
    }
});
