import * as THREE from 'three';
import { expect, test } from 'vitest';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics,
    resetPlaneState
} from './physics.js';
import { createInputController } from './input.js';
import { createFlightAutomation } from '../automation/automation.js';
const physics = createPlanePhysics();
const wrap = (/** @type {number} */ a) => Math.atan2(Math.sin(a), Math.cos(a));
function flight() {
    const s = createPlaneState('mirage');
    Object.assign(s, {
        isAirborne: true,
        speed: 4,
        thrust: 1,
        enginePower: 1,
        gearDown: false,
        gearExtension: 0
    });
    s.position.y = 2500;
    return s;
}
/** @param {import('./physics.js').PlaneState} s @param {import('./input.js').KeyboardState} k */
function tick(s, k) {
    updatePlanePhysics({
        planeState: s,
        keyboard: k,
        planePhysics: physics,
        delta: 1 / 60
    });
}
test('elevator bends the banked flight path and high-G turns spend energy', () => {
    const coast = flight(),
        pull = flight();
    coast.rollAngle = pull.rollAngle = Math.PI / 3;
    const a = createInputController().state,
        b = createInputController().state;
    b.stickPitch = 1;
    for (let i = 0; i < 180; i++) {
        a.stickRoll =
            THREE.MathUtils.clamp((Math.PI / 3 - coast.rollAngle) * 3, -1, 1) ||
            1e-6;
        b.stickRoll =
            THREE.MathUtils.clamp((Math.PI / 3 - pull.rollAngle) * 3, -1, 1) ||
            1e-6;
        tick(coast, a);
        tick(pull, b);
    }
    const gentle = Math.abs(coast.yawAngle + Math.PI / 2),
        tight = Math.abs(pull.yawAngle + Math.PI / 2);
    expect(tight).toBeGreaterThan(gentle * 3);
    expect(pull.gForce).toBeGreaterThan(6);
    expect(pull.speed).toBeLessThan(coast.speed - 0.2);
    expect(pull.isCrashed).toBe(false);
});
test('continuous roll passes inverted and completes 360 degrees, then recovers on release', () => {
    const s = flight(),
        k = createInputController().state;
    k.stickRoll = 1;
    let traveled = 0,
        inverted = false;
    for (let i = 0; i < 180; i++) {
        const before = s.rollAngle;
        tick(s, k);
        traveled += wrap(s.rollAngle - before);
        if (Math.abs(s.rollAngle) > 3) inverted = true;
    }
    expect(inverted).toBe(true);
    expect(traveled).toBeGreaterThan(2 * Math.PI);
    k.stickRoll = 0;
    for (let i = 0; i < 240; i++) tick(s, k);
    expect(Math.abs(s.rollAngle)).toBeLessThan(0.02);
});
test('held elevator completes a loop through vertical and inverted orientations', () => {
    const s = flight(),
        k = createInputController().state;
    k.stickPitch = 1;
    k.boost = true;
    const forward = new THREE.Vector3();
    let traveled = 0,
        previous = 0,
        vertical = false;
    for (let i = 0; i < 2400 && traveled < Math.PI * 2; i++) {
        tick(s, k);
        const q = s.attitude;
        expect(q).toBeDefined();
        if (!q) throw new Error('Missing attitude');
        const orientation = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        expect(orientation.length()).toBeCloseTo(1, 8);
        forward.set(1, 0, 0).applyQuaternion(orientation);
        const angle = Math.atan2(forward.y, forward.z);
        traveled += wrap(angle - previous);
        previous = angle;
        if (Math.abs(forward.y) > 0.995) vertical = true;
    }
    expect(vertical).toBe(true);
    expect(traveled).toBeGreaterThanOrEqual(2 * Math.PI);
    expect(s.isCrashed).toBe(false);
    k.stickPitch = 0;
    tick(s, k);
    expect(s.elevatorManeuver).toBe(false);
});
test('rudder has useful yaw authority and inverted neutral controls recover', () => {
    const s = flight(),
        k = createInputController().state;
    k.d = true;
    for (let i = 0; i < 60; i++) tick(s, k);
    expect(Math.abs(s.yawAngle + Math.PI / 2)).toBeGreaterThan(0.1);
    const inverted = flight();
    inverted.rollAngle = Math.PI;
    k.d = false;
    for (let i = 0; i < 240; i++) tick(inverted, k);
    expect(Math.abs(inverted.rollAngle)).toBeLessThan(0.02);
});
test('gear moves progressively, reverses continuously, and resets down', () => {
    const s = flight(),
        k = createInputController().state;
    s.gearDown = true;
    for (let i = 0; i < 48; i++) tick(s, k);
    expect(s.gearExtension).toBeCloseTo(0.5, 6);
    s.gearDown = false;
    tick(s, k);
    expect(s.gearExtension).toBeGreaterThan(0.48);
    expect(s.gearExtension).toBeLessThan(0.5);
    for (let i = 0; i < 48; i++) tick(s, k);
    expect(s.gearExtension).toBe(0);
    resetPlaneState(s);
    expect(s.gearExtension).toBe(1);
    expect(s.attitude).toBeUndefined();
});
test('touch stick reaches full jet maneuver authority without changing light aircraft', () => {
    const jet = createInputController('mirage'),
        light = createInputController();
    jet.beginStick(1);
    light.beginStick(1);
    jet.moveStick(1, 1, 1);
    light.moveStick(1, 1, 1);
    expect(jet.state.stickPitch).toBe(1);
    expect(jet.state.stickRoll).toBe(1);
    expect(light.state.stickPitch).toBe(0.34);
    expect(light.state.stickRoll).toBe(0.46);
});
test('automation telemetry cannot mutate the authoritative attitude', () => {
    const s = flight(),
        k = createInputController().state;
    tick(s, k);
    const api = createFlightAutomation({
        planeState: s,
        advance: () => {},
        reset: () => {},
        render: () => {}
    });
    const telemetry = api.getState();
    if (telemetry.plane.attitude) telemetry.plane.attitude.w = 123;
    expect(s.attitude?.w).not.toBe(123);
});

test('releasing bank while holding elevator preserves an ordinary turn', () => {
    const s = flight(),
        k = createInputController().state;
    s.rollAngle = Math.PI / 3;
    k.stickPitch = 0.6;
    const before = s.yawAngle;
    for (let i = 0; i < 90; i++) tick(s, k);
    expect(Math.abs(s.rollAngle)).toBeGreaterThan(0.9);
    expect(Math.abs(s.yawAngle - before)).toBeGreaterThan(0.2);
    k.stickPitch = 0;
    for (let i = 0; i < 180; i++) tick(s, k);
    expect(Math.abs(s.rollAngle)).toBeLessThan(0.03);
});
test('holding S brakes only at idle and release retracts smoothly', () => {
    const s = flight(),
        k = createInputController().state;
    s.thrust = 0.1;
    k.s = true;
    tick(s, k);
    expect(s.airbrake).toBe(false);
    for (let i = 0; i < 60; i++) tick(s, k);
    expect(s.thrust).toBe(0);
    expect(s.airbrake).toBe(true);
    expect(s.airbrakeExtension).toBe(1);
    k.s = false;
    tick(s, k);
    expect(s.airbrake).toBe(false);
    expect(s.airbrakeExtension).toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) tick(s, k);
    expect(s.airbrakeExtension).toBe(0);
    expect(s.thrust).toBe(0);
});
