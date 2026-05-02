import { describe, expect, it } from 'vitest';

import { createPlanePhysics, createPlaneState, updatePlanePhysics } from './physics.js';

const FRAME_DELTA = 1 / 60;

function createKeyboard(overrides = {}) {
    return {
        w: false,
        a: false,
        d: false,
        arrowLeft: false,
        arrowRight: false,
        arrowUp: false,
        arrowDown: false,
        ...overrides
    };
}

function update({ planeState = createPlaneState(), keyboard = createKeyboard(), planePhysics = createPlanePhysics(), delta = FRAME_DELTA } = {}) {
    updatePlanePhysics({ planeState, keyboard, planePhysics, delta });
    return planeState;
}

describe('plane physics', () => {
    it('accelerates while throttle is held and caps at max speed', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        const keyboard = createKeyboard({ w: true });

        update({ planeState, planePhysics, keyboard });
        expect(planeState.speed).toBeCloseTo(planePhysics.acceleration);

        for (let i = 0; i < 100; i++) {
            update({ planeState, planePhysics, keyboard });
        }

        expect(planeState.speed).toBe(planePhysics.maxSpeed);
    });

    it('applies friction when throttle is released without going below zero', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.speed = 0.02;

        update({ planeState, planePhysics });
        expect(planeState.speed).toBeCloseTo(0.01);

        update({ planeState, planePhysics });
        update({ planeState, planePhysics });

        expect(planeState.speed).toBe(0);
    });

    it('generates lift and marks the plane airborne with enough speed and pitch', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.speed = planePhysics.maxSpeed;
        planeState.pitchAngle = 0.5;

        update({ planeState, planePhysics });

        expect(planeState.lift).toBeGreaterThan(0);
        expect(planeState.position.y).toBeGreaterThan(0.5);
        expect(planeState.isAirborne).toBe(true);
    });

    it('keeps the plane from sinking below ground level', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.position.y = 0.51;

        update({ planeState, planePhysics });

        expect(planeState.position.y).toBe(0.5);
        expect(planeState.isAirborne).toBe(false);
    });

    it('stops the plane at the runway barrier while on the ground', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.position.z = 144.6;
        planeState.speed = 0.5;

        update({ planeState, planePhysics });

        expect(planeState.position.z).toBe(144.5);
        expect(planeState.speed).toBe(0);
    });

    it('scales updates by elapsed time', () => {
        const oneFrameState = createPlaneState();
        const twoFrameState = createPlaneState();
        const planePhysics = createPlanePhysics();
        const keyboard = createKeyboard({ w: true });

        update({ planeState: oneFrameState, planePhysics, keyboard, delta: FRAME_DELTA });
        update({ planeState: twoFrameState, planePhysics, keyboard, delta: FRAME_DELTA * 2 });

        expect(twoFrameState.speed).toBeCloseTo(oneFrameState.speed * 2);
    });
});
