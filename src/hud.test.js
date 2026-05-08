import { describe, expect, it } from 'vitest';

import { formatAltitudeMeters, formatSpeedKmh } from './hud.js';

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
});
