import { describe, expect, it } from 'vitest';

import { worldToRadarPoint } from './minimap.js';

describe('mini map projection', () => {
    it('keeps objects ahead of the plane above the radar center', () => {
        const point = worldToRadarPoint({
            worldX: 0,
            worldZ: 10,
            planeX: 0,
            planeZ: 0,
            yawAngle: -Math.PI / 2,
            scale: 1
        });

        expect(point.x).toBeCloseTo(0);
        expect(point.y).toBeCloseTo(-10);
    });

    it('keeps objects to the right of the plane on the right side', () => {
        const point = worldToRadarPoint({
            worldX: -10,
            worldZ: 0,
            planeX: 0,
            planeZ: 0,
            yawAngle: -Math.PI / 2,
            scale: 1
        });

        expect(point.x).toBeCloseTo(10);
        expect(point.y).toBeCloseTo(0);
    });

    it('moves the runway relative to the centered plane', () => {
        const point = worldToRadarPoint({
            worldX: 0,
            worldZ: 100,
            planeX: 0,
            planeZ: 50,
            yawAngle: -Math.PI / 2,
            scale: 1
        });

        expect(point.y).toBeCloseTo(-50);
    });
});
