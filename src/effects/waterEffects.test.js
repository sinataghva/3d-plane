import { expect, test, vi } from 'vitest';
import { MeshStandardMaterial } from 'three';
import { createWaterEffects, waterCharacter } from './waterEffects.js';
const lake = /** @type {import('../scenery/geography.js').GeoFeature} */ ({
    kind: 'water',
    waterType: 'lake'
});
test('water character distinguishes calm, flowing and narrow intermittent surfaces', () => {
    expect(waterCharacter(lake)).toBeLessThan(
        waterCharacter({ ...lake, waterType: 'river' })
    );
    expect(waterCharacter({ ...lake, waterType: 'canal' })).toBe(
        waterCharacter(lake)
    );
    expect(
        waterCharacter({
            ...lake,
            line: true,
            width: 1,
            intermittent: 'yes',
            waterType: 'stream'
        })
    ).toBeLessThan(waterCharacter(lake));
});
test('animation freezes at zero delta and clamps background resume jumps', () => {
    const effects = createWaterEffects();
    effects.update(0.05, 'high');
    for (let i = 0; i < 120; i++) effects.update(0, 'high');
    expect(effects.uniforms.waterTime.value).toBe(0.05);
    effects.update(40, 'balanced');
    expect(effects.uniforms.waterTime.value).toBeCloseTo(0.15);
    expect(effects.uniforms.waterHigh.value).toBe(0);
    effects.reset();
    expect(effects.uniforms.waterTime.value).toBe(0);
    effects.update(0, 'low');
    expect(effects.uniforms.waterEnabled.value).toBe(0);
    effects.dispose();
});
test('tiles share one texture and disposal is idempotent', () => {
    const effects = createWaterEffects();
    const material = new MeshStandardMaterial();
    effects.attach(material);
    const disposed = vi.fn();
    effects.uniforms.waterRipples.value.addEventListener('dispose', disposed);
    effects.dispose();
    effects.dispose();
    effects.update(1, 'high');
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(effects.uniforms.waterTime.value).toBe(0);
    expect(material.customProgramCacheKey()).toBe('inland-water-v1');
    material.dispose();
});
