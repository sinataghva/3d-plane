import { expect, test } from 'vitest';
import { buildingBase } from './buildingFoundation.js';

test('ordinary building foundation clears terrain peaks inside its footprint', () => {
    const f = {
        id: 'test',
        kind: 'building',
        name: '',
        line: false,
        holes: [],
        points: [
            [0, 0],
            [20, 0],
            [20, 20],
            [0, 20],
            [0, 0]
        ]
    };
    const world = {
        width: 2560,
        depth: 2560,
        minX: 0,
        minZ: 0,
        height: (/** @type {number} */ x, /** @type {number} */ z) =>
            x === 10 && z === 10 ? 12 : 0
    };
    expect(buildingBase(f, world)).toBe(12);
});
