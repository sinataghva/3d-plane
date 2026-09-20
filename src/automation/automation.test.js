import { describe, expect, it, vi } from 'vitest';
import { createFlightAutomation } from './automation.js';
import {
    createPlaneState,
    createPlanePhysics,
    resetPlaneState,
    updatePlanePhysics
} from '../flight/physics.js';

function setup() {
    const planeState = createPlaneState();
    const planePhysics = createPlanePhysics();
    const render = vi.fn();
    const api = createFlightAutomation({
        planeState,
        render,
        reset: () => resetPlaneState(planeState),
        advance: (delta, keyboard) =>
            updatePlanePhysics({ planeState, planePhysics, keyboard, delta })
    });
    return { api, planeState };
}

describe('flight automation', () => {
    it('sets full throttle immediately without advancing time', () => {
        const { api } = setup();
        const state = api.setControls({ throttle: 1 });
        expect(state.plane.thrust).toBe(1);
        expect(state.plane.position.z).toBe(-120);
        expect(state.simulationSeconds).toBe(0);
    });
    it('takes off and clears the barrier with the existing physics', () => {
        const { api } = setup();
        api.setControls({ throttle: 1 });
        api.step({ seconds: 1 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 0.75 });
        api.setControls({ pitch: 0 });
        const state = api.step({ seconds: 3 });
        expect(state.plane.isAirborne).toBe(true);
        expect(state.plane.isCrashed).toBe(false);
        expect(state.plane.position.z).toBeGreaterThan(150);
        expect(state.altitudeMeters).toBeGreaterThan(30);
    });
    it('produces the same result when a step is split into ticks', () => {
        const a = setup().api;
        const b = setup().api;
        a.setControls({ throttle: 1 });
        b.setControls({ throttle: 1 });
        a.step({ seconds: 1 });
        for (let i = 0; i < 60; i++) b.step({ seconds: 1 / 60 });
        expect(a.getState()).toEqual(b.getState());
    });
    it('rejects invalid commands atomically', () => {
        const { api } = setup();
        expect(() => api.setControls({ throttle: 1, pitch: NaN })).toThrow();
        expect(api.getState().plane.thrust).toBe(0);
        for (const seconds of [0, -1, Infinity, NaN, 11])
            expect(() => api.step({ seconds })).toThrow();
        expect(() => api.setControls({ throttle: 2 })).toThrow();
    });
    it('returns detached telemetry and resets all machine controls', () => {
        const { api } = setup();
        api.setControls({ throttle: 1, fire: true });
        api.step({ seconds: 1 });
        const state = api.getState();
        state.plane.position.y = 999;
        state.controls.pitch = 1;
        expect(api.getState().plane.position.y).toBe(0.5);
        expect(api.getState().controls.pitch).toBe(0);
        api.reset();
        expect(api.getState().plane).toEqual(createPlaneState());
        expect(api.getState().controls.fire).toBe(false);
    });
    it('stops at a crash instead of silently auto restarting', () => {
        const { api, planeState } = setup();
        Object.assign(planeState, {
            isAirborne: true,
            speed: 1,
            pitchAngle: -0.6,
            verticalSpeed: -0.26
        });
        api.step({ seconds: 10 });
        expect(planeState.isCrashed).toBe(true);
        expect(api.getState().simulationSeconds).toBe(1 / 60);
    });
    it('animates incrementally and supports human takeover mid-flight', async () => {
        const { api } = setup();
        /** @type {FrameRequestCallback[]} */
        const frames = [];
        const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
        vi.stubGlobal(
            'requestAnimationFrame',
            (/** @type {FrameRequestCallback} */ callback) => {
                frames.push(callback);
                return frames.length;
            }
        );
        try {
            api.setControls({ throttle: 1 });
            const flight = api.fly({ seconds: 1 });
            expect(api.getState().simulationSeconds).toBe(0);
            expect(() => api.step({ seconds: 1 })).toThrow();
            expect(() => api.fly({ seconds: 1 })).toThrow();
            expect(() => api.reset()).toThrow();
            frames.shift()?.(100);
            expect(api.getState().simulationSeconds).toBeGreaterThan(0);
            expect(api.getState().simulationSeconds).toBeLessThan(1);
            api.release();
            const stoppedAt = api.getState().simulationSeconds;
            frames.shift()?.(200);
            const result = await flight;
            expect(result.simulationSeconds).toBe(stoppedAt);
            expect(result.active).toBe(false);
            expect(result.running).toBe(false);
        } finally {
            clock.mockRestore();
            vi.unstubAllGlobals();
        }
    });
    it('finishes an animated flight with the same result as an instant step', async () => {
        const a = setup().api;
        const b = setup().api;
        /** @type {FrameRequestCallback[]} */
        const frames = [];
        const clock = vi.spyOn(performance, 'now').mockReturnValue(0);
        vi.stubGlobal(
            'requestAnimationFrame',
            (/** @type {FrameRequestCallback} */ callback) => {
                frames.push(callback);
                return frames.length;
            }
        );
        try {
            a.setControls({ throttle: 1 });
            b.setControls({ throttle: 1 });
            const flight = a.fly({ seconds: 1 });
            for (let frame = 1; frames.length && frame < 200; frame++)
                frames.shift()?.(frame * 17);
            await flight;
            b.step({ seconds: 1 });
            expect(a.getState()).toEqual(b.getState());
        } finally {
            clock.mockRestore();
            vi.unstubAllGlobals();
        }
    });
    it('keeps flying between commands until explicitly paused', () => {
        const { api } = setup();
        api.setControls({ throttle: 1 });
        api.resume();
        for (let i = 0; i < 60; i++) api.update(1 / 60);
        expect(api.getState().simulationSeconds).toBe(1);
        expect(api.getState().plane.speed).toBeGreaterThan(1.5);
        expect(() => api.step({ seconds: 1 })).toThrow();
        api.setControls({ pitch: 0.3 });
        api.update(1 / 60);
        expect(api.getState().plane.isAirborne).toBe(true);
        api.pause();
        const stopped = api.getState();
        api.update(1);
        expect(api.getState()).toEqual(stopped);
        api.resume();
        api.release();
        expect(api.getState().continuous).toBe(false);
    });
    it('rejects an invalid route before changing controls', async () => {
        const { api } = setup();
        await expect(
            api.flyRoute({
                stages: [
                    { seconds: 1, controls: { throttle: 1 } },
                    { seconds: 1, controls: { pitch: 2 } }
                ]
            })
        ).rejects.toThrow();
        expect(api.getState().plane.thrust).toBe(0);
    });
    it('releases exclusive ownership and refuses further machine inputs', () => {
        const { api } = setup();
        api.setControls({ throttle: 1, pitch: 0.2 });
        api.release();
        expect(api.active).toBe(false);
        expect(api.getState().controls.pitch).toBe(0);
        expect(() => api.step({ seconds: 1 })).toThrow();
        expect(() => api.setControls({ throttle: 0 })).toThrow();
        expect(() => api.reset()).toThrow();
    });
});
