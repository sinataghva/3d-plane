import { test, expect } from 'vitest';
import {
    trafficPath,
    sampleTrafficPath,
    suitableTrafficRoad,
    createRoadTraffic,
    buildTrafficNetwork,
    advanceTrafficCar
} from './roadTraffic.js';

test('Enghelab traffic is denser only in the Tehran one-way network', () => {
    const road = {
        id: 'enghelab',
        name: 'انقلاب اسلامی',
        kind: 'road',
        line: true,
        class: 'primary',
        oneway: 'yes',
        width: 10,
        points: [
            [0, 0],
            [500, 0]
        ],
        holes: []
    };
    expect(buildTrafficNetwork([road], true).edges[0].spacing).toBe(18);
    expect(buildTrafficNetwork([road], false).edges[0].spacing).toBe(180);
});

test('Tehran highway network preserves one-way travel and retires at an extract end', () => {
    const road = {
        id: 'highway',
        name: '',
        kind: 'road',
        line: true,
        class: 'motorway',
        oneway: 'yes',
        points: [
            [0, 0],
            [100, 0]
        ],
        holes: [],
        width: 16
    };
    expect(suitableTrafficRoad(road)).toBe(false);
    expect(suitableTrafficRoad(road, true)).toBe(true);
    const network = buildTrafficNetwork([road], true);
    expect(network.edges).toHaveLength(1);
    expect(network.edges[0].reverse).toBe(-1);
    const car = {
        id: 1,
        edge: 0,
        path: network.edges[0].path,
        distance: 90,
        speed: 20,
        color: 0,
        turn: 0,
        joining: false
    };
    advanceTrafficCar(car, network, 1);
    expect(car.distance).toBe(Infinity);
    expect(buildTrafficNetwork([road]).edges).toHaveLength(2);
    const reverse = buildTrafficNetwork([{ ...road, oneway: '-1' }], true);
    expect(reverse.edges[0].path.points[0][0]).toBeGreaterThan(90);
});

test('paths remove duplicates and interpolate bends by travel distance', () => {
    const path = trafficPath([
        [0, 0],
        [0, 0],
        [10, 0],
        [10, 20]
    ]);
    expect(path.length).toBe(30);
    expect(sampleTrafficPath(path, 5)).toEqual({ x: 5, z: 0 });
    expect(sampleTrafficPath(path, 15)).toEqual({ x: 10, z: 5 });
    expect(sampleTrafficPath(path, 99)).toEqual({ x: 10, z: 20 });
});
test('traffic excludes non-road surfaces, paths and elevated/underground roads', () => {
    const road = {
        id: 'test',
        name: '',
        holes: [],
        kind: 'road',
        line: true,
        class: 'residential',
        points: [
            [0, 0],
            [100, 0]
        ],
        width: 5
    };
    expect(suitableTrafficRoad(road)).toBe(true);
    for (const change of [
        { class: 'footway' },
        { class: 'cycleway' },
        { kind: 'runway' },
        { bridge: 'viaduct' },
        { tunnel: 'building_passage' },
        { width: 3 }
    ])
        expect(suitableTrafficRoad({ ...road, ...change })).toBe(false);
});
test('traffic moves on the right lane, freezes at zero delta, and honors rural quality caps', () => {
    for (const rural of [false, true]) {
        const roads = Array.from({ length: 12 }, (_, i) => ({
            id: 'r' + i,
            name: '',
            kind: 'road',
            line: true,
            class: 'residential',
            points: [
                [-600, i * 80],
                [600, i * 80]
            ],
            width: 6,
            holes: []
        }));
        const world = {
            width: 2000,
            depth: 2000,
            minX: -1000,
            minZ: -1000,
            height: () => 0,
            data: { airfield: rural ? 'LFSX' : 'LFPZ', features: roads }
        };
        const traffic = createRoadTraffic(
            /** @type {import("./geography.js").Geography} */ (
                /** @type {unknown} */ (world)
            )
        );
        const position = { x: 0, y: 10, z: 0 };
        traffic.update(position, 'high', 0);
        expect(traffic.mesh.count).toBe(rural ? 20 : 40);
        const before = Array.from(traffic.mesh.instanceMatrix.array);
        traffic.update(position, 'high', 0);
        expect(Array.from(traffic.mesh.instanceMatrix.array)).toEqual(before);
        traffic.update(position, 'high', 1);
        expect(Array.from(traffic.mesh.instanceMatrix.array)).not.toEqual(
            before
        );
        traffic.update(position, 'balanced', 0);
        expect(traffic.mesh.count).toBe(rural ? 10 : 20);
        traffic.update(position, 'low', 0);
        expect(traffic.mesh.visible).toBe(false);
        expect(traffic.mesh.count).toBe(0);
        traffic.dispose();
    }
});

/** @param {number[][]} points @param {string} id */
const road = (points, id) => ({
    id,
    points,
    kind: 'road',
    class: 'residential',
    line: true,
    width: 6,
    holes: [],
    name: ''
});
/** @param {ReturnType<typeof road>[]} features */
const testWorld = (features) =>
    /** @type {import('./geography.js').Geography} */ (
        /** @type {unknown} */ ({
            width: 10000,
            depth: 10000,
            minX: -5000,
            minZ: -5000,
            height: () => 0,
            data: { airfield: 'LFPZ', features }
        })
    );

test('junctions split shared vertices but never connect unrelated road crossings', () => {
    const network = buildTrafficNetwork([
        road(
            [
                [-100, 0],
                [0, 0],
                [100, 0]
            ],
            'a'
        ),
        road(
            [
                [0, 0],
                [0, 100]
            ],
            'b'
        ),
        road(
            [
                [50, -100],
                [50, 100]
            ],
            'crossing'
        )
    ]);
    expect(network.outgoing.get('0,0')).toHaveLength(3);
    expect(network.outgoing.has('500,0')).toBe(false);
    expect(network.edges).toHaveLength(8);
});

test('cars traverse junctions and dead ends without teleporting or restarting', () => {
    const network = buildTrafficNetwork([
        road(
            [
                [0, 0],
                [50, 0]
            ],
            'a'
        ),
        road(
            [
                [50, 0],
                [50, 50]
            ],
            'b'
        )
    ]);
    const car = {
        id: 1,
        edge: 0,
        path: network.edges[0].path,
        distance: 0,
        speed: 10,
        color: 0,
        turn: 0,
        joining: false
    };
    let previous = sampleTrafficPath(car.path, car.distance),
        maxZ = 0;
    for (let i = 0; i < 1200; i++) {
        advanceTrafficCar(car, network, 0.1);
        const p = sampleTrafficPath(car.path, car.distance);
        expect(
            Math.hypot(p.x - previous.x, p.z - previous.z)
        ).toBeLessThanOrEqual(1.00001);
        maxZ = Math.max(maxZ, p.z);
        previous = p;
    }
    expect(maxZ).toBeGreaterThan(45);
    expect(car.turn).toBeGreaterThan(4);
});

test('population spreads across cells and retains identities across camera boundaries', () => {
    const roads = Array.from({ length: 9 }, (_, i) =>
        road(
            [
                [-2000, (i - 4) * 300],
                [2000, (i - 4) * 300]
            ],
            'r' + i
        )
    );
    const traffic = createRoadTraffic(testWorld(roads));
    traffic.update({ x: 399, y: 50, z: 0 }, 'high', 0);
    const before = traffic.snapshot();
    const cells = new Set(
        before.map((p) => `${Math.floor(p.x / 400)},${Math.floor(p.z / 400)}`)
    );
    expect(cells.size).toBeGreaterThan(20);
    traffic.update({ x: 401, y: 50, z: 0 }, 'high', 0);
    expect(traffic.snapshot()).toEqual(before);
    traffic.update({ x: 550, y: 50, z: 0 }, 'high', 0);
    const after = traffic.snapshot();
    for (const p of before.filter((p) => Math.hypot(p.x - 550, p.z) < 1500))
        expect(after).toContainEqual(p);
    // Long camera travel may retire distant cars, but new ones enter beyond visibility.
    traffic.update({ x: 1050, y: 50, z: 0 }, 'high', 0);
    for (const p of traffic
        .snapshot()
        .filter((p) => !after.some((q) => p.id === q.id)))
        expect(Math.hypot(p.x - 1050, p.z)).toBeGreaterThan(1500);
    traffic.dispose();
});
