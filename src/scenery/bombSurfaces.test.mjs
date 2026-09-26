import { test, expect } from 'vitest';
import { Vector3 } from 'three';
import { createBombSurfaces } from './bombSurfaces.js';
const world = {
    minX: -500,
    maxX: 500,
    minZ: -500,
    maxZ: 500,
    width: 1000,
    depth: 1000,
    height: (x, z) => x * 0.02 + z * 0.01,
    obstacle: (x, z, y) =>
        x > 30 && x < 40 && Math.abs(z) < 10 && y < 20
            ? 'building'
            : x < -20 && y < 2
              ? 'water'
              : ''
};
test('fast swept intersections see thin buildings, sloped terrain and water', () => {
    const s = createBombSurfaces(world);
    expect(s.sweep(new Vector3(0, 10, 0), new Vector3(100, 10, 0)).kind).toBe(
        'building'
    );
    const hit = s.sweep(new Vector3(100, 50, 50), new Vector3(100, -50, 50));
    expect(hit.kind).toBe('ground');
    expect(Math.abs(hit.position.y - s.height(100, 50) - 0.05)).toBeLessThan(
        0.01
    );
    expect(
        s.sweep(new Vector3(-30, 30, 0), new Vector3(-30, -30, 0)).kind
    ).toBe('water');
});
test('no intersection outside supported bounds', () => {
    const s = createBombSurfaces(world);
    expect(
        s.sweep(new Vector3(1000, 5, 0), new Vector3(1000, -5, 0))
    ).toBeNull();
});
