import { expect, it } from 'vitest';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { createInputController } from './input.js';
import { getVerticalSpeed, getEffectiveStallSpeed } from './flightMetrics.js';
import { formatHeading } from '../ui/hud.js';
import { getActiveFlightWarning } from '../ui/warnings.js';

it('reports the actual altitude change, including the nose-directed flight path', () => {
    const state = createPlaneState();
    Object.assign(state, {
        isAirborne: true,
        speed: 1.5,
        thrust: 0.7,
        pitchAngle: 0.2,
        verticalSpeed: -0.02
    });
    state.position.y = 100;
    updatePlanePhysics({
        planeState: state,
        planePhysics: createPlanePhysics(),
        keyboard: createInputController().state,
        delta: 1 / 60
    });
    expect(getVerticalSpeed(state)).toBeCloseTo(state.position.y - 100, 10);
    state.isAirborne = false;
    expect(getVerticalSpeed(state)).toBe(0);
});
it('uses flap-adjusted stall speed consistently in warnings', () => {
    const state = createPlaneState();
    Object.assign(state, { isAirborne: true, speed: 0.82, flapDeployment: 1 });
    state.position.y = 100;
    expect(getEffectiveStallSpeed(state)).toBeCloseTo(0.67);
    expect(
        getActiveFlightWarning({ planeState: state, stallSpeed: 0.85 })
    ).toBeNull();
});
it('warns about terrain when pitch causes descent despite a positive lift component', () => {
    const state = createPlaneState();
    Object.assign(state, {
        isAirborne: true,
        speed: 1.5,
        pitchAngle: -0.5,
        verticalSpeed: 0.03
    });
    state.position.y = 10;
    expect(
        getActiveFlightWarning({ planeState: state, stallSpeed: 0.85 })?.label
    ).toBe('Terrain');
});
it('normalizes headings through multiple turns and north rounding', () => {
    expect(formatHeading(-Math.PI / 2)).toBe('180');
    expect(formatHeading(Math.PI / 2)).toBe('000');
    expect(formatHeading(Math.PI / 2 + 8 * Math.PI)).toBe('000');
    expect(formatHeading(Math.PI / 2 + 0.001)).toBe('000');
});
