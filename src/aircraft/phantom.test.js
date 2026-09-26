import { test, expect } from 'vitest';
import * as THREE from 'three';
import { createPhantom, updatePhantom } from './phantom.js';
import { aircraftCapabilities, isJet } from './capabilities.js';
import { createPlaneState } from '../flight/physics.js';
import { createInputController } from '../flight/input.js';
import { createMachineGun } from '../effects/machineGun.js';
import { updateAirplaneCockpitVisibility } from './airplane.js';

test('Phantom is a bomb-equipped jet, never a gun-equipped aircraft', () => {
    expect(isJet('phantom')).toBe(true);
    expect(aircraftCapabilities('phantom')).toMatchObject({
        weapon: 'bomb',
        weaponReady: true
    });
    const scene = new THREE.Scene(),
        gun = createMachineGun(scene),
        keyboard = createInputController('phantom').state;
    keyboard.space = true;
    for (const aircraft of ['cessna', 'mirage']) {
        gun.update({
            planeState: createPlaneState(aircraft),
            keyboard,
            delta: 1 / 60
        });
        expect(gun.tracers.length).toBeGreaterThan(0);
        gun.clear();
    }
    for (let i = 0; i < 120; i++)
        gun.update({
            planeState: createPlaneState('phantom'),
            keyboard,
            delta: 1 / 60
        });
    expect(gun.tracers).toHaveLength(0);
    expect(scene.children.filter((c) => c.visible)).toHaveLength(0);
    gun.dispose();
});

test('Phantom model has finite geometry, procedural markings and animated jet parts', () => {
    const { airplane, propeller } = createPhantom(),
        state = createPlaneState('phantom'),
        input = createInputController('phantom').state;
    expect(airplane.name).toContain('Imperial Iranian Air Force');
    expect(airplane.getObjectsByProperty('name', 'IIAF')).toHaveLength(2);
    expect(
        airplane.getObjectsByProperty('name', 'Iranian roundel')
    ).toHaveLength(6);
    airplane.traverse((o) => {
        if (o instanceof THREE.Mesh)
            expect(
                [...o.geometry.getAttribute('position').array].every(
                    Number.isFinite
                )
            ).toBe(true);
    });
    const parts = airplane.userData.jetParts;
    expect(
        parts.canopy.children.filter(
            (/** @type {THREE.Mesh} */ part) =>
                part.geometry.type === 'SphereGeometry'
        )
    ).toHaveLength(1);
    state.gearExtension = 0;
    state.afterburner = true;
    state.airbrakeExtension = 1;
    input.arrowDown = true;
    updatePhantom(airplane, state, input, 1);
    expect(parts.flame.visible).toBe(true);
    expect(parts.flame.children).toHaveLength(4);
    expect(parts.gear.visible).toBe(false);
    expect(parts.elevons[0].rotation.z).not.toBe(0);
    expect(parts.brakes[0].rotation.z).toBe(-0.8);
    updateAirplaneCockpitVisibility({ airplane, propeller, isCockpit: true });
    expect(parts.canopy.visible).toBe(false);
    updateAirplaneCockpitVisibility({ airplane, propeller, isCockpit: false });
    expect(parts.canopy.visible).toBe(true);
    const geometries = new Set(),
        materials = new Set();
    airplane.traverse((o) => {
        if (o instanceof THREE.Mesh) {
            geometries.add(o.geometry);
            materials.add(o.material);
        }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => {
        m.map?.dispose();
        m.dispose();
    });
});
