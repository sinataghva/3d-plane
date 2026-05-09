import { describe, expect, it } from 'vitest';

import {
    createPlanePhysics,
    createPlaneState,
    resetPlaneState,
    updatePlanePhysics
} from './physics.js';

const FRAME_DELTA = 1 / 60;

function createKeyboard(overrides = {}) {
    return {
        w: false,
        s: false,
        a: false,
        d: false,
        arrowLeft: false,
        arrowRight: false,
        arrowUp: false,
        arrowDown: false,
        ...overrides
    };
}

function update({
    planeState = createPlaneState(),
    keyboard = createKeyboard(),
    planePhysics = createPlanePhysics(),
    delta = FRAME_DELTA
} = {}) {
    updatePlanePhysics({ planeState, keyboard, planePhysics, delta });
    return planeState;
}

describe('plane physics', () => {
    it('raises thrust while W is held and speed builds from thrust against drag', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        const keyboard = createKeyboard({ w: true });

        update({ planeState, planePhysics, keyboard });
        expect(planeState.thrust).toBeGreaterThan(0);

        for (let i = 0; i < 100; i++) {
            update({ planeState, planePhysics, keyboard });
        }

        expect(planeState.thrust).toBe(planePhysics.maxThrust);
        expect(planeState.speed).toBeGreaterThan(1);
        expect(planeState.speed).toBeLessThanOrEqual(planePhysics.maxSpeed);
    });

    it('lowers thrust while S is held', () => {
        const planeState = createPlaneState();
        planeState.thrust = 0.5;

        update({ planeState, keyboard: createKeyboard({ s: true }) });

        expect(planeState.thrust).toBeLessThan(0.5);
    });

    it('applies friction when throttle is released without going below zero', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.speed = 0.02;
        planeState.thrust = 0;

        update({ planeState, planePhysics });
        expect(planeState.speed).toBeCloseTo(0.01);

        update({ planeState, planePhysics });
        update({ planeState, planePhysics });

        expect(planeState.speed).toBe(0);
    });

    it('rotates and lifts off with enough speed and pitch input', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        const keyboard = createKeyboard({ arrowDown: true });
        planeState.speed = planePhysics.maxSpeed;

        for (let i = 0; i < 18; i++) {
            update({ planeState, planePhysics, keyboard });
        }

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

    it('crashes on hard ground impact', () => {
        const planeState = createPlaneState();
        planeState.position.y = 0.51;
        planeState.isAirborne = true;
        planeState.speed = 1.2;
        planeState.thrust = 0.4;
        planeState.verticalSpeed = -0.18;

        update({ planeState });

        expect(planeState.position.y).toBe(0.5);
        expect(planeState.isCrashed).toBe(true);
        expect(planeState.isAirborne).toBe(false);
        expect(planeState.speed).toBe(0);
        expect(planeState.thrust).toBe(0);
        expect(planeState.crashImpact).toBeGreaterThan(0);
    });

    it('allows a gentle landing without crashing', () => {
        const planeState = createPlaneState();
        planeState.position.y = 0.53;
        planeState.isAirborne = true;
        planeState.speed = 0.8;
        planeState.verticalSpeed = -0.02;

        update({ planeState });

        expect(planeState.position.y).toBe(0.5);
        expect(planeState.isCrashed).toBe(false);
        expect(planeState.isAirborne).toBe(false);
    });

    it('does not continue physics updates after a crash', () => {
        const planeState = createPlaneState();
        planeState.isCrashed = true;
        planeState.speed = 0;
        planeState.thrust = 0;
        const initialYaw = planeState.yawAngle;

        update({
            planeState,
            keyboard: createKeyboard({ w: true, a: true }),
            delta: FRAME_DELTA * 20
        });

        expect(planeState.thrust).toBe(0);
        expect(planeState.yawAngle).toBe(initialYaw);
    });

    it('resets a crashed plane to the runway start state', () => {
        const planeState = createPlaneState();
        planeState.position.x = 40;
        planeState.position.y = 0.5;
        planeState.position.z = 20;
        planeState.speed = 1.4;
        planeState.thrust = 0.8;
        planeState.isCrashed = true;
        planeState.crashImpact = 0.2;

        resetPlaneState(planeState);

        expect(planeState).toMatchObject(createPlaneState());
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

    it('does not yaw in place from rudder input at zero speed', () => {
        const planeState = createPlaneState();
        const initialYaw = planeState.yawAngle;

        update({ planeState, keyboard: createKeyboard({ a: true }) });

        expect(planeState.yawAngle).toBe(initialYaw);
    });

    it('descends instead of hovering when airborne with no airspeed', () => {
        const planeState = createPlaneState();
        planeState.position.y = 12;
        planeState.isAirborne = true;
        planeState.speed = 0;

        update({ planeState });

        expect(planeState.position.y).toBeLessThan(12);
        expect(planeState.verticalSpeed).toBeLessThan(0);
        expect(planeState.isStalling).toBe(true);
    });

    it('scales rudder authority with airspeed', () => {
        const slowState = createPlaneState();
        const fastState = createPlaneState();
        slowState.speed = 0.25;
        fastState.speed = 1.5;
        const keyboard = createKeyboard({ a: true });

        update({ planeState: slowState, keyboard });
        update({ planeState: fastState, keyboard });

        expect(
            fastState.yawAngle - createPlaneState().yawAngle
        ).toBeGreaterThan(slowState.yawAngle - createPlaneState().yawAngle);
    });

    it('moves upward along the nose direction when pitched up in flight', () => {
        const planeState = createPlaneState();
        planeState.position.y = 10;
        planeState.isAirborne = true;
        planeState.speed = 1.6;
        planeState.pitchAngle = 0.45;
        const initialAltitude = planeState.position.y;

        update({ planeState });

        expect(planeState.position.y).toBeGreaterThan(initialAltitude);
    });

    it('dives along the nose direction instead of only settling from lift', () => {
        const neutralState = createPlaneState();
        neutralState.position.y = 10;
        neutralState.isAirborne = true;
        neutralState.speed = 1.5;

        const divingState = createPlaneState();
        divingState.position.y = 10;
        divingState.isAirborne = true;
        divingState.speed = 1.5;
        divingState.pitchAngle = -0.45;

        update({ planeState: neutralState });
        update({ planeState: divingState });

        expect(divingState.position.y).toBeLessThan(neutralState.position.y);
        expect(neutralState.position.y - divingState.position.y).toBeGreaterThan(
            0.05
        );
    });

    it('trades speed for altitude when climbing', () => {
        const planeState = createPlaneState();
        planeState.position.y = 10;
        planeState.isAirborne = true;
        planeState.speed = 1.5;
        planeState.thrust = 0;
        planeState.pitchAngle = 0.45;
        const initialSpeed = planeState.speed;

        update({ planeState });

        expect(planeState.speed).toBeLessThan(initialSpeed);
    });

    it('can gain speed from gravity when descending without thrust', () => {
        const planeState = createPlaneState();
        planeState.position.y = 10;
        planeState.isAirborne = true;
        planeState.speed = 1.5;
        planeState.thrust = 0;
        planeState.pitchAngle = -0.45;
        const initialSpeed = planeState.speed;

        update({ planeState });

        expect(planeState.speed).toBeGreaterThan(initialSpeed);
    });

    it('allows a controlled flare landing without crashing', () => {
        const planeState = createPlaneState();
        planeState.position.y = 0.56;
        planeState.isAirborne = true;
        planeState.speed = 1.1;
        planeState.pitchAngle = 0.16;
        planeState.verticalSpeed = -0.14;

        update({ planeState });

        expect(planeState.position.y).toBe(0.5);
        expect(planeState.isAirborne).toBe(false);
        expect(planeState.isCrashed).toBe(false);
    });

    it('settles gently at neutral pitch instead of climbing or dropping fast', () => {
        const planeState = createPlaneState();
        const planePhysics = createPlanePhysics();
        planeState.position.y = 10;
        planeState.isAirborne = true;
        planeState.speed = planePhysics.maxSpeed;
        planeState.pitchAngle = 0;
        const initialAltitude = planeState.position.y;

        update({ planeState, planePhysics });

        expect(planeState.position.y).toBeLessThan(initialAltitude);
        expect(initialAltitude - planeState.position.y).toBeLessThan(0.01);
        expect(planeState.lift).toBeGreaterThan(0);
        expect(planeState.lift).toBeLessThan(planePhysics.gravity);
    });

    it('holds airborne pitch when pitch input is released at safe speed', () => {
        const planeState = createPlaneState();
        planeState.position.y = 10;
        planeState.isAirborne = true;
        planeState.speed = createPlanePhysics().maxSpeed;
        planeState.pitchAngle = 0.28;

        update({ planeState });

        expect(planeState.pitchAngle).toBeCloseTo(0.28);
    });

    it('can roll past the old artificial bank limit while input is held', () => {
        const planeState = createPlaneState();
        planeState.isAirborne = true;
        planeState.speed = createPlanePhysics().maxSpeed;
        planeState.pitchAngle = 0.3;
        const keyboard = createKeyboard({ arrowRight: true });

        for (let i = 0; i < 50; i++) {
            update({ planeState, keyboard });
        }

        expect(planeState.rollAngle).toBeGreaterThan(0.8);
    });

    it('can pitch past the old artificial pitch limit while input is held', () => {
        const planeState = createPlaneState();
        planeState.isAirborne = true;
        planeState.speed = createPlanePhysics().maxSpeed;
        planeState.thrust = 1;
        const keyboard = createKeyboard({ arrowDown: true });

        for (let i = 0; i < 50; i++) {
            update({ planeState, keyboard });
        }

        expect(planeState.pitchAngle).toBeGreaterThan(0.5);
    });

    it('scales updates by elapsed time', () => {
        const oneFrameState = createPlaneState();
        const twoFrameState = createPlaneState();
        const planePhysics = createPlanePhysics();
        const keyboard = createKeyboard({ w: true });

        update({
            planeState: oneFrameState,
            planePhysics,
            keyboard,
            delta: FRAME_DELTA
        });
        update({
            planeState: twoFrameState,
            planePhysics,
            keyboard,
            delta: FRAME_DELTA * 2
        });

        expect(twoFrameState.speed).toBeCloseTo(oneFrameState.speed * 2);
    });
});
