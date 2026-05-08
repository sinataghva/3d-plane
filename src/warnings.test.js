import { describe, expect, it } from 'vitest';

import { createPlaneState } from './physics.js';
import { getActiveFlightWarning } from './warnings.js';

describe('flight warnings', () => {
    it('prioritizes stall warnings', () => {
        const planeState = createPlaneState();
        planeState.position.y = 20;
        planeState.isAirborne = true;
        planeState.isStalling = true;
        planeState.speed = 0.4;
        planeState.verticalSpeed = -0.1;

        expect(
            getActiveFlightWarning({ planeState, stallSpeed: 0.85 })
        ).toMatchObject({
            level: 'danger',
            label: 'Stall'
        });
    });

    it('warns about terrain when descending low', () => {
        const planeState = createPlaneState();
        planeState.position.y = 15;
        planeState.isAirborne = true;
        planeState.speed = 1.4;
        planeState.verticalSpeed = -0.08;

        expect(
            getActiveFlightWarning({ planeState, stallSpeed: 0.85 })
        ).toMatchObject({
            level: 'danger',
            label: 'Terrain'
        });
    });

    it('warns about low speed while airborne', () => {
        const planeState = createPlaneState();
        planeState.position.y = 20;
        planeState.isAirborne = true;
        planeState.speed = 0.9;

        expect(
            getActiveFlightWarning({ planeState, stallSpeed: 0.85 })
        ).toMatchObject({
            level: 'caution',
            label: 'Low speed'
        });
    });

    it('does not show flight warnings while crashed', () => {
        const planeState = createPlaneState();
        planeState.isCrashed = true;
        planeState.isStalling = true;

        expect(
            getActiveFlightWarning({ planeState, stallSpeed: 0.85 })
        ).toBeNull();
    });
});
