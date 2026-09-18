import { expect, it, afterEach } from 'vitest';
import { createGeography, setGeography, inFeature } from './geography.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { getAltitude } from './flightMetrics.js';
const data = {
    origin: [48.81, 2.085],
    bounds: [48.775, 2.015, 48.845, 2.155],
    timestamp: 'test',
    places: [],
    features: [
        {
            id: 'runway',
            kind: 'runway',
            name: 'test',
            line: true,
            width: 60,
            points: [
                [-800, 0],
                [800, 0]
            ],
            holes: []
        },
        {
            id: 'building',
            kind: 'building',
            name: 'test',
            line: false,
            height: 15,
            points: [
                [100, 200],
                [130, 200],
                [130, 230],
                [100, 230],
                [100, 200]
            ],
            holes: []
        },
        {
            id: 'lake',
            kind: 'water',
            name: 'test',
            line: false,
            points: [
                [200, 200],
                [300, 200],
                [300, 300],
                [200, 300],
                [200, 200]
            ],
            holes: []
        }
    ]
};
afterEach(() => setGeography(null));
it('spawns on the mapped runway and measures altitude above local terrain', () => {
    const world = createGeography(data, {
        size: 2,
        values: [100, 140, 140, 180]
    });
    setGeography(world);
    const state = createPlaneState();
    expect(world.onRunway(state.position.x, state.position.z)).toBe(true);
    expect(state.yawAngle).toBeCloseTo(0);
    expect(getAltitude(state)).toBeCloseTo(0);
    state.position = { x: 2000, z: 2000, y: world.height(2000, 2000) + 50.5 };
    expect(getAltitude(state)).toBeCloseTo(50);
});
it('recognizes water and buildings but respects polygon courtyards', () => {
    const world = createGeography(data, {
        size: 2,
        values: [100, 100, 100, 100]
    });
    expect(world.obstacle(110, 210, 8)).toBe('building');
    expect(world.obstacle(110, 210, 30)).toBe('');
    expect(world.obstacle(250, 250, 0.5)).toBe('water');
    const lake = {
        ...data.features[2],
        holes: [
            [
                [240, 240],
                [260, 240],
                [260, 260],
                [240, 260],
                [240, 240]
            ]
        ]
    };
    expect(inFeature(250, 250, lake)).toBe(false);
});
it('terrain contact follows raised ground instead of the old flat plane', () => {
    const world = createGeography(data, {
        size: 2,
        values: [100, 130, 100, 130]
    });
    setGeography(world);
    const state = createPlaneState();
    state.position = { x: 1500, z: 500, y: world.height(1500, 500) + 0.51 };
    state.isAirborne = true;
    state.verticalSpeed = -0.05;
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
        stickPitch: 0,
        stickRoll: 0
    };
    updatePlanePhysics({
        planeState: state,
        planePhysics: createPlanePhysics(),
        keyboard: input,
        delta: 1 / 60
    });
    expect(state.position.y).toBeCloseTo(
        world.height(state.position.x, state.position.z) + 0.5
    );
    expect(state.isAirborne).toBe(false);
});

it('joins the detailed terrain continuously to the distant plain', () => {
    const world = createGeography(data, {
        size: 2,
        values: [100, 130, 100, 130]
    });
    const edge = world.height(world.maxX, 0);
    expect(world.height(world.maxX + 0.01, 0)).toBeCloseTo(edge, 3);
    expect(world.height(world.maxX + 4000, 0)).toBe(-35);
});

it('keeps a water surface level across sloped elevation samples', () => {
    const world = createGeography(data, {
        size: 2,
        values: [100, 140, 140, 180]
    });
    expect(world.height(220, 220)).toBe(world.height(280, 280));
});
