import { expect, test } from 'vitest';
import { planAircraftParking } from './parkedAircraft.js';
import { inFeature, segmentDistance } from './geography.js';
const apron = {
    id: 'apron',
    kind: 'taxiway',
    aeroway: 'apron',
    line: false,
    name: '',
    holes: [],
    points: [
        [0, 0],
        [200, 0],
        [200, 100],
        [0, 100],
        [0, 0]
    ]
};
const boundary = {
    ...apron,
    id: 'boundary',
    kind: 'airfield',
    aeroway: 'aerodrome',
    points: [
        [-50, -50],
        [250, -50],
        [250, 150],
        [-50, 150],
        [-50, -50]
    ]
};
const world = /** @type {import('./geography.js').Geography} */ (
    /** @type {unknown} */ ({
        data: { features: [apron, boundary] },
        spawn: { x: -500, z: -500 },
        height: () => 0
    })
);
test('parking is repeatable, fully on apron and safely separated', () => {
    const spots = planAircraftParking(world, false);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots).toEqual(planAircraftParking(world, false));
    for (const [i, p] of spots.entries()) {
        for (let a = 0; a < Math.PI * 2; a += 0.1)
            expect(
                inFeature(
                    p.x + Math.cos(a) * p.radius,
                    p.z + Math.sin(a) * p.radius,
                    apron
                )
            ).toBe(true);
        for (const q of spots.slice(i + 1))
            expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(
                p.radius * 2 + 4
            );
    }
});
test('long runway segments are excluded even when both endpoints are far outside the apron', () => {
    const runway = {
        ...apron,
        id: 'runway',
        kind: 'runway',
        line: true,
        width: 50,
        points: [
            [-500, 20],
            [700, 20]
        ]
    };
    const spots = planAircraftParking(
        {
            ...world,
            data: { ...world.data, features: [apron, boundary, runway] }
        },
        true
    );
    expect(spots.length).toBeGreaterThan(0);
    for (const p of spots)
        expect(
            segmentDistance(p.x, p.z, runway.points[0], runway.points[1])
        ).toBeGreaterThanOrEqual(25 + p.radius + 3);
});
test('rejects unsuitable slopes, absent aprons and building-covered aprons', () => {
    expect(planAircraftParking({ ...world, height: (x) => x }, false)).toEqual(
        []
    );
    expect(
        planAircraftParking(
            { ...world, data: { ...world.data, features: [boundary] } },
            false
        )
    ).toEqual([]);
    const building = {
        ...apron,
        id: 'building',
        kind: 'building',
        aeroway: 'hangar'
    };
    expect(
        planAircraftParking(
            {
                ...world,
                data: { ...world.data, features: [apron, boundary, building] }
            },
            true
        )
    ).toEqual([]);
});
test('apron holes remain free of aircraft', () => {
    const hole = [
        [0, 0],
        [200, 0],
        [200, 60],
        [0, 60],
        [0, 0]
    ];
    const f = { ...apron, holes: [hole] };
    const spots = planAircraftParking(
        { ...world, data: { ...world.data, features: [f, boundary] } },
        false
    );
    expect(spots.length).toBeGreaterThan(0);
    for (const p of spots) expect(p.z - p.radius).toBeGreaterThan(60);
});
