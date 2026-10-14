import { test, expect } from 'vitest';
import fs from 'node:fs';
import { createGeography } from './geography.js';
import { tehranLandmarks, createTehranLandmarks } from './tehranLandmarks.js';
import { miladBaseHeight } from './miladTower.js';

test('Milad entrance clears uphill terrain and its downhill foundation collides', () => {
    const data = JSON.parse(fs.readFileSync('data/tehran/map.json'));
    data.airfield = 'OIII';
    const world = createGeography(
        data,
        JSON.parse(fs.readFileSync('data/tehran/elevation.json')),
        { icao: 'OIII', runwayRef: '11R/29L' }
    );
    const l = tehranLandmarks(data).find((l) => l.id === 'milad');
    const base = miladBaseHeight(world.height, l.x, l.z);
    for (let radius = 0; radius <= 52; radius += 2)
        for (let i = 0; i < 128; i++) {
            const a = (i * Math.PI) / 64;
            const x = l.x + Math.sin(a) * radius,
                z = l.z + Math.cos(a) * radius;
            expect(base + 1 - world.height(x, z)).toBeGreaterThan(0.5);
        }
    const x = l.x - 50,
        z = l.z;
    expect(world.obstacle(x, z, world.height(x, z) + 1)).toBe('building');
    expect(world.obstacle(x, z, base + 5)).toBe('building');
    expect(world.obstacle(x, z, base + 12)).toBe('');
    const group = createTehranLandmarks(world);
    expect(group.getObjectByName('Milad Tower').position.y).toBe(base);
    group.traverse((o) => {
        if (o.isMesh) {
            o.geometry.dispose();
            o.material.dispose();
        }
    });
});
