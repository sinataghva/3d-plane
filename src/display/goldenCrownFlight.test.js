import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { sampleDisplay, DISPLAY_DURATION } from './goldenCrownFlight.js';

describe('Golden Crown choreography', () => {
    it('stays separated and airborne across the full display', () => {
        for (let t = 0; t < DISPLAY_DURATION; t += 0.25) {
            const states = Array.from({ length: 6 }, (_, i) =>
                sampleDisplay(t, i)
            );
            for (let i = 0; i < 6; i++) {
                const state = states[i];
                expect(state.position.y).toBeGreaterThan(250);
                expect(state.speed).toBeGreaterThan(30);
                expect(state.speed).toBeLessThan(300);
                expect(state.quaternion.length()).toBeCloseTo(1);
                for (let j = i + 1; j < 6; j++)
                    expect(
                        state.position.distanceTo(states[j].position)
                    ).toBeGreaterThan(20);
            }
        }
    });
    it('tilts the lift direction into both left and right turns', () => {
        const directions = new Set();
        for (const t of [35, 49, 90, 120, 165, 195, 225]) {
            const state = sampleDisplay(t, 0);
            const before = sampleDisplay(t - 0.1, 0).position;
            const after = sampleDisplay(t + 0.1, 0).position;
            const forward = after.clone().sub(before).setY(0).normalize();
            const sideways = new Vector3(-forward.z, 0, forward.x);
            const acceleration = after
                .add(before)
                .addScaledVector(state.position, -2)
                .divideScalar(0.01);
            const turn = acceleration.dot(sideways);
            if (Math.abs(turn) < 0.2) continue;
            directions.add(Math.sign(turn));
            const lift = new Vector3(0, 1, 0).applyQuaternion(state.quaternion);
            expect(lift.dot(sideways) * turn, `bank at ${t}s`).toBeGreaterThan(
                0
            );
        }
        expect(directions.size).toBe(2);
    });
    it('rolls two core aircraft outward while two stay level', () => {
        /** @param {number} time @param {number} aircraft */
        const up = (time, aircraft) => new Vector3(0, 1, 0)
            .applyQuaternion(sampleDisplay(time, aircraft).quaternion);
        const sideways = new Vector3(0, 0, 1)
            .applyQuaternion(sampleDisplay(78, 0).quaternion);
        expect(up(78, 1).dot(sideways)).toBeLessThan(-0.8);
        expect(up(78, 2).dot(sideways)).toBeGreaterThan(0.8);
        for (const aircraft of [0, 3]) {
            expect(up(80, aircraft).y).toBeGreaterThan(0.999);
            expect(sampleDisplay(76, aircraft).position.y)
                .toBeCloseTo(sampleDisplay(84, aircraft).position.y);
        }
        for (const aircraft of [1, 2]) {
            expect(up(80, aircraft).y).toBeLessThan(-0.99);
            expect(up(86, aircraft).y).toBeGreaterThan(0.99);
        }
    });
    it('takes both solos over a high arc and into separated descending exits', () => {
        for (const aircraft of [4, 5]) {
            expect(sampleDisplay(82, aircraft).position.y)
                .toBeGreaterThan(sampleDisplay(68, aircraft).position.y + 600);
            expect(sampleDisplay(92, aircraft).position.y)
                .toBeLessThan(sampleDisplay(86, aircraft).position.y - 300);
        }
        expect(sampleDisplay(94, 4).position.distanceTo(sampleDisplay(94, 5).position))
            .toBeGreaterThan(1000);
    });
    it('closes the cycle without position or attitude jumps', () => {
        for (let i = 0; i < 6; i++) {
            const before = sampleDisplay(DISPLAY_DURATION - 0.001, i),
                after = sampleDisplay(0.001, i);
            expect(before.position.distanceTo(after.position)).toBeLessThan(
                0.5
            );
            expect(before.quaternion.angleTo(after.quaternion)).toBeLessThan(
                0.02
            );
            expect(
                sampleDisplay(13, i).position.distanceTo(
                    sampleDisplay(253, i).position
                )
            ).toBeLessThan(1e-8);
        }
    });
    it('keeps the core upright while a solo inverts and rejoins', () => {
        expect(
            sampleDisplay(112, 4).quaternion.angleTo(
                sampleDisplay(112, 5).quaternion
            )
        ).toBeGreaterThan(2.8);
        expect(sampleDisplay(155, 0).gear).toBe(1);
        expect(sampleDisplay(30, 0).gear).toBe(0);
        expect(sampleDisplay(190, 0).smoke).toBe(false);
    });
});
