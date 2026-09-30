import { expect, it } from 'vitest';
import { createPlaneState } from './physics.js';
import { flightSnapshot, restoreFlightSnapshot } from './recovery.js';

const world = {
    minX: -1000,
    maxX: 1000,
    minZ: -1000,
    maxZ: 1000,
    height: () => 0
};

it('restores a recent checkpoint only for the same flight and valid position', () => {
    const original = createPlaneState('phantom');
    original.position = { x: 100, y: 200, z: 300 };
    original.speed = 2;
    original.isAirborne = true;
    original.attitude = { x: 0, y: 0, z: 0, w: 1 };
    const snapshot = flightSnapshot(original, 'tehran', 10000);
    const resumed = createPlaneState('phantom');

    expect(
        restoreFlightSnapshot(snapshot, resumed, world, 'tehran', 11000)
    ).toBe(true);
    expect(resumed.position).toEqual(original.position);
    expect(resumed.speed).toBe(2);
    expect(resumed.attitude).toEqual(original.attitude);
    expect(
        restoreFlightSnapshot(snapshot, resumed, world, 'luxeuil', 11000)
    ).toBe(false);
    expect(
        restoreFlightSnapshot(snapshot, resumed, world, 'tehran', 700001)
    ).toBe(false);
    snapshot.state.position = { x: 2000, y: 200, z: 300 };
    expect(
        restoreFlightSnapshot(snapshot, resumed, world, 'tehran', 11000)
    ).toBe(false);
});
