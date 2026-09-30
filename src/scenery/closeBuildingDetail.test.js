import { test, expect } from 'vitest';
import {
    roofBoundaryEdges,
    roofBoundaryData,
    unlitFacadeSeed
} from './closeBuildingDetail.js';

test('roof edge distances shade polygon perimeter but not a triangulation diagonal', () => {
    const points = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10]
    ];
    const edges = roofBoundaryEdges([points]);
    expect(edges.has('0,2')).toBe(false);
    // Triangle 0,1,2 is emitted as 2,1,0. Its diagonal is the second distance.
    expect(roofBoundaryData(points, [0, 1, 2], edges)).toEqual([
        0, 10000, -2010, 0, 10000, -2000, 10, 10000, -2000
    ]);
    const courtyard = [
        [3, 3],
        [7, 3],
        [7, 7],
        [3, 7]
    ];
    const withHole = roofBoundaryEdges([points, courtyard]);
    expect(withHole.has('4,7')).toBe(true);
    expect(withHole.has('3,4')).toBe(false);
});

test('decorative unlit facade seeds remain stable and cannot enable existing night lights', () => {
    const values = Array.from({ length: 1000 }, (_, i) =>
        unlitFacadeSeed(`w${i}`)
    );
    expect(values).toEqual(
        Array.from({ length: 1000 }, (_, i) => unlitFacadeSeed(`w${i}`))
    );
    expect(Math.max(...values)).toBeLessThan(0);
    expect(Math.min(...values)).toBeGreaterThan(-1999);
    expect(new Set(values).size).toBeGreaterThan(500);
});
