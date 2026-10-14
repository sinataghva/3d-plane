import { test, expect, vi } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import {
    createAzadiStadiumGeometry,
    stadiumBowlPoint,
    stadiumInside,
    stadiumContains
} from './azadiStadium.js';
import { createGeography } from './geography.js';

test('stadium joins stay continuous at both ends of each straight', () => {
    for (const t of [0, 0.43, 0.5, 1])
        for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            const p = stadiumBowlPoint(a - 0.001, t),
                q = stadiumBowlPoint(a + 0.001, t);
            expect(Math.hypot(p[0] - q[0], p[1] - q[1])).toBeLessThan(1);
        }
});
test('stadium has opaque seating and upward track faces', () => {
    const g = createAzadiStadiumGeometry(),
        m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        mesh = new THREE.Mesh(g, m);
    mesh.updateMatrixWorld(true);
    for (const t of [0.12, 0.3, 0.65, 0.9])
        for (let i = 0; i < 32; i++) {
            const p = stadiumBowlPoint(((i + 0.4) * Math.PI) / 16, t);
            const hits = new THREE.Raycaster(
                new THREE.Vector3(p[0], 80, p[1]),
                new THREE.Vector3(0, -1, 0)
            ).intersectObject(mesh);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].point.y).toBeGreaterThan(2);
            expect(hits[0].face.normal.y).toBeGreaterThan(0);
        }
    for (const x of [0, 39, 43]) {
        const hits = new THREE.Raycaster(
            new THREE.Vector3(x, 10, 12),
            new THREE.Vector3(0, -1, 0)
        ).intersectObject(mesh);
        expect(hits[0].point.y).toBeLessThan(0.2);
        expect(hits[0].face.normal.y).toBeGreaterThan(0);
    }
    g.dispose();
    m.dispose();
});
test('real stadium platform clears every underlying terrain sample and matches flight contact', () => {
    const data = JSON.parse(fs.readFileSync('data/tehran/map.json'));
    data.airfield = 'OIII';
    const world = createGeography(
        data,
        JSON.parse(fs.readFileSync('data/tehran/elevation.json')),
        { icao: 'OIII', runwayRef: '11R/29L' }
    );
    const { x, z, base } = world.stadium;
    for (let dx = -165; dx <= 165; dx += 3)
        for (let dz = -182; dz <= 182; dz += 3)
            if (stadiumInside(dx, dz)) {
                expect(
                    base - world.terrainHeight(x + dx, z + dz)
                ).toBeGreaterThan(1);
                expect(world.height(x + dx, z + dz)).toBe(base);
            }
    expect(world.obstacle(x, z, base - 0.1)).toBe('building');
    expect(world.obstacle(x, z, base + 1)).toBe('');
    // Replacement annexes must not leave invisible eight-metre obstacles.
    expect(world.obstacle(x + 125, z, base + 45)).toBe('');
});

test('stadium collision retains tier heights without nested searches for marker probes', () => {
    for (const [t, height] of [
        [0.2, 2 + (0.2 / 0.43) * 13],
        [0.47, 15],
        [0.75, 28]
    ])
        for (let i = 0; i < 32; i++) {
            const [x, z] = stadiumBowlPoint((i * Math.PI) / 16, t);
            expect(stadiumContains(x, height - 0.1, z)).toBe(true);
            expect(stadiumContains(x, height + 0.1, z)).toBe(false);
        }
    expect(stadiumContains(0, 1, 0)).toBe(false);
    expect(stadiumContains(0, -0.1, 0)).toBe(true);
    const spy = vi.spyOn(Math, 'atan2');
    try {
        stadiumContains(80, 434, 20);
        expect(spy).not.toHaveBeenCalled();
        stadiumContains(80, 12, 20);
        expect(spy.mock.calls.length).toBeLessThanOrEqual(17);
    } finally {
        spy.mockRestore();
    }
});
