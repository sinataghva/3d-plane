import { test, expect } from 'vitest';
import { appendAirfieldBuilding, airfieldBuilding } from './airfieldScenery.js';
import { pavedAirfieldSurface } from './surfaceFeatures.js';
import { indexScenerySurfaces } from './scenerySurfaces.js';
const building = {
    id: 'w1',
    kind: 'building',
    aeroway: 'hangar',
    name: '',
    height: 10,
    holes: [],
    line: false,
    points: [
        [0, 0],
        [40, 0],
        [40, 20],
        [0, 20],
        [0, 0]
    ]
};
const boundary = {
    ...building,
    kind: 'airfield',
    points: [
        [-10, -10],
        [50, -10],
        [50, 30],
        [-10, 30],
        [-10, -10]
    ]
};
const world = /** @type {import('./geography.js').Geography} */ (
    /** @type {unknown} */ ({
        data: { features: [building, boundary] },
        height: () => 0,
        minX: -100,
        maxX: 100,
        minZ: -100,
        maxZ: 100
    })
);
test('enhance only mapped aviation buildings inside the airfield', () => {
    expect(airfieldBuilding(building, [boundary])).toBe(true);
    expect(
        airfieldBuilding({ ...building, aeroway: undefined }, [boundary])
    ).toBe(false);
    expect(airfieldBuilding(building, [])).toBe(false);
});
for (const aeroway of ['hangar', 'shelter', 'tower'])
    test(`${aeroway} geometry stays in the source envelope and has finite normals input`, () => {
        const chunk = { positions: [], colors: [] };
        appendAirfieldBuilding({ ...building, aeroway }, world, chunk, true);
        expect(chunk.positions.length).toBeGreaterThan(100);
        expect(chunk.colors.length).toBe(chunk.positions.length);
        for (let i = 0; i < chunk.positions.length; i += 3) {
            expect(Number.isFinite(chunk.positions[i])).toBe(true);
            expect(chunk.positions[i]).toBeGreaterThanOrEqual(-0.05);
            expect(chunk.positions[i]).toBeLessThanOrEqual(40.05);
            expect(chunk.positions[i + 1]).toBeGreaterThanOrEqual(-1);
            expect(chunk.positions[i + 1]).toBeLessThanOrEqual(10);
            expect(chunk.positions[i + 2]).toBeGreaterThanOrEqual(-0.05);
            expect(chunk.positions[i + 2]).toBeLessThanOrEqual(20.05);
        }
    });
test('explicit grass and asphalt override mission defaults', () => {
    expect(pavedAirfieldSurface({ ...building, surface: 'grass' }, true)).toBe(
        false
    );
    expect(
        pavedAirfieldSurface({ ...building, surface: 'asphalt' }, false)
    ).toBe(true);
    expect(pavedAirfieldSurface(building, false)).toBe(false);
    expect(pavedAirfieldSurface(building, true)).toBe(true);
});
test('apron detail preserves source footprint holes', () => {
    const f = {
        ...building,
        kind: 'taxiway',
        aeroway: 'apron',
        surface: 'concrete',
        holes: [
            [
                [10, 5],
                [20, 5],
                [20, 15],
                [10, 15],
                [10, 5]
            ]
        ]
    };
    /** @type {import('./scenerySurfaces.js').SurfacePatch[]} */
    const patches = [];
    indexScenerySurfaces(
        { ...world, data: { ...world.data, features: [f] } },
        15,
        (_x, _z, p) => patches.push(p)
    );
    expect(patches.every((p) => p.kind === 'asphalt')).toBe(true);
    const area = patches.reduce(
        (s, p) =>
            s +
            Math.abs(
                p.points.reduce((a, v, i) => {
                    const b = p.points[(i + 1) % p.points.length];
                    return a + v[0] * b[1] - b[0] * v[1];
                }, 0)
            ) /
                2,
        0
    );
    expect(area).toBeCloseTo(700);
});
