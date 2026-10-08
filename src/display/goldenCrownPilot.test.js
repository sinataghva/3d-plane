import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createGoldenCrownPilot } from './goldenCrownPilot.js';
import { createInputController } from '../flight/input.js';
import { sampleDisplay } from './goldenCrownFlight.js';

const input = () => createInputController('phantom').state;
/** @param {ReturnType<typeof createGoldenCrownPilot>} pilot @param {number} seconds */
function advance(pilot, seconds, keys = input(), dt = 1 / 60) {
    for (let t = 0; t < seconds - 1e-8; t += dt) pilot.update(dt, keys);
}
function create(t = 18) {
    const pilot = createGoldenCrownPilot({ height: () => 0 });
    pilot.script(t);
    return pilot;
}
describe('playable Golden Crown', () => {
    it.each([250, 300, 450, 600, 800])('keeps up with a hard elevator turn at %s km/h', (speed) => {
        const pilot = create();
        pilot.states.forEach((state) => {
            state.position.y += 5000;
            state.velocity.setLength(speed / 3.6);
        });
        pilot.takeControl();
        advance(pilot, 5);
        const q = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(1.1, pilot.flight.yawAngle, 0, 'YZX')
        );
        pilot.flight.attitude = { x: q.x, y: q.y, z: q.z, w: q.w };
        const keys = input();
        keys.stickPitch = 0.8;
        for (let i = 0; i < 900; i++) {
            pilot.update(1 / 60, keys);
            expect(pilot.flight.isCrashed).toBe(false);
            expect(pilot.diagnostics.formationError).toBeLessThan(22);
        }
    });
    it.each(['heading', 'bank'])('follows a %s turn and settles after leveling', (turn) => {
        const pilot = create();
        pilot.states.forEach((state) => (state.position.y += 2000));
        pilot.takeControl();
        advance(pilot, 4);
        const keys = input();
        keys.a = turn === 'heading';
        if (turn === 'bank') {
            const q = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(0.85, pilot.flight.yawAngle, 0, 'YZX')
            );
            pilot.flight.attitude = { x: q.x, y: q.y, z: q.z, w: q.w };
            keys.stickPitch = 0.08;
        }
        let settledError = 0;
        for (let i = 0; i < 900; i++) {
            const velocities = pilot.states.map((state) => state.velocity.clone());
            pilot.update(1 / 60, keys);
            expect(pilot.flight.isCrashed).toBe(false);
            for (let j = 1; j < 6; j++)
                expect(pilot.states[j].velocity.distanceTo(velocities[j]) * 60)
                    .toBeLessThanOrEqual(48.000001);
            if (i >= 600)
                settledError = Math.max(settledError, pilot.diagnostics.formationError);
        }
        expect(settledError).toBeLessThan(turn === 'heading' ? 12.5 : 8);
        keys.a = false;
        keys.stickPitch = 0;
        advance(pilot, 10, keys);
        for (let i = 0; i < 180; i++) {
            pilot.update(1 / 60, keys);
            expect(pilot.flight.isCrashed).toBe(false);
            expect(pilot.diagnostics.formationError).toBeLessThan(3);
        }
    });
    it('takes over the same positions and orientations at every script phase', () => {
        for (const t of [18, 49, 78, 94, 112, 142, 160, 194]) {
            const pilot = create(t);
            const positions = pilot.states.map((s) => s.position.clone());
            const orientations = pilot.states.map((s) => s.quaternion.clone());
            pilot.takeControl();
            pilot.states.forEach((s, i) => {
                expect(s.position.distanceTo(positions[i])).toBe(0);
                expect(s.quaternion.angleTo(orientations[i])).toBeLessThan(
                    1e-7
                );
            });
            pilot.update(1 / 60, input());
            pilot.states.forEach((s, i) =>
                expect(s.position.distanceTo(positions[i])).toBeLessThan(10)
            );
        }
    });
    it('follows the leader, releases solos, queues exactly one full roll per command, and rejoins', () => {
        const pilot = create();
        pilot.takeControl();
        advance(pilot, 4);
        expect(pilot.status).toBe('Release solos');
        expect(pilot.command()).toBe(true);
        expect(pilot.command()).toBe(false); // release is not also a roll
        advance(pilot, 3);
        expect(pilot.command()).toBe(true);
        advance(pilot, 0.625);
        expect(
            pilot.states[1].position.y - pilot.states[0].position.y
        ).toBeGreaterThan(6);
        expect(pilot.states[1].velocity.y).toBeGreaterThan(
            pilot.states[0].velocity.y
        );
        const forward = pilot.states[0].velocity;
        const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
        const leftUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
            pilot.states[1].quaternion
        );
        const rightUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
            pilot.states[2].quaternion
        );
        expect(leftUp.dot(right)).toBeLessThan(-0.5);
        expect(rightUp.dot(right)).toBeGreaterThan(0.5);
        advance(pilot, 0.625);
        const up = pilot.states[1].quaternion;
        expect(Math.abs(up.x)).toBeGreaterThan(0.9); // inverted at half roll
        expect(pilot.command()).toBe(true);
        advance(pilot, 3.75);
        expect(pilot.diagnostics.completedRolls).toBe(2);
        expect(pilot.diagnostics.rolls).toBe(0);
        expect(
            Math.abs(pilot.states[1].position.y - pilot.states[0].position.y)
        ).toBeLessThan(0.5);
        advance(pilot, 110);
        expect(pilot.diagnostics.soloOut).toBe(false);
        expect(pilot.diagnostics.formationError).toBeLessThan(15);
        expect(pilot.status).toBe('Release solos');
    });
    it('reports the current reason whenever a maneuver is rejected', () => {
        const pilot = create();
        pilot.takeControl();
        expect(pilot.command()).toBe(false);
        expect(pilot.status).toContain('Regrouping');
        pilot.flight.rollAngle = 0.7;
        expect(pilot.command()).toBe(false);
        expect(pilot.status).toBe('Hold level');
        pilot.flight.rollAngle = 0;
        pilot.setThrottle(0);
        expect(pilot.command()).toBe(false);
        expect(pilot.status).toBe('Hold 288–612 km/h');
        pilot.states[0].position.y = 100;
        expect(pilot.command()).toBe(false);
        expect(pilot.status).toBe('Gain altitude');
    });
    it('solos return without rolls and cannot accept new rolls while rejoining', () => {
        const pilot = create();
        pilot.takeControl();
        advance(pilot, 4);
        pilot.command();
        advance(pilot, 35);
        expect(pilot.diagnostics.soloOut).toBe(false);
        expect(pilot.command()).toBe(false);
        advance(pilot, 90);
        expect(pilot.status).toBe('Release solos');
    });
    it('flies back to the scripted route continuously after a player detour', () => {
        const pilot = create();
        pilot.takeControl();
        advance(pilot, 0.3, { ...input(), arrowRight: true });
        advance(pilot, 20);
        expect(pilot.flight.isCrashed).toBe(false);
        pilot.release();
        let previous = pilot.states.map((s) => s.position.clone());
        let maximumStep = 0;
        let minimumSpeed = Infinity;
        for (let n = 0; n < 240 * 60 && pilot.mode !== 'script'; n++) {
            pilot.update(1 / 60, input());
            minimumSpeed = Math.min(
                minimumSpeed,
                pilot.states[0].velocity.length()
            );
            pilot.states.forEach((s, i) => {
                maximumStep = Math.max(
                    maximumStep,
                    s.position.distanceTo(previous[i])
                );
            });
            previous = pilot.states.map((s) => s.position.clone());
        }
        expect(pilot.mode).toBe('script');
        expect(maximumStep).toBeLessThan(6);
        expect(minimumSpeed).toBeGreaterThan(70);
        expect(
            pilot.states[0].position.distanceTo(
                sampleDisplay(pilot.time, 0).position
            )
        ).toBeLessThan(0.01);
    });
    it('returns to the show when control is released while solos are out', () => {
        const pilot = create();
        pilot.takeControl();
        advance(pilot, 4);
        pilot.command();
        advance(pilot, 3);
        pilot.command();
        advance(pilot, 1);
        pilot.release();
        advance(pilot, 240);
        expect(pilot.mode).toBe('script');
    });
    it('preserves inherited solos and supports takeover during return', () => {
        const pilot = create(82);
        pilot.takeControl();
        expect(pilot.diagnostics.soloOut).toBe(true);
        advance(pilot, 4);
        pilot.release();
        advance(pilot, 3);
        const p = pilot.states[0].position.clone();
        pilot.takeControl();
        expect(pilot.states[0].position.distanceTo(p)).toBe(0);
        expect(pilot.mode).toBe('player');
        advance(pilot, 150);
        expect(pilot.diagnostics.soloOut).toBe(false);
    });
    it('keeps an inherited inverted solo in its current maneuver', () => {
        const pilot = create(112);
        pilot.takeControl();
        advance(pilot, 1);
        expect(
            new THREE.Vector3(0, 1, 0).applyQuaternion(
                pilot.states[4].quaternion
            ).y
        ).toBeLessThan(-0.7);
    });
    it('is stable at different simulation rates', () => {
        const a = create(),
            b = create();
        a.takeControl();
        b.takeControl();
        advance(a, 10, input(), 1 / 60);
        advance(b, 10, input(), 1 / 120);
        expect(
            a.states[0].position.distanceTo(b.states[0].position)
        ).toBeLessThan(0.5);
    });
});
