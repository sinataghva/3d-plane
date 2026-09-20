import { expect, test } from 'vitest';
import {
    indexScenerySurfaces,
    offsetLine,
    clipRectangle
} from './scenerySurfaces.js';
import { isSurfaceFeature, distanceToLine } from './surfaceFeatures.js';
/** @param {import('./geography.js').GeoFeature[]} features */
function collect(features) {
    /** @type {import('./scenerySurfaces.js').SurfacePatch[]} */
    const patches = [];
    const world = /** @type {import('./geography.js').Geography} */ (
        /** @type {unknown} */ ({
            data: { features },
            minX: -100,
            minZ: -100,
            maxX: 100,
            maxZ: 100,
            height: () => 0
        })
    );
    indexScenerySurfaces(world, 20, (_x, _z, patch) => patches.push(patch));
    return patches;
}
const base = {
    id: 'test',
    name: 'test',
    holes: [],
    line: true,
    kind: 'rail',
    points: [
        [0, 0],
        [30, 0],
        [60, 10]
    ]
};
test('tunnels, culverts, covered waterways and inactive railways do not draw on the surface', () => {
    for (const tags of [
        { tunnel: 'yes' },
        { tunnel: 'culvert' },
        { covered: 'yes' },
        { railwayType: 'abandoned' }
    ])
        expect(collect([{ ...base, ...tags }])).toHaveLength(0);
    expect(isSurfaceFeature({ ...base, tunnel: 'no' })).toBe(true);
    expect(isSurfaceFeature({ ...base, layer: '-1' })).toBe(true);
    expect(
        collect([{ ...base, kind: 'waterway', waterwayType: 'weir' }])
    ).toHaveLength(0);
});
test('polygon tessellation and tile clipping preserve islands and total surface area', () => {
    const patches = collect([
        {
            ...base,
            kind: 'water',
            line: false,
            points: [
                [0, 0],
                [60, 0],
                [60, 60],
                [0, 60],
                [0, 0]
            ],
            holes: [
                [
                    [20, 20],
                    [40, 20],
                    [40, 40],
                    [20, 40],
                    [20, 20]
                ]
            ]
        }
    ]);
    const area = patches.reduce(
        (sum, p) =>
            sum +
            Math.abs(
                p.points.reduce((s, a, i) => {
                    const b = p.points[(i + 1) % p.points.length];
                    return s + a[0] * b[1] - b[0] * a[1];
                }, 0)
            ) /
                2,
        0
    );
    expect(area).toBeCloseTo(3200);
    expect(patches.every((p) => p.kind === 'water')).toBe(true);
});
test('line water does not put a bank across an existing lake polygon', () => {
    const water = {
        ...base,
        kind: 'water',
        line: false,
        points: [
            [-10, -10],
            [80, -10],
            [80, 30],
            [-10, 30],
            [-10, -10]
        ]
    };
    const patches = collect([water, { ...base, kind: 'waterway', width: 4 }]);
    expect(patches.some((p) => p.kind === 'bank')).toBe(false);
});
test('rails stay a gauge apart and sharp curve offsets remain finite and bounded', () => {
    const points = [
        [0, 0],
        [10, 0],
        [0.1, 0.01]
    ];
    const shifted = offsetLine(points, 1);
    shifted.forEach((p, i) =>
        expect(
            Math.hypot(p[0] - points[i][0], p[1] - points[i][1])
        ).toBeLessThanOrEqual(2.00001)
    );
    const patches = collect([
        {
            ...base,
            points: [
                [0, 0],
                [10, 0]
            ],
            gauge: 1.435
        }
    ]).filter((p) => p.kind === 'rail');
    expect(patches).toHaveLength(2);
    const centers = patches
        .map((p) => p.points.reduce((s, p) => s + p[1], 0) / p.points.length)
        .sort();
    expect(Math.abs(centers[1] - centers[0])).toBeCloseTo(1.435);
    expect(
        distanceToLine(5, 2, [
            [0, 0],
            [10, 0]
        ])
    ).toBe(2);
    expect(
        clipRectangle(
            [
                [0, 0],
                [30, 0],
                [30, 30],
                [0, 30]
            ],
            0,
            0,
            20,
            20
        ).every((p) => p[0] <= 20 && p[1] <= 20)
    ).toBe(true);
});

test('bridge profiles use endpoint elevation and never infer metres from layer tags', async () => {
    const { bridgeProfile, surfaceElevation } =
        await import('./surfaceFeatures.js');
    const f = {
        ...base,
        bridge: 'yes',
        layer: '2',
        points: [
            [0, 0],
            [100, 0]
        ]
    };
    const profile = bridgeProfile(f, () => 10);
    expect(surfaceElevation(profile, 50, 0, 0)).toBe(10);
    expect(surfaceElevation(profile, 50, 0, 15)).toBe(15);
    expect(bridgeProfile({ ...f, bridge: 'no' }, () => 10)).toBeUndefined();
});

test('partial polygon overlap clips waterway banks at the shoreline', () => {
    const lake = {
        ...base,
        kind: 'water',
        line: false,
        points: [
            [0, -10],
            [20, -10],
            [20, 10],
            [0, 10],
            [0, -10]
        ]
    };
    const stream = {
        ...base,
        kind: 'waterway',
        width: 4,
        points: [
            [-10, 0],
            [30, 0]
        ]
    };
    const bank = collect([stream, lake]).filter((p) => p.kind === 'bank');
    expect(bank.length).toBeGreaterThan(0);
    for (const patch of bank) {
        const cx =
            patch.points.reduce((s, p) => s + p[0], 0) / patch.points.length;
        expect(cx <= 0 || cx >= 20).toBe(true);
    }
});
