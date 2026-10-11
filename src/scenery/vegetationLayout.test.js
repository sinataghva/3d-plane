import { expect, test } from 'vitest';
import { vegetationClearance, woodlandSchedule } from './vegetationLayout.js';

/** @param {string} id @param {number} x */
const forest = (id, x) => ({
    id,
    kind: 'forest',
    points: [
        [x, 0],
        [x + 100, 0],
        [x + 100, 100],
        [x, 100]
    ],
    holes: [],
    line: false,
    name: ''
});
test('woodland distribution is independent of source polygon order', () => {
    const a = forest('a', 0),
        b = forest('b', 1800),
        c = forest('c', 0);
    /** @param {import('./geography.js').GeoFeature[]} features */
    const world = (features) => ({
        minX: 0,
        maxX: 3000,
        minZ: 0,
        maxZ: 1000,
        data: { features }
    });
    expect(woodlandSchedule(world([a, b, c]))).toEqual(
        woodlandSchedule(world([c, b, a]))
    );
    expect(woodlandSchedule(world([a, b, c]))).toHaveLength(2);
});
test('canopies clear roads across spatial cell boundaries but tunnels do not remove trees', () => {
    const road = {
        ...forest('road', 0),
        kind: 'road',
        line: true,
        width: 12,
        points: [
            [245, -100],
            [245, 100]
        ]
    };
    const clear = vegetationClearance([road]);
    expect(clear(251, 0)).toBe(false);
    expect(clear(260, 0)).toBe(true);
    expect(vegetationClearance([{ ...road, tunnel: 'yes' }])(245, 0)).toBe(
        true
    );
});
