import { expect, it } from 'vitest';
import { getRenderQuality } from './renderQuality.js';
it('caps high DPI rendering without supersampling standard displays', () => {
    expect(getRenderQuality('high', 3).pixelRatio).toBe(2);
    expect(getRenderQuality('balanced', 3).pixelRatio).toBe(1.5);
    expect(getRenderQuality('balanced', 1).pixelRatio).toBe(1);
    expect(getRenderQuality('low', 3).shadows).toBe(false);
    expect(getRenderQuality('unknown', 2)).toEqual(getRenderQuality('high', 2));
});
