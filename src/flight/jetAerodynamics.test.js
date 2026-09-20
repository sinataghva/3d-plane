import { test, expect } from 'vitest';
import { jetDrag, MACH_REFERENCE_SPEED } from './jetAerodynamics.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { createInputController } from './input.js';
const clean = { gear: 0, gForce: 1, rudder: 0, airborne: true };
/** @param {number} power @param {number} pitch @param {number} [gear] */
function terminalSpeed(power, pitch, gear = 0) {
    let speed = 0;
    for (let i = 0; i < 600 * 60; i++)
        speed = Math.max(
            0,
            speed +
                (power -
                    jetDrag(speed, { ...clean, gear }) -
                    9.81 * Math.sin(pitch)) /
                    60
        );
    return speed / MACH_REFERENCE_SPEED;
}
test('drag rises continuously through transonic and supersonic speeds', () => {
    let previous = jetDrag(0, clean);
    for (let speed = 1; speed <= 1200; speed++) {
        const drag = jetDrag(speed, clean);
        expect(drag).toBeGreaterThan(previous);
        previous = drag;
    }
    for (const mach of [0.8, 1.05, 1.6]) {
        const v = mach * MACH_REFERENCE_SPEED;
        expect(
            Math.abs(jetDrag(v + 0.001, clean) - jetDrag(v - 0.001, clean))
        ).toBeLessThan(0.01);
    }
});
test('clean boost approaches Mach 2 through force balance, and dives exceed level equilibrium', () => {
    const dry = terminalSpeed(10, 0),
        boost = terminalSpeed(17, 0),
        dive = terminalSpeed(17, -Math.PI / 6);
    expect(dry).toBeGreaterThan(0.95);
    expect(dry).toBeLessThan(1.1);
    expect(boost).toBeGreaterThan(1.95);
    expect(boost).toBeLessThan(2.05);
    expect(dive).toBeGreaterThan(boost + 0.2);
    expect(terminalSpeed(17, 0, 1)).toBeLessThan(0.95);
});
/** @param {number} pitch @param {number} speed */
function flight(pitch, speed) {
    const state = createPlaneState('mirage');
    Object.assign(state, {
        position: { x: 0, y: 10000, z: 0 },
        yawAngle: 0,
        pitchAngle: pitch,
        rollAngle: 0,
        speed: speed / 60,
        isAirborne: true,
        thrust: 1,
        enginePower: 1,
        gearDown: false,
        gearExtension: 0
    });
    return state;
}
/** @param {import('./physics.js').PlaneState} state @param {number} [frames] @param {boolean} [brake] */
function advance(state, frames = 1, brake = false) {
    const input = createInputController().state;
    input.boost = true;
    input.brake = brake;
    for (let i = 0; i < frames; i++)
        updatePlanePhysics({
            planeState: state,
            keyboard: input,
            planePhysics: createPlanePhysics(),
            delta: 1 / 60
        });
}
test('physics retains speed above the former cap and slows excessive speed progressively', () => {
    const fast = flight(0, 500);
    advance(fast);
    expect(fast.speed * 60).toBeGreaterThan(500);
    const excessive = flight(0, 850);
    advance(excessive);
    expect(excessive.speed * 60).toBeLessThan(850);
    expect(excessive.speed * 60).toBeGreaterThan(849);
});
test('a dive gains more speed than level flight; airbrakes and pull-up cost energy', () => {
    const level = flight(0, 500),
        dive = flight(-Math.PI / 6, 500),
        braking = flight(0, 500);
    advance(level, 120);
    advance(dive, 120);
    advance(braking, 120, true);
    expect(dive.speed * 60).toBeGreaterThan(level.speed * 60 + 8);
    expect(braking.speed).toBeLessThan(level.speed);
    expect(jetDrag(500, { ...clean, gForce: 6 })).toBeGreaterThan(
        jetDrag(500, clean) + 7
    );
});
