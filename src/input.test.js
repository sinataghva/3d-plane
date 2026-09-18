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

import { createInputController } from './input.js';

it('keeps keyboard and multiple touch presses independent', () => {
    const input = createInputController();
    input.key('w', true);
    input.pressPointer(1, 'w');
    input.pressPointer(2, 'w');
    input.key('w', false);
    input.releasePointer(1);
    expect(input.state.w).toBe(true);
    input.releasePointer(2);
    expect(input.state.w).toBe(false);
});
it('clears all input channels when focus is lost and ignores stale stick movement', () => {
    const input = createInputController();
    input.key('ArrowRight', true);
    input.pressPointer(1, 'space');
    input.beginStick(2);
    input.moveStick(2, 0.8, 0.7);
    input.reset();
    expect(input.state).toEqual(createInputController().state);
    expect(input.moveStick(2, 1, 1)).toBe(false);
    expect(input.state.stickPitch).toBe(0);
});
it('does not let a second finger steal or release the flight stick', () => {
    const input = createInputController();
    expect(input.beginStick(1)).toBe(true);
    expect(input.beginStick(2)).toBe(false);
    input.moveStick(1, 1, 0.5);
    expect(input.releaseStick(2)).toBe(false);
    expect(input.state.stickRoll).toBe(0.46);
    expect(input.releaseStick(1)).toBe(true);
    expect(input.state.stickRoll).toBe(0);
});
