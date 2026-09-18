import scenery from '../data/saint-cyr.json';
import elevation from '../data/saint-cyr-elevation.json';
import scenicRoute from '../data/scenic-tour.json';
import { afterEach, expect, it } from 'vitest';
import { createGeography, setGeography } from './geography.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { getAltitude } from './flightMetrics.js';
const world = createGeography(scenery, elevation);
afterEach(() => setGeography(null));
it('ships the named places, palace courtyards, water and two mapped runways', () => {
    expect(world.runways).toHaveLength(2);
    expect(world.data.places.map((p) => p.name)).toEqual(
        expect.arrayContaining(['Versailles', "Saint-Cyr-l'École", 'Bailly'])
    );
    const palace = world.data.features.find((f) => f.palace);
    expect(palace?.holes.length).toBeGreaterThan(0);
    expect(
        world.data.features.some(
            (f) => f.kind === 'water' && f.name === 'Grand Canal'
        )
    ).toBe(true);
    expect(world.data.features.some((f) => f.kind === 'forest')).toBe(true);
});
it('flies the cached sightseeing circuit and lands on the departure runway', () => {
    setGeography(world);
    const state = createPlaneState(),
        physics = createPlanePhysics();
    let peak = 0,
        nearPalace = Infinity;
    for (const { seconds, controls } of scenicRoute) {
        const input = {
            w: false,
            s: false,
            a: false,
            d: false,
            arrowLeft: false,
            arrowRight: false,
            arrowUp: false,
            arrowDown: false,
            space: false,
            stickPitch: controls.pitch,
            stickRoll: controls.roll
        };
        for (let tick = 0; tick < Math.round(seconds * 60); tick++) {
            state.thrust = controls.throttle;
            updatePlanePhysics({
                planeState: state,
                planePhysics: physics,
                keyboard: input,
                delta: 1 / 60
            });
            peak = Math.max(peak, getAltitude(state));
            nearPalace = Math.min(
                nearPalace,
                Math.hypot(state.position.x - 2500, state.position.z - 400)
            );
            expect(state.isCrashed).toBe(false);
        }
    }
    expect(peak).toBeGreaterThan(100);
    expect(nearPalace).toBeLessThan(100);
    expect(state.isAirborne).toBe(false);
    expect(world.onRunway(state.position.x, state.position.z)).toBe(true);
    expect(state.speed).toBe(0);
    expect(Math.cos(state.yawAngle - world.spawn.yaw)).toBeGreaterThan(0.99);
});
