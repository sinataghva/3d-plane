import { describe, expect, it } from 'vitest';

import {
    formatAltitudeMeters,
    formatSpeedKmh,
    formatVerticalSpeedMs,
    getFlightCondition
} from './hud.js';

const basePlaneState = {
    crashImpact: 0,
    flapDeployment: 0,
    isAirborne: false,
    isCrashed: false,
    isStalling: false,
    lift: 0,
    pitchAngle: 0,
    position: { x: 0, y: 0, z: 0 },
    propellerRotation: 0,
    rollAngle: 0,
    speed: 0,
    thrust: 0,
    verticalSpeed: 0,
    yawAngle: 0
};

describe('HUD formatting', () => {
    it('shows internal speed as whole km/h', () => {
        expect(formatSpeedKmh(0)).toBe('0');
        expect(formatSpeedKmh(1.5)).toBe('135');
        expect(formatSpeedKmh(2)).toBe('180');
    });

    it('shows altitude as whole meters', () => {
        expect(formatAltitudeMeters(0)).toBe('0');
        expect(formatAltitudeMeters(34.3)).toBe('34');
        expect(formatAltitudeMeters(58.67)).toBe('59');
    });

    it('shows vertical speed with a climb sign', () => {
        expect(formatVerticalSpeedMs(0)).toBe('0');
        expect(formatVerticalSpeedMs(0.08)).toBe('+5');
        expect(formatVerticalSpeedMs(-0.08)).toBe('-5');
    });

    it('labels flight energy states', () => {
        expect(
            getFlightCondition({
                ...basePlaneState
            }).energyLabel
        ).toBe('Idle');

        expect(
            getFlightCondition({
                ...basePlaneState,
                isAirborne: true,
                isStalling: true,
                speed: 0.7,
                thrust: 0.8,
                verticalSpeed: -0.1
            }).energyLabel
        ).toBe('Stall');

        expect(
            getFlightCondition({
                ...basePlaneState,
                isAirborne: true,
                speed: 0.95,
                thrust: 0.8
            }).energyLabel
        ).toBe('Low energy');
    });
});
