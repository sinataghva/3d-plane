import { it, expect } from 'vitest';
import { createPlaneState } from './physics.js';
import { createUnattendedFlight } from './unattendedFlight.js';
const world = { height: () => 0, obstacle: () => null };
it('holds airborne velocity instead of freezing or repeating turn input', () => {
    const state = createPlaneState('phantom');
    Object.assign(state, {
        isAirborne: true,
        speed: 2,
        verticalSpeed: 0.1,
        position: { x: 0, y: 500, z: 0 },
        yawAngle: 0,
        pitchAngle: 0,
        rollAngle: 0
    });
    const hold = createUnattendedFlight(state, world);
    for (let n = 0; n < 600; n++) hold.update(1 / 60);
    expect(state.position.x).toBeCloseTo(1200);
    expect(state.position.y).toBeCloseTo(560);
});
it('keeps a parked aircraft parked and checks obstacles while moving', () => {
    const state = createPlaneState('phantom');
    const p = { ...state.position };
    createUnattendedFlight(state, world).update(10);
    expect(state.position).toEqual(p);
    Object.assign(state, {
        isAirborne: true,
        speed: 2,
        yawAngle: 0,
        pitchAngle: 0,
        rollAngle: 0,
        position: { x: 0, y: 500, z: 0 }
    });
    createUnattendedFlight(state, {
        ...world,
        obstacle: (x) => (x > 5 ? 'building' : null)
    }).update(1);
    expect(state.isCrashed).toBe(true);
    expect(state.position.x).toBeLessThan(8);
});
