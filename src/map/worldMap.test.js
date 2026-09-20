import { expect, it } from 'vitest';
import { mapProjection } from './worldMap.js';

it('fits the whole world and keeps north up in desktop and mobile viewports', () => {
    for (const [width, height] of [
        [950, 780],
        [820, 290]
    ]) {
        const map = mapProjection(width, height);
        expect(map.point(0, 0)).toEqual({ x: width / 2, y: height / 2 });
        expect(map.point(-2100, -2600).x).toBeGreaterThanOrEqual(36);
        expect(map.point(-2100, -2600).y).toBeGreaterThanOrEqual(29.99);
        expect(map.point(2100, 2600).x).toBeLessThanOrEqual(width - 36);
        expect(map.point(2100, 2600).y).toBeLessThanOrEqual(height - 29.99);
        expect(map.point(0, -100).y).toBeLessThan(map.point(0, 100).y);
    }
});
