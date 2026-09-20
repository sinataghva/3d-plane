import { expect, test, vi } from 'vitest';
import { Group } from 'three';
import { createPlaneState } from './physics.js';
import {
    createMachTransition,
    createMachEffect,
    SOUND_SPEED,
    MACH_EFFECT_SECONDS
} from './machTransition.js';
import { synthesizeSonicBoom } from './sonicBoom.js';
/** @param {number} mach */
function jet(mach) {
    return {
        ...createPlaneState(),
        aircraft: 'mirage',
        isAirborne: true,
        speed: (mach * SOUND_SPEED) / 60
    };
}
test('only an armed rising Mach 1 crossing triggers; jitter and descending crossings do not', () => {
    const detector = createMachTransition();
    expect(detector.update(jet(1.1), 0.1)).toBe(false);
    detector.update(jet(0.9), 0.1);
    expect(detector.update(jet(1), 0.1)).toBe(true);
    for (let i = 0; i < 120; i++)
        expect(detector.update(jet(i % 2 ? 1.001 : 0.999), 0.1)).toBe(false);
    expect(detector.count).toBe(1);
    detector.update(jet(0.95), 0.1);
    expect(detector.update(jet(1.01), 0.1)).toBe(true);
    detector.update(jet(0.9), 0.1);
    expect(detector.update(jet(1.01), 0.1)).toBe(false);
});
test('ground, crash, propeller and restart cannot replay a stale crossing', () => {
    for (const override of [
        { isAirborne: false },
        { isCrashed: true },
        { aircraft: 'cessna' }
    ]) {
        const detector = createMachTransition();
        detector.update(jet(0.9), 1);
        expect(detector.update({ ...jet(1.1), ...override }, 1)).toBe(false);
        expect(detector.update(jet(1.1), 1)).toBe(false);
    }
    const detector = createMachTransition();
    detector.update(jet(0.9), 1);
    detector.update(jet(1.1), 1);
    detector.reset();
    expect(detector.count).toBe(0);
    expect(detector.update(jet(1.1), 1)).toBe(false);
});
test('vapor fades in and out, freezes, hides in cockpit/crash and disposes', () => {
    const plane = new Group(),
        effect = createMachEffect(plane);
    effect.trigger();
    effect.advance(0.2);
    effect.render();
    expect(effect.mesh.visible).toBe(true);
    const opacity = effect.mesh.material.opacity;
    effect.advance(0);
    effect.render();
    expect(effect.mesh.material.opacity).toBe(opacity);
    effect.render(true);
    expect(effect.mesh.visible).toBe(false);
    effect.render(false, true);
    expect(effect.mesh.visible).toBe(false);
    effect.advance(MACH_EFFECT_SECONDS);
    effect.render();
    expect(effect.mesh.visible).toBe(false);
    effect.trigger();
    effect.reset();
    effect.render();
    expect(effect.mesh.visible).toBe(false);
    const disposed = vi.fn();
    effect.mesh.geometry.addEventListener('dispose', disposed);
    effect.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(plane.children).toHaveLength(0);
});
test.each([44100, 48000])(
    'generated boom is deterministic, bounded, finite and fades at %i Hz',
    (rate) => {
        const data = synthesizeSonicBoom(rate);
        expect(data).toEqual(synthesizeSonicBoom(rate));
        expect(data.length).toBe(Math.ceil(rate * 1.25));
        expect(data.every(Number.isFinite)).toBe(true);
        expect(data.reduce((p, v) => Math.max(p, Math.abs(v)), 0)).toBeCloseTo(
            0.85
        );
        expect(Math.abs(data[data.length - 1])).toBeLessThan(0.001);
        expect(
            Math.abs(data.reduce((s, v) => s + v, 0) / data.length)
        ).toBeLessThan(0.01);
    }
);
