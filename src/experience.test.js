import { describe, expect, it } from 'vitest';
import { createPlaneState } from './physics.js';
import { describeTouchdown, isOnRunway } from './experience.js';

describe('landing feedback', () => {
    it('distinguishes runway and off-field touchdowns', () => {
        const before = {
            ...createPlaneState(),
            isAirborne: true,
            verticalSpeed: -0.02
        };
        const after = createPlaneState();
        expect(describeTouchdown(before, after)).toContain(
            'Runway landing · Smooth'
        );
        after.position.x = 11;
        expect(isOnRunway(after)).toBe(false);
        expect(describeTouchdown(before, after)).toContain('Off-field landing');
    });
    it('explains attitude and descent crashes', () => {
        const before = {
            ...createPlaneState(),
            isAirborne: true,
            rollAngle: 1.5
        };
        const after = { ...createPlaneState(), isCrashed: true };
        expect(describeTouchdown(before, after)).toContain('Wings');
        before.rollAngle = 0;
        before.pitchAngle = 0.9;
        expect(describeTouchdown(before, after)).toContain('Pitch');
        before.pitchAngle = 0;
        expect(describeTouchdown(before, after)).toContain('Descent');
    });
});
