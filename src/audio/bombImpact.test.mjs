import { test, expect } from 'vitest';
import { bombImpactGain } from './bombImpact.js';
test('impact audio remains audible at distance and fades smoothly by 6 km', () => {
    expect(bombImpactGain(0)).toBe(1.6);
    expect(bombImpactGain(3000)).toBeGreaterThan(0.5);
    expect(bombImpactGain(5000)).toBeGreaterThan(0.4);
    expect(bombImpactGain(5999)).toBeLessThan(0.001);
    expect(bombImpactGain(6000)).toBe(0);
    expect(bombImpactGain(9000)).toBe(0);
    for (let d = 100; d <= 6000; d += 100)
        expect(bombImpactGain(d)).toBeLessThanOrEqual(bombImpactGain(d - 100));
});
