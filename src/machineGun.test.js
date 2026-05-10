import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import {
    createMachineGun,
    MACHINE_GUN_FIRE_INTERVAL,
    MACHINE_GUN_RANGE
} from './machineGun.js';
import { createPlaneState } from './physics.js';

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
