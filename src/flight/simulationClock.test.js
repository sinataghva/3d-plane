import { describe, expect, it } from 'vitest';
import { createSimulationClock } from './simulationClock.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { createInputController } from './input.js';

/** @param {number} fps */
function fly(fps) {
    const state = createPlaneState();
    Object.assign(state, {
        position: { x: 0, y: 100, z: 0 },
        speed: 1.5,
        thrust: 0.65,
        isAirborne: true,
        pitchAngle: 0.08
    });
    const clock = createSimulationClock();
    const physics = createPlanePhysics();
    const keyboard = createInputController().state;
    let tick = 0;
    for (let frame = 0; frame < fps * 5; frame++)
        clock.update(1 / fps, (delta) => {
            // Bank briefly, then release: the existing wing-leveling behavior remains.
            keyboard.arrowRight = tick >= 30 && tick < 45;
            updatePlanePhysics({
                planeState: state,
                planePhysics: physics,
                keyboard,
                delta
            });
            tick++;
        });
    return { state, tick };
}

describe('fixed simulation clock', () => {
    it('produces identical flights at 30, 60, 120 and 144 FPS', () => {
        const expected = fly(60);
        expect(expected.tick).toBe(300);
        expect(expected.state.rollAngle).toBe(0);
        for (const fps of [30, 120, 144]) expect(fly(fps)).toEqual(expected);
    });
    it('clears fractional time on suspension and bounds long catch-up', () => {
        const clock = createSimulationClock();
        let steps = 0;
        const advance = () => steps++;
        clock.update(1 / 120, advance);
        clock.reset();
        clock.update(1 / 120, advance);
        expect(steps).toBe(0);
        clock.update(1 / 120, advance);
        expect(steps).toBe(1);
        clock.update(60, advance);
        expect(steps).toBe(16);
        clock.update(NaN, advance);
        clock.update(-1, advance);
        expect(steps).toBe(16);
    });
});
