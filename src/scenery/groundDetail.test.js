import { expect, test } from 'vitest';
import {
    createRenderedHeight,
    detailOpacity,
    GROUND_DETAIL_PRESETS
} from './groundDetail.js';
import { roadJunctionPatches } from './groundDetail.js';

test('separate source road ways receive joined caps without bridging tunnels or layers', () => {
    /** @param {number[][]} points @param {Partial<import('./geography.js').GeoFeature>} [extra] */
    const road = (points, extra = {}) => ({
        id: 'r',
        name: '',
        kind: 'road',
        line: true,
        points,
        holes: [],
        width: 10,
        ...extra
    });
    const bend = [
        road([
            [-30, 0],
            [0, 0]
        ]),
        road([
            [0, 0],
            [0, 30]
        ])
    ];
    const caps = roadJunctionPatches(bend);
    expect(caps).toHaveLength(1);
    expect(caps[0]).toHaveLength(16);
    // The unfilled outer quadrant of the two butt-ended strips is now covered.
    expect(caps[0].some(([x, z]) => x > 3 && z < -3)).toBe(true);
    expect(
        roadJunctionPatches([bend[0], { ...bend[1], layer: '1' }])
    ).toHaveLength(0);
    expect(
        roadJunctionPatches([bend[0], { ...bend[1], tunnel: 'yes' }])
    ).toHaveLength(0);
    expect(
        roadJunctionPatches([bend[0], { ...bend[1], bridge: 'yes' }])
    ).toHaveLength(0);
    expect(roadJunctionPatches([bend[0]])).toHaveLength(0);
});
test('detail fade includes a fully detailed inner area and a smooth outer transition', () => {
    expect(detailOpacity(0, 0)).toBe(0);
    expect(detailOpacity(300, 1000)).toBe(1);
    expect(detailOpacity(800, 1000)).toBeCloseTo(0.5);
    expect(detailOpacity(1000, 1000)).toBe(0);
    expect(detailOpacity(3000, 1000)).toBe(0);
    expect(GROUND_DETAIL_PRESETS.high.radius).toBeGreaterThan(
        GROUND_DETAIL_PRESETS.balanced.radius
    );
    expect(GROUND_DETAIL_PRESETS.low.tiles).toBe(0);
});
test('overlay heights match the terrain triangle interpolation on sloped ground', () => {
    const world = /** @type {import('./geography.js').Geography} */ (
        /** @type {unknown} */ ({
            width: 256,
            depth: 256,
            minX: -128,
            minZ: -128,
            height: (/** @type {number} */ x, /** @type {number} */ z) =>
                x * 0.2 + z * 0.4
        })
    );
    const h = createRenderedHeight(world);
    for (const [x, z] of [
        [0, 0],
        [15.3, 27.9],
        [-48.8, 44.1]
    ])
        expect(h(x, z)).toBeCloseTo(x * 0.2 + z * 0.4, 5);
});

test('wide surfaces are subdivided onto the base triangles without height gaps', async () => {
    const { clipToTerrain } = await import('./groundDetail.js');
    const world = /** @type {import('./geography.js').Geography} */ (
        /** @type {unknown} */ ({
            width: 256,
            depth: 256,
            minX: 0,
            minZ: 0,
            height: (/** @type {number} */ x, /** @type {number} */ z) =>
                Math.sin(x * 0.8) * Math.cos(z * 0.6) * 4
        })
    );
    const height = createRenderedHeight(world);
    const triangles = clipToTerrain(
        [
            [2.2, 1.7],
            [6.8, 2.9],
            [7.2, 5.5],
            [2.6, 4.3]
        ],
        world
    );
    expect(triangles.length).toBeGreaterThan(6);
    for (let i = 0; i < triangles.length; i += 3) {
        const a = triangles[i],
            b = triangles[i + 1],
            c = triangles[i + 2];
        const interpolated =
            (height(a[0], a[1]) + height(b[0], b[1]) + height(c[0], c[1])) / 3;
        expect(interpolated).toBeCloseTo(
            height((a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3),
            5
        );
    }
});

test('road bends and closed loops share identical edge vertices without gaps', async () => {
    const { roadRibbon } = await import('./groundDetail.js');
    for (const points of [
        [
            [0, 0],
            [30, 0],
            [30, 30]
        ],
        [
            [0, 0],
            [0, 0],
            [30, 0],
            [30, 30],
            [0, 30],
            [0, 0]
        ]
    ]) {
        const segments = roadRibbon(points, 6);
        for (let i = 1; i < segments.length; i++) {
            expect(segments[i - 1].corners[1]).toEqual(segments[i].corners[0]);
            expect(segments[i - 1].corners[2]).toEqual(segments[i].corners[3]);
        }
        if (points.length > 3) {
            expect(segments[segments.length - 1].corners[1]).toEqual(
                segments[0].corners[0]
            );
            expect(segments[segments.length - 1].corners[2]).toEqual(
                segments[0].corners[3]
            );
        }
    }
    expect(
        roadRibbon(
            [
                [0, 0],
                [0, 0]
            ],
            6
        )
    ).toEqual([]);
    const sharp = roadRibbon(
        [
            [0, 0],
            [30, 0],
            [1, 1]
        ],
        6
    );
    expect(
        Math.hypot(sharp[0].corners[1][0] - 30, sharp[0].corners[1][1])
    ).toBeLessThanOrEqual(6.001);
});
