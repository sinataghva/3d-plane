import { expect, test, afterEach } from 'vitest';
import {
    destinationProjection,
    setDestination,
    getDestination,
    clearDestination
} from './destination.js';
afterEach(clearDestination);
test('map projection round trips both landscape and portrait coordinates and excludes padding', () => {
    const world = { minX: -12000, minZ: -10000, width: 25000, depth: 22000 };
    for (const [width, height] of [
        [1200, 600],
        [390, 700]
    ]) {
        const p = destinationProjection(width, height, world);
        for (const [x, z] of [
            [-12000, -10000],
            [0, 0],
            [13000, 12000]
        ]) {
            const screen = p.point(x, z);
            const result = p.unproject(screen.x, screen.y);
            expect(result?.x).toBeCloseTo(x, 6);
            expect(result?.z).toBeCloseTo(z, 6);
        }
        expect(p.unproject(0, 0)).toBeNull();
    }
});
test('destination uses terrain height, replaces one marker, returns detached state and clears', () => {
    setDestination(12, 34, () => 56);
    expect(getDestination()).toEqual({ x: 12, y: 56, z: 34 });
    const copy = getDestination();
    if (copy) copy.x = 999;
    expect(getDestination()?.x).toBe(12);
    setDestination(-2, 9, () => 100);
    expect(getDestination()).toEqual({ x: -2, y: 100, z: 9 });
    clearDestination();
    expect(getDestination()).toBeNull();
});
