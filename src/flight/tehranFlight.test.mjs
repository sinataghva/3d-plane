import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test, expect, afterEach } from 'vitest';
import {
    createGeography,
    setGeography,
    inFeature
} from '../scenery/geography.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics,
    resetPlaneState
} from './physics.js';
import { createInputController } from './input.js';
import { describeTouchdown } from '../ui/experience.js';
import { missionFor } from '../ui/missions.js';
import { buildingBase } from '../scenery/buildingFoundation.js';
import { createRenderedHeight } from '../scenery/groundDetail.js';

const data = JSON.parse(
    readFileSync(new URL('../../data/tehran/map.json', import.meta.url), 'utf8')
);
const dem = JSON.parse(
    readFileSync(
        new URL('../../data/tehran/elevation.json', import.meta.url),
        'utf8'
    )
);
const world = createGeography(data, dem, {
    icao: 'OIII',
    runwayRef: '11R/29L'
});
afterEach(() => setGeography(null));
test('the rendered Mehrabad runway is flat and agrees with wheel contact along its full width', () => {
    const rendered = createRenderedHeight(world);
    expect(
        Math.abs(rendered(world.spawn.x, world.spawn.z) - (world.spawn.y - 0.5))
    ).toBeLessThan(0.001);
    for (const r of world.runways.filter(
        (r) => r.ref === '11R/29L' || r.ref === '11L/29R'
    )) {
        const a = r.points[0],
            b = r.points.at(-1),
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dx = (b[0] - a[0]) / length,
            dz = (b[1] - a[1]) / length;
        for (let distance = 0; distance <= length; distance += 20)
            for (const offset of [-r.width / 2, 0, r.width / 2]) {
                const x = a[0] + dx * distance - dz * offset,
                    z = a[1] + dz * distance + dx * offset;
                expect(Math.abs(world.height(x, z))).toBeLessThan(0.001);
                expect(Math.abs(rendered(x, z))).toBeLessThan(0.001);
            }
    }
});
function tick(state, input, n = 1) {
    for (let i = 0; i < n; i++)
        updatePlanePhysics({
            planeState: state,
            keyboard: input,
            planePhysics: createPlanePhysics(),
            delta: 1 / 60
        });
}

test('Tehran selects an intact Mehrabad runway without modifying source data', () => {
    expect(missionFor('tehran').aircraft).toBe('phantom');
    expect(missionFor('luxeuil').aircraft).toBe('mirage');
    expect(missionFor(null).aircraft).toBe('cessna');
    const a = world.runway.points[0],
        b = world.runway.points.at(-1);
    expect(Math.hypot(a[0] - b[0], a[1] - b[1])).toBeGreaterThan(4000);
    expect(world.runways.filter((r) => r.ref === '11R/29L')).toHaveLength(1);
    expect(world.runways.filter((r) => r.ref === '11L/29R')).toHaveLength(1);
    expect(
        data.features.filter((r) => r.ref === '11R/29L').length
    ).toBeGreaterThan(1);
    const boundary = data.features.find((f) => f.icao === 'OIII');
    expect(inFeature(world.spawn.x, world.spawn.z, boundary)).toBe(true);
    expect(world.onRunway(world.spawn.x, world.spawn.z)).toBe(true);
    expect(world.obstacle(world.spawn.x, world.spawn.z, world.spawn.y)).toBe(
        ''
    );
    for (const p of world.runway.points)
        expect(world.height(...p)).toBeCloseTo(0);
    const other = world.runways.find((r) =>
        r.points.every((p) => !inFeature(...p, boundary))
    );
    const p = other.points[0],
        q = other.points.at(-1),
        x = (p[0] + q[0]) / 2,
        z = (p[1] + q[1]) / 2;
    // Unselected runways retain the DEM slope, subject to terrain-grid interpolation.
    expect(
        Math.abs(world.height(x, z) + world.baseElevation - world.sample(x, z))
    ).toBeLessThan(0.5);
});

test('F-4 takes off from Mehrabad, retracts gear, turns and resets', () => {
    setGeography(world);
    const s = createPlaneState('phantom'),
        k = createInputController('phantom').state;
    s.thrust = 1;
    k.boost = true;
    tick(s, k, 650);
    expect(s.isCrashed).toBe(false);
    expect(s.speed).toBeGreaterThan(1.18);
    k.arrowDown = true;
    tick(s, k, 50);
    k.arrowDown = false;
    s.gearDown = false;
    tick(s, k, 200);
    expect(s.isAirborne).toBe(true);
    expect(s.isCrashed).toBe(false);
    expect(s.position.y).toBeGreaterThan(50);
    expect(s.gearExtension).toBe(0);
    const yaw = s.yawAngle;
    k.arrowRight = true;
    tick(s, k, 25);
    k.arrowRight = false;
    k.arrowDown = true;
    tick(s, k, 30);
    expect(Math.abs(s.yawAngle - yaw)).toBeGreaterThan(0.01);
    expect(s.isCrashed).toBe(false);
    resetPlaneState(s);
    expect(s.aircraft).toBe('phantom');
    expect(s.position).toEqual({
        x: world.spawn.x,
        y: world.spawn.y,
        z: world.spawn.z
    });
    expect(s.gearDown).toBe(true);
    expect(s.afterburner).toBe(false);
});

test.each([true, false])(
    'F-4 Mehrabad touchdown with gear down=%s',
    (gearDown) => {
        setGeography(world);
        const s = createPlaneState('phantom'),
            k = createInputController('phantom').state;
        s.position.x += 300 * Math.cos(s.yawAngle);
        s.position.z -= 300 * Math.sin(s.yawAngle);
        s.position.y = 0.52;
        s.pitchAngle = -0.035;
        s.speed = 1.35;
        s.isAirborne = true;
        s.gearDown = gearDown;
        s.gearExtension = gearDown ? 1 : 0;
        const before = { ...s };
        tick(s, k);
        expect(s.isAirborne).toBe(false);
        expect(s.isCrashed).toBe(!gearDown);
        expect(describeTouchdown(before, s)).toContain(
            gearDown ? 'Runway landing' : 'Gear-up'
        );
    }
);

test.each([1.25, 1.45])(
    'F-4 flies a full final approach, lands and brakes at %s speed',
    (speed) => {
        setGeography(world);
        const s = createPlaneState('phantom'),
            k = createInputController('phantom').state;
        const dx = Math.cos(s.yawAngle),
            dz = -Math.sin(s.yawAngle);
        s.position.x -= 800 * dx;
        s.position.z -= 800 * dz;
        s.position.y = 45.5;
        s.pitchAngle = -0.045;
        s.speed = speed;
        s.isAirborne = true;
        s.gearDown = true;
        s.gearExtension = 1;
        // Maintain a steady arcade approach speed; engine spool starts settled.
        s.thrust = 0.2;
        s.enginePower = 0.2;
        let steps = 0;
        while (s.isAirborne && !s.isCrashed && steps++ < 1800) {
            s.thrust = Math.max(
                0,
                Math.min(0.5, 0.2 + (speed - s.speed) * 1.5)
            );
            tick(s, k);
        }
        expect(s.isCrashed).toBe(false);
        expect(s.isAirborne).toBe(false);
        expect(world.onRunway(s.position.x, s.position.z)).toBe(true);
        s.thrust = 0;
        k.brake = true;
        tick(s, k, 600);
        expect(s.isCrashed).toBe(false);
        expect(s.speed).toBe(0);
    }
);

test('Tehran mapped buildings and surface water participate in F-4 collisions', () => {
    setGeography(world);
    for (const kind of ['building', 'water']) {
        const feature = data.features.find(
            (f) =>
                f.kind === kind &&
                !f.line &&
                f.points.length >= 4 &&
                !f.tunnel &&
                (!f.layer || f.layer === '0') &&
                f.points.every((p) => !world.onRunway(...p)) &&
                (() => {
                    const x =
                            f.points.reduce((s, p) => s + p[0], 0) /
                            f.points.length,
                        z =
                            f.points.reduce((s, p) => s + p[1], 0) /
                            f.points.length;
                    return (
                        inFeature(x, z, f) &&
                        world.obstacle(x, z, world.height(x, z) + 0.5) === kind
                    );
                })()
        );
        expect(feature).toBeTruthy();
        const x =
                feature.points.reduce((s, p) => s + p[0], 0) /
                feature.points.length,
            z =
                feature.points.reduce((s, p) => s + p[1], 0) /
                feature.points.length;
        const s = createPlaneState('phantom');
        s.position = { x, y: world.height(x, z) + 0.5, z };
        s.speed = 0.01;
        tick(s, createInputController('phantom').state);
        expect(s.isCrashed).toBe(true);
        expect(s.crashReason).toBe(kind);
    }
});

test('fast F-4 cannot skip a terrain ridge between simulation endpoints', () => {
    setGeography({
        ...world,
        height: (x) => (x > 2 && x < 5 ? 40 : 0),
        obstacle: () => ''
    });
    const s = createPlaneState('phantom');
    s.position = { x: 0, y: 20, z: 0 };
    s.yawAngle = 0;
    s.speed = 10;
    s.gearDown = false;
    s.isAirborne = true;
    tick(s, createInputController('phantom').state);
    expect(s.isCrashed).toBe(true);
    expect(s.crashReason).toBe('terrain');
});

test('wheel contact matches visible terrain on both sides of Mehrabad runways', () => {
    const rendered = createRenderedHeight(world);
    const [a, b] = [world.runway.points[0], world.runway.points.at(-1)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0.05; t < 1; t += 0.1)
        for (const offset of [-1200, -700, -350, -150, 150, 350, 700, 1200]) {
            const x =
                a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * offset;
            const z =
                a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * offset;
            expect(world.height(x, z)).toBeCloseTo(rendered(x, z), 5);
        }
});

test('reported Mehrabad hangars clear the terrain and share collision roof heights', () => {
    const rendered = createRenderedHeight(world);
    for (const id of ['w1289592809-0', 'w1289592810-0', 'w530406866-0']) {
        const f = world.data.features.find((f) => f.id === id);
        const base = buildingBase(f, world);
        for (let i = 1; i < f.points.length; i++)
            for (let t = 0; t <= 1; t += 0.1) {
                const a = f.points[i - 1],
                    b = f.points[i];
                expect(base + 0.00001).toBeGreaterThanOrEqual(
                    rendered(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
                );
            }
        const p = f.points[0],
            q = f.points[1];
        const x = (p[0] + q[0]) / 2,
            z = (p[1] + q[1]) / 2;
        // A point inside the footprint is needed for obstacle testing.
        const inside = f.points
            .slice(0, -1)
            .find((p) => inFeature((p[0] + x) / 2, (p[1] + z) / 2, f));
        expect(inside).toBeTruthy();
        expect(
            world.obstacle(
                (inside[0] + x) / 2,
                (inside[1] + z) / 2,
                base + (f.height || 8) - 0.1,
                0
            )
        ).toBe('building');
    }
});
