import { test, expect } from 'vitest';
import { buildingLightSeed } from './buildingLights.js';
test('civilian occupancy stays stable and leaves most buildings dark', () => {
    const ids = Array.from({ length: 1000 }, (_, i) => 'way/' + i);
    const first = ids.map((id) => buildingLightSeed(id));
    expect(ids.map((id) => buildingLightSeed(id))).toEqual(first);
    const lit = first.filter(Boolean).length;
    expect(lit).toBeGreaterThan(250);
    expect(lit).toBeLessThan(400);
    for (const type of ['hangar', 'garage', 'shed', 'industrial', 'warehouse'])
        expect(ids.every((id) => buildingLightSeed(id, type) === 0)).toBe(true);
});
