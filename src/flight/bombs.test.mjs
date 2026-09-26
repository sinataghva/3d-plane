import { test, expect } from 'vitest';
import {
    BOMB_CONFIG,
    BOMB_MOUNTS,
    bombLaunch,
    advanceBomb,
    createBombSimulation
} from './bombs.js';
import { createPlaneState } from './physics.js';
import { createInputController } from './input.js';
import { createSimulationClock } from './simulationClock.js';

function state() {
    return {
        ...createPlaneState('phantom'),
        position: { x: 0, y: 100, z: 0 },
        speed: 2,
        verticalSpeed: 0.2,
        yawAngle: 0,
        pitchAngle: 0,
        rollAngle: 0,
        isAirborne: true
    };
}
const flat = (a, b) =>
    b.y <= 0
        ? { position: a.clone().lerp(b, a.y / (a.y - b.y)), kind: 'ground' }
        : null;
const simulation = (options) => createBombSimulation(flat, () => true, options);
test('mount transforms retain forward speed but inherit only a quarter of upward speed', () => {
    const s = state(),
        b = bombLaunch(s, 0);
    expect(b.position.toArray()).toEqual([
        BOMB_MOUNTS[0][0],
        100 + BOMB_MOUNTS[0][1],
        BOMB_MOUNTS[0][2]
    ]);
    expect(b.velocity.toArray()).toEqual([120, 3, 0]);
    s.yawAngle = Math.PI / 2;
    expect(bombLaunch(s, 0).velocity.z).toBeCloseTo(-120);
    s.verticalSpeed = -0.2;
    expect(bombLaunch(s, 0).velocity.y).toBe(-12);
});
test('one press, no repeat, no queued release below configurable height', () => {
    const sim = simulation({ minimumReleaseHeight: 15 }),
        s = state();
    sim.step(s, true, 14.99);
    expect(sim.remaining).toBe(6);
    sim.step(s, true, 20);
    expect(sim.remaining).toBe(6);
    sim.step(s, false, 20);
    sim.step(s, true, 15);
    expect(sim.remaining).toBe(5);
    for (let i = 0; i < 60; i++) sim.step(s, true, 20);
    expect(sim.remaining).toBe(5);
    expect(sim.reload).toBe(0);
});
test('default release boundary is exactly 10 metres', () => {
    const sim = simulation(),
        s = state();
    sim.step(s, true, 9.999);
    expect(sim.remaining).toBe(6);
    sim.step(s, false, 10);
    sim.step(s, true, 10);
    expect(sim.remaining).toBe(5);
});
test('sixth drop starts full 30 second reload; continues on ground; hold never auto-drops', () => {
    const sim = simulation(),
        s = state();
    for (let i = 0; i < 6; i++) {
        sim.step(s, false, 100);
        sim.step(s, true, 100);
        expect(sim.remaining).toBe(5 - i);
        if (i < 5) expect(sim.reload).toBe(0);
    }
    expect(sim.reload).toBe(30);
    s.isAirborne = false;
    for (let i = 0; i < 1799; i++) sim.step(s, true, 0);
    expect(sim.remaining).toBe(0);
    expect(sim.reload).toBeGreaterThan(0);
    sim.step(s, true, 0);
    expect(sim.remaining).toBe(6);
    expect(sim.reload).toBe(0);
    sim.step(s, true, 100);
    expect(sim.remaining).toBe(6);
});
test('pause, crash and restart do not leak bombs or countdown', () => {
    const sim = simulation(),
        s = state();
    sim.step(s, true, 100);
    const p = sim.active[0].position.clone();
    sim.step(s, false, 100, 0);
    expect(sim.active[0].position).toEqual(p);
    s.isCrashed = true;
    sim.step(s, true, 100);
    expect(sim.active).toHaveLength(0);
    expect(sim.remaining).toBe(0);
    sim.reset();
    expect(sim.remaining).toBe(6);
    expect(sim.reload).toBe(0);
});
test('capacity refuses new releases without deleting old bombs or consuming inventory', () => {
    const sim = createBombSimulation(
            () => null,
            () => true,
            { maxActive: 1 }
        ),
        s = state();
    sim.step(s, true, 100);
    const first = sim.active[0];
    sim.step(s, false, 100);
    sim.step(s, true, 100);
    expect(sim.remaining).toBe(5);
    expect(sim.active).toEqual([first]);
});
test('drag slows inherited forward speed and gravity increases descent', () => {
    const b = bombLaunch(state(), 0);
    const initial = b.velocity.x;
    for (let i = 0; i < 120; i++) advanceBomb(b);
    expect(b.velocity.x).toBeLessThan(initial);
    expect(b.velocity.x).toBeCloseTo(initial * Math.exp(-0.08 * 2), 8);
    expect(b.velocity.y).toBeLessThan(0);
});
for (const [pitch, vertical] of [
    [0, 0],
    [0.2, 0.6],
    [-0.2, -0.6],
    [0.1, 0.3]
])
    test(`prediction agrees with live impacts below 0.1m (${pitch},${vertical})`, () => {
        const s = state();
        s.pitchAngle = pitch;
        s.verticalSpeed = vertical;
        s.rollAngle = 0.4;
        const p = bombLaunch(s, 0);
        let prediction;
        for (let i = 0; i < 7200 && !prediction; i++) {
            const old = p.position.clone();
            advanceBomb(p);
            prediction = flat(old, p.position);
        }
        const sim = simulation();
        let hits = sim.step(s, true, 100);
        for (let i = 0; i < 7200 && !hits.length; i++)
            hits = sim.step(s, false, 100);
        expect(hits).toHaveLength(1);
        expect(hits[0].position.distanceTo(prediction.position)).toBeLessThan(
            0.1
        );
    });
test('lifetime and world bounds remove unsupported bombs', () => {
    const s = state(),
        sim = createBombSimulation(
            () => null,
            () => false
        );
    sim.step(s, true, 100);
    expect(sim.active).toHaveLength(0);
    const timed = createBombSimulation(
        () => null,
        () => true,
        { lifetime: 0.03 }
    );
    timed.step(s, true, 100);
    timed.step(s, false, 100);
    expect(timed.active).toHaveLength(0);
    expect(BOMB_CONFIG.maxActive).toBe(30);
});
test('quick taps survive between physics ticks; repeats and input clearing do not queue drops', () => {
    const input = createInputController('phantom');
    input.key(' ', true);
    input.key(' ', true);
    input.key(' ', false);
    expect(input.state.bombPresses).toBe(1);
    expect(input.state.space).toBe(false);
    const sim = simulation();
    sim.step(state(), false, 100, 1 / 60, true);
    expect(sim.remaining).toBe(5);
    input.reset();
    expect(input.state.bombPresses).toBe(0);
});

test('repeated complete reload cycles preserve falling bombs within the lifetime bound', () => {
    const sim = createBombSimulation(
            () => null,
            () => true
        ),
        s = state();
    for (let cycle = 0; cycle < 8; cycle++) {
        for (let bomb = 0; bomb < 6; bomb++) {
            sim.step(s, false, 100, 1 / 60, true);
            expect(sim.remaining).toBe(5 - bomb);
        }
        const falling = sim.active[sim.active.length - 1];
        for (let tick = 0; tick < 1800; tick++) sim.step(s, false, 0);
        expect(sim.remaining).toBe(6);
        expect(sim.active).toContain(falling);
        expect(sim.active.length).toBeLessThanOrEqual(24);
    }
});

test('bomb motion and reload agree at 30, 60 and 120 rendered frames per second', () => {
    const results = [30, 60, 120].map((fps) => {
        const sim = createBombSimulation(
                () => null,
                () => true
            ),
            clock = createSimulationClock(),
            s = state();
        let ticks = 0;
        for (let frame = 0; frame < fps * 10; frame++) {
            clock.update(1 / fps, (dt) => {
                sim.step(s, false, 100, dt, ticks++ < 6);
            });
        }
        return {
            reload: sim.reload,
            remaining: sim.remaining,
            positions: sim.active.map((b) => b.position.toArray())
        };
    });
    expect(results[0]).toEqual(results[1]);
    expect(results[1]).toEqual(results[2]);
});
