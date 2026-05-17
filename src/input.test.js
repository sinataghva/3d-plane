import { describe, expect, it } from 'vitest';

import { applyStickCurve } from './input.js';

describe('virtual stick input', () => {
    it('ignores small movements inside the stick deadzone', () => {
        expect(applyStickCurve(0, 0.46)).toBe(0);
        expect(applyStickCurve(0.18, 0.46)).toBe(0);
        expect(applyStickCurve(-0.18, 0.46)).toBe(0);
    });

    it('curves stick movement into partial control authority', () => {
        expect(applyStickCurve(0.5, 0.46)).toBeCloseTo(0.07, 2);
        expect(applyStickCurve(-0.5, 0.46)).toBeCloseTo(-0.07, 2);
    });

    it('caps full stick travel below keyboard authority', () => {
        expect(applyStickCurve(1, 0.46)).toBeCloseTo(0.46);
        expect(applyStickCurve(-1, 0.34)).toBeCloseTo(-0.34);
    });
});
