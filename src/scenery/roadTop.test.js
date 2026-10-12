import { describe, it, expect } from 'vitest';
import { conformRoadTop } from './roadStructures.js';

const world = { width: 2560, depth: 2560, minX: 0, minZ: 0 };
// A terrain-grid ridge crosses the interior of a road whose corners are lower.
const height = (/** @type {number} */ x) => 5 - Math.abs(x - 10) / 2;
const corners = [
    [5, 2.62, 2],
    [5, 2.62, 8],
    [15, 2.62, 8],
    [15, 2.62, 2]
];
describe('terrain-conforming structure road tops', () => {
    it('keeps ground-level road interiors above a terrain ridge', () => {
        const points = conformRoadTop(corners, [1, 1, 1, 1], world, height);
        expect(points.some(([x]) => x === 10)).toBe(true);
        for (const [x, y] of points) expect(y - height(x)).toBeCloseTo(0.12, 8);
        for (let i = 0; i < points.length; i += 3) {
            const triangle = points.slice(i, i + 3);
            const x = triangle.reduce((sum, p) => sum + p[0], 0) / 3;
            const y = triangle.reduce((sum, p) => sum + p[1], 0) / 3;
            expect(y - height(x)).toBeCloseTo(0.12, 8);
        }
    });
    it('preserves elevated deck planes without extra subdivision', () => {
        const deck = corners.map(([x, , z]) => [x, 20, z, 0]);
        const points = conformRoadTop(deck, [0, 0, 0, 0], world, height);
        expect(points).toHaveLength(6);
        expect(points.every((p) => p.length === 3 && p[1] === 20)).toBe(true);
    });
    it('preserves intentionally recessed tunnel approaches', () => {
        const recessed = corners.map(([x, y, z]) => [x, y - 4, z]);
        for (const [x, y] of conformRoadTop(
            recessed,
            [1, 1, 1, 1],
            world,
            height
        )) {
            expect(y - height(x)).toBeCloseTo(-3.88, 8);
        }
    });
});
