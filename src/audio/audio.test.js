import { describe, it, expect } from 'vitest';
import { flightMix } from './audio.js';
import { createPlaneState } from '../flight/physics.js';

describe('flight audio mix', () => {
    it('uses engine spool power for jet pitch and clamps power', () => {
        const state = createPlaneState();
        state.aircraft = 'mirage';
        state.thrust = 1.1;
        state.enginePower = 0.4;
        expect(flightMix(state).rate).toBeCloseTo(1.02);
        state.enginePower = 2;
        expect(flightMix(state).rate).toBeCloseTo(1.35);
    });
    it('propeller power follows throttle even with an unused enginePower field', () => {
        const state = createPlaneState();
        state.thrust = 1;
        expect(flightMix(state).rate).toBeCloseTo(1.2);
        state.thrust = 0;
        expect(flightMix(state).rate).toBeCloseTo(0.65);
    });
    it('keeps wind independent of throttle and adds boost only while active', () => {
        const state = createPlaneState();
        state.speed = 3;
        state.thrust = 0;
        expect(flightMix(state).wind).toBeGreaterThan(0);
        expect(flightMix(state).boost).toBe(0);
        state.afterburner = true;
        expect(flightMix(state).boost).toBeGreaterThan(0);
        expect(flightMix(state, true).cutoff).toBeLessThan(
            flightMix(state).cutoff
        );
        expect(flightMix(state, true).cabin).toBeLessThan(1);
    });
});
