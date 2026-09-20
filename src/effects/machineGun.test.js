import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
    createMachineGun,
    MACHINE_GUN_FIRE_INTERVAL,
    MACHINE_GUN_RANGE
} from './machineGun.js';
import { createPlaneState } from '../flight/physics.js';

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
        space: false,
        stickRoll: 0,
        stickPitch: 0,
        ...overrides
    };
}

describe('machine gun tracers', () => {
    it('fires paired tracers while space is held', () => {
        const scene = new THREE.Scene();
        const planeState = createPlaneState();
        const machineGun = createMachineGun(scene);

        machineGun.update({
            planeState,
            keyboard: createKeyboard({ space: true }),
            delta: 1 / 60
        });

        expect(machineGun.tracers).toHaveLength(2);
        expect(scene.children).toHaveLength(2);
    });

    it('rate limits tracer bursts', () => {
        const scene = new THREE.Scene();
        const planeState = createPlaneState();
        const keyboard = createKeyboard({ space: true });
        const machineGun = createMachineGun(scene);

        machineGun.update({ planeState, keyboard, delta: 1 / 60 });
        machineGun.update({
            planeState,
            keyboard,
            delta: MACHINE_GUN_FIRE_INTERVAL * 0.5
        });

        expect(machineGun.tracers).toHaveLength(2);

        machineGun.update({
            planeState,
            keyboard,
            delta: MACHINE_GUN_FIRE_INTERVAL
        });

        expect(machineGun.tracers).toHaveLength(4);
    });

    it('removes tracers after several hundred meters', () => {
        const scene = new THREE.Scene();
        const planeState = createPlaneState();
        const machineGun = createMachineGun(scene);

        machineGun.update({
            planeState,
            keyboard: createKeyboard({ space: true }),
            delta: 1 / 60
        });
        machineGun.update({
            planeState,
            keyboard: createKeyboard(),
            delta: MACHINE_GUN_RANGE
        });

        expect(machineGun.tracers).toHaveLength(0);
        expect(scene.children).toHaveLength(0);
    });
});

it('jet cannon fires faster, follows quaternion attitude, and caps sustained tracers', () => {
    const jet = createPlaneState('mirage'),
        prop = createPlaneState();
    jet.attitude = { x: 0, y: 0, z: 0, w: 1 };
    const a = createMachineGun(new THREE.Scene()),
        b = createMachineGun(new THREE.Scene());
    const keyboard = createKeyboard({ space: true });
    for (let i = 0; i < 30; i++) {
        a.update({ planeState: jet, keyboard, delta: 1 / 60 });
        b.update({ planeState: prop, keyboard, delta: 1 / 60 });
    }
    expect(a.tracers.length).toBeGreaterThan(b.tracers.length);
    expect(a.tracers[0].velocity.x).toBeGreaterThan(600);
    expect(a.tracers[0].velocity.z).toBe(0);
    for (let i = 0; i < 600; i++)
        a.update({ planeState: jet, keyboard, delta: 1 / 60 });
    expect(a.tracers.length).toBeLessThanOrEqual(160);
    a.dispose();
    b.dispose();
    expect(a.tracers.length).toBe(0);
});
