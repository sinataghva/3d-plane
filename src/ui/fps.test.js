import { test, expect } from 'vitest';
import { createFpsSampler } from './fps.js';
test('measures rendered frames without capping high-refresh displays', () => {
    for (const rate of [30, 60, 120]) {
        const sampler = createFpsSampler();
        sampler.update(0);
        let fps = null;
        for (let i = 1; i <= rate; i++)
            fps = sampler.update((i * 1000) / rate) ?? fps;
        expect(fps).toBe(rate);
        sampler.reset();
        expect(sampler.update(100000)).toBeNull();
    }
});
