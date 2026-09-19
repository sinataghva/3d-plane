import { expect, test, afterEach } from 'vitest';
import {
    createPlaneState,
    resetPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from './physics.js';
import { createInputController } from './input.js';
import { createFlightAutomation } from './automation.js';
import { createGeography, setGeography } from './geography.js';
/** @param {import('./physics.js').PlaneState} s @param {import('./input.js').KeyboardState} k @param {number} [n] */
const tick = (s, k, n = 1) => {
    for (let i = 0; i < n; i++)
        updatePlanePhysics({
            planeState: s,
            keyboard: k,
            planePhysics: createPlanePhysics(),
            delta: 1 / 60
        });
};
afterEach(() => setGeography(null));
test('jet boost requires held input at full throttle and clears on release', () => {
    const s = createPlaneState('mirage'),
        k = createInputController().state;
    s.thrust = 0.4;
    k.boost = true;
    tick(s, k);
    expect(s.afterburner).toBe(false);
    s.thrust = 1;
    tick(s, k);
    expect(s.thrust).toBe(1.1);
    expect(s.afterburner).toBe(true);
    k.boost = false;
    tick(s, k);
    expect(s.thrust).toBe(1);
    expect(s.afterburner).toBe(false);
    s.thrust = 0.4;
    tick(s, k);
    expect(s.thrust).toBe(0.4);
    k.w = true;
    tick(s, k, 65);
    expect(s.thrust).toBe(1.1);
    k.w = false;
    tick(s, k);
    expect(s.thrust).toBe(1);
    resetPlaneState(s);
    expect(s.gearDown).toBe(true);
    expect(s.enginePower).toBe(0);
});
test('jet engine spools, rotates, climbs and banks; releasing bank levels wings', () => {
    const s = createPlaneState('mirage'),
        k = createInputController().state;
    s.thrust = 1;
    k.boost = true;
    tick(s, k);
    expect(s.enginePower).toBeLessThan(0.1);
    tick(s, k, 700);
    expect(s.speed).toBeGreaterThan(1.18);
    k.arrowDown = true;
    tick(s, k, 50);
    k.arrowDown = false;
    s.gearDown = false;
    tick(s, k, 200);
    expect(s.isAirborne).toBe(true);
    expect(s.position.y).toBeGreaterThan(50);
    const yaw = s.yawAngle;
    k.arrowRight = true;
    tick(s, k, 30);
    expect(s.yawAngle).toBeLessThan(yaw);
    k.arrowRight = false;
    tick(s, k, 180);
    expect(Math.abs(s.rollAngle)).toBeLessThan(0.01);
});
test('light aircraft never boosts and automation pause/release clears jet boost', () => {
    const k = createInputController().state;
    k.boost = true;
    const light = createPlaneState();
    light.thrust = 1;
    tick(light, k);
    expect(light.thrust).toBe(1);
    expect(light.afterburner).toBe(false);
    const s = createPlaneState('mirage');
    const api = createFlightAutomation({
        planeState: s,
        advance: (dt, input) => tick(s, input),
        reset: () => resetPlaneState(s),
        render: () => {}
    });
    api.setControls({ throttle: 1, boost: true });
    api.step({ seconds: 1 });
    expect(s.afterburner).toBe(true);
    api.pause();
    expect(s.afterburner).toBe(false);
    expect(s.thrust).toBe(1);
    api.setControls({ boost: true });
    api.step({ seconds: 1 });
    api.release();
    expect(s.afterburner).toBe(false);
});
test('jet sweep detects a narrow building crossed between fast ticks', () => {
    const world = createGeography(
        {
            origin: [0, 0],
            bounds: [-0.01, -0.01, 0.01, 0.01],
            places: [],
            timestamp: 'test',
            features: [
                {
                    id: 'r',
                    kind: 'runway',
                    name: '',
                    points: [
                        [-800, -200],
                        [800, -200]
                    ],
                    holes: [],
                    line: true,
                    width: 45
                },
                {
                    id: 'b',
                    kind: 'building',
                    name: '',
                    points: [
                        [1, -2],
                        [2, -2],
                        [2, 2],
                        [1, 2],
                        [1, -2]
                    ],
                    holes: [],
                    line: false,
                    height: 80
                }
            ]
        },
        { size: 2, values: [0, 0, 0, 0] }
    );
    setGeography(world);
    const s = createPlaneState('mirage'),
        k = createInputController().state;
    s.position = { x: 0, y: 50, z: 0 };
    s.yawAngle = 0;
    s.speed = 6;
    s.isAirborne = true;
    s.gearDown = false;
    tick(s, k);
    expect(s.isCrashed).toBe(true);
    expect(s.crashReason).toBe('building');
});

test('Mirage flame, gear and airbrake geometry follow flight state', async () => {
    const { createMirage, updateMirage } = await import('./mirage.js');
    const { airplane } = createMirage(),
        s = createPlaneState('mirage'),
        k = createInputController().state;
    s.afterburner = true;
    s.gearDown = false;
    s.gearExtension = 0;
    s.airbrake = true;
    updateMirage(airplane, s, k, 1);
    expect(airplane.userData.jetParts.flame.visible).toBe(true);
    expect(airplane.userData.jetParts.gear.visible).toBe(false);
    expect(airplane.userData.jetParts.brakes[0].rotation.z).not.toBe(0);
    s.afterburner = false;
    updateMirage(airplane, s, k, 2);
    expect(airplane.userData.jetParts.flame.visible).toBe(false);
});
