import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
    getRoadStructures,
    buildRoadStructureTile,
    createRoadStructures,
    cutTunnelApproaches,
    portalPoint,
    exposedWallIntervals
} from './roadStructures.js';
import {
    buildTrafficNetwork,
    advanceTrafficCar,
    createRoadTraffic
} from './roadTraffic.js';

/** @param {string} id @param {number[][]} points @param {Partial<import('./geography.js').GeoFeature>} [tags] */
const road = (id, points, tags = {}) => ({
    id,
    points,
    kind: 'road',
    line: true,
    name: '',
    holes: [],
    class: 'primary',
    width: 8,
    oneway: 'yes',
    ...tags
});
/** @param {import('./geography.js').GeoFeature[]} features @param {string} [airfield] */
const world = (features, airfield = 'OIII') =>
    /** @type {import('./geography.js').Geography} */ (
        /** @type {unknown} */ ({
            width: 2000,
            depth: 2000,
            minX: -1000,
            minZ: -1000,
            height: () => 0,
            data: { airfield, features }
        })
    );

test('bridge traffic joins its approaches without turning onto a lower crossing', () => {
    const a = road('a', [
            [-300, 0],
            [-150, 0]
        ]),
        b = road(
            'b',
            [
                [-150, 0],
                [0, 0],
                [150, 0]
            ],
            { bridge: 'yes', layer: '1' }
        ),
        c = road('c', [
            [150, 0],
            [300, 0]
        ]),
        lower = road('lower', [
            [0, -200],
            [0, 0],
            [0, 200]
        ]);
    const w = world([a, b, c, lower]),
        d = getRoadStructures(w),
        n = buildTrafficNetwork(w.data.features, true, d);
    expect(d.elevation(b, 0, 0)).toBeGreaterThan(6);
    expect(d.elevation(lower, 0, 0)).toBe(0);
    expect(d.elevation(b, -150, 0)).toBe(0);
    const car = {
        id: 1,
        edge: 0,
        path: n.edges[0].path,
        distance: 0,
        speed: 10,
        color: 0,
        turn: 0,
        joining: false
    };
    const visited = new Set();
    for (let i = 0; i < 55; i++) {
        advanceTrafficCar(car, n, 1);
        visited.add(n.edges[car.edge].road.id);
    }
    expect(visited.has('b')).toBe(true);
    expect(visited.has('c')).toBe(true);
    expect(visited.has('lower')).toBe(false);
});

test('tunnel segments have only external portals and retain an underground traffic route', () => {
    const fs = [
        road('a', [
            [-200, 0],
            [-100, 0]
        ]),
        road(
            't1',
            [
                [-100, 0],
                [0, 0]
            ],
            { tunnel: 'yes' }
        ),
        road(
            't2',
            [
                [0, 0],
                [100, 0]
            ],
            { tunnel: 'yes' }
        ),
        road('b', [
            [100, 0],
            [200, 0]
        ])
    ];
    const w = world(fs),
        d = getRoadStructures(w);
    expect(d.portals).toHaveLength(2);
    expect(d.elevation(fs[0], -100, 0)).toBeCloseTo(-5.2);
    expect(d.elevation(fs[1], -100, 0)).toBeCloseTo(-5.2);
    const traffic = createRoadTraffic(w);
    traffic.update({ x: 0, y: 20, z: 0 }, 'high', 0);
    const samples = traffic.snapshot();
    expect(samples.some((s) => s.underground)).toBe(true);
    expect(traffic.stats().trafficCars).toBeLessThan(
        traffic.stats().trafficActive
    );
    traffic.update({ x: 0, y: 20, z: 0 }, 'high', 1);
    expect(traffic.snapshot()).not.toEqual(samples);
    traffic.dispose();
});

test('portal cuts alter rendered terrain but leave aircraft ground height unchanged', () => {
    const w = world([
        road('a', [
            [-200, 0],
            [-100, 0]
        ]),
        road(
            't',
            [
                [-100, 0],
                [100, 0]
            ],
            { tunnel: 'yes' }
        ),
        road('b', [
            [100, 0],
            [200, 0]
        ])
    ]);
    const geo = new THREE.PlaneGeometry(2000, 2000, 16, 16);
    geo.rotateX(-Math.PI / 2);
    cutTunnelApproaches(w, geo);
    const position = geo.getAttribute('position');
    const index = geo.index;
    if (!index) throw new Error('Terrain must remain indexed');
    let area = 0;
    for (let i = 0; i < index.count; i += 3) {
        const ids = [0, 1, 2].map((j) => index.getX(i + j));
        const [a, b, c] = ids.map((j) => [position.getX(j), position.getZ(j)]);
        area +=
            Math.abs(
                (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            ) / 2;
    }
    expect(area).toBeLessThan(4000000);
    expect(area).toBeGreaterThan(3998000);
    expect(w.height(-110, 0)).toBe(0);
    expect(
        Array.from(geo.getAttribute('normal').array).every(Number.isFinite)
    ).toBe(true);
    geo.dispose();
});

test('French scenery receives no new structures or portal cuts', () => {
    const w = world(
        [
            road(
                'b',
                [
                    [-100, 0],
                    [100, 0]
                ],
                { bridge: 'yes' }
            ),
            road(
                't',
                [
                    [100, 0],
                    [200, 0]
                ],
                { tunnel: 'yes' }
            )
        ],
        'LFSX'
    );
    const d = createRoadStructures(w);
    expect(d.group.children).toHaveLength(0);
    expect(d.data.portals).toHaveLength(0);
    d.dispose();
});

test('a tunnel branch can join an interior surface-road node', () => {
    const tunnel = road(
        'branch',
        [
            [-50, 0],
            [0, 0]
        ],
        { tunnel: 'yes' }
    );
    const surface = road('surface', [
        [0, -50],
        [0, 0],
        [0, 50]
    ]);
    const data = getRoadStructures(world([tunnel, surface]));
    expect(data.portals).toHaveLength(1);
    expect(data.portals[0].recessed).toBe(false);
    expect(data.approaches.has(surface.id)).toBe(false);
    expect(data.elevation(surface, 0, 0)).toBe(0);
    expect(data.elevation(tunnel, 0, 0)).toBe(0);
});

test('structure meshes are deferred, bounded and terrain cuts restore when unloaded', () => {
    const w = world([
        road(
            'bridge',
            [
                [-300, 100],
                [300, 100]
            ],
            { bridge: 'yes' }
        ),
        road('approach', [
            [-200, 0],
            [-100, 0]
        ]),
        road(
            'tunnel',
            [
                [-100, 0],
                [100, 0]
            ],
            { tunnel: 'yes' }
        ),
        road('exit', [
            [100, 0],
            [200, 0]
        ])
    ]);
    const stream = createRoadStructures(w);
    expect(stream.stats().structureBytes).toBe(0);
    expect(stream.group.children).toHaveLength(0);
    const geometry = new THREE.PlaneGeometry(2000, 2000, 256, 256);
    geometry.rotateX(-Math.PI / 2);
    const terrain = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial());
    const original = Array.from(geometry.index?.array || []);
    stream.attachTerrain(terrain);
    for (let i = 0; i < 20; i++)
        stream.update({ x: 0, y: 10000, z: 0 }, 'high');
    expect(stream.stats().structureBytes).toBe(0);
    for (let i = 0; i < 30; i++) stream.update({ x: 0, y: 100, z: 0 }, 'high');
    expect(stream.stats().structureBytes).toBeGreaterThan(0);
    expect(stream.stats().structureActiveTiles).toBeLessThanOrEqual(48);
    expect(stream.stats().structureTerrainPatches).toBeGreaterThan(0);
    expect(Array.from(geometry.index?.array || [])).not.toEqual(original);
    stream.update({ x: 0, y: 100, z: 0 }, 'low');
    expect(stream.stats().structureActiveTiles).toBe(0);
    expect(stream.stats().structureTerrainPatches).toBe(0);
    expect(Array.from(geometry.index?.array || [])).toEqual(original);
    stream.dispose();
    geometry.dispose();
    terrain.material.dispose();
});

test('short bridges and joined fragments have gradual shared car/deck profiles', () => {
    const short = road(
        'short',
        [
            [0, 0],
            [40, 0]
        ],
        { bridge: 'yes' }
    );
    const first = road(
        'first',
        [
            [0, 100],
            [20, 100]
        ],
        { bridge: 'yes' }
    );
    const second = road(
        'second',
        [
            [20, 100],
            [65, 100]
        ],
        { bridge: 'yes' }
    );
    const data = getRoadStructures(world([short, first, second]));
    for (const f of [short, first, second]) {
        const samples = data.profiles.get(f.id).samples;
        for (let i = 1; i < samples.length; i++) {
            const a = samples[i - 1],
                b = samples[i];
            expect(
                Math.abs(b[1] - a[1]) / Math.hypot(b[0] - a[0], b[2] - a[2])
            ).toBeLessThanOrEqual(0.080001);
        }
    }
    expect(data.elevation(short, 20, 0)).toBeLessThan(1.1);
    expect(data.elevation(first, 20, 100)).toBeCloseTo(
        data.elevation(second, 20, 100),
        8
    );
    expect(data.elevation(first, 0, 100)).toBe(0);
    expect(data.elevation(second, 65, 100)).toBe(0);
});

test('tunnel mouth, curved cut and traffic depth follow the surface approach', () => {
    const approach = road(
        'approach',
        [
            [-60, 20],
            [-20, 20],
            [0, 0]
        ],
        { width: 12 }
    );
    const tunnel = road(
        'tunnel',
        [
            [0, 0],
            [0, 100]
        ],
        { tunnel: 'yes', width: 8 }
    );
    const data = getRoadStructures(world([approach, tunnel]));
    const portal = data.portals[0];
    expect(portal.direction[0]).toBeCloseTo(Math.SQRT1_2);
    expect(portal.direction[1]).toBeCloseTo(-Math.SQRT1_2);
    expect(portal.width).toBe(12);
    const near = portalPoint(portal, -Math.sqrt(200));
    expect(near[0]).toBeCloseTo(-10);
    expect(near[1]).toBeCloseTo(10);
    const far = portalPoint(portal, -40);
    expect(far[1]).toBeCloseTo(20);
    expect(far[0]).toBeLessThan(-20);
    expect(data.elevation(approach, ...far)).toBeCloseTo(0);
    expect(data.elevation(approach, 0, 0)).toBeCloseTo(-5.2);
    expect(data.elevation(approach, -10, 10)).toBeLessThan(-3);
    // Every cut cross-section straddles the mapped centreline, including the bend.
    const bend = portal.path.find((/** @type {number[]} */ p) => p[0] === -20);
    expect(bend).toBeDefined();
    for (const distance of portal.stations) {
        const left = portalPoint(portal, -distance, -6.75),
            right = portalPoint(portal, -distance, 6.75),
            center = portalPoint(portal, -distance);
        expect((left[0] + right[0]) / 2).toBeCloseTo(center[0]);
        expect((left[1] + right[1]) / 2).toBeCloseTo(center[1]);
    }
});

test('surface road and tunnel ramp keep the same width and upward road normals', () => {
    const approach = road('continuous-road', [
        [-100, 0],
        [0, 0]
    ]);
    const tunnel = road(
        'continuous-tunnel',
        [
            [0, 0],
            [100, 0]
        ],
        { tunnel: 'yes' }
    );
    const w = world([approach, tunnel]);
    w.height = (_x, z) => z * 0.08;
    const stream = createRoadStructures(w);
    for (let i = 0; i < 30; i++) stream.update({ x: 0, y: 20, z: 0 }, 'high');
    const asphalt = new THREE.Color(0x60676a);
    let surface = 0,
        ramp = 0;
    stream.group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const positions = object.geometry.getAttribute('position');
        const colors = object.geometry.getAttribute('color');
        const normals = object.geometry.getAttribute('normal');
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            if (
                x <= -95 ||
                x >= -5 ||
                Math.abs(colors.getX(i) - asphalt.r) > 1e-6
            )
                continue;
            const halfWidth = Math.abs(positions.getZ(i));
            if (halfWidth > 4.00001) {
                expect(halfWidth).toBeCloseTo(4.6, 5);
                expect(x).toBeGreaterThanOrEqual(-40);
            } else expect(halfWidth).toBeCloseTo(4, 5);
            expect(normals.getY(i)).toBeGreaterThan(0.9);
            if (x < -40) surface++;
            else ramp++;
        }
    });
    expect(surface).toBeGreaterThan(0);
    expect(ramp).toBeGreaterThan(0);
    stream.dispose();
});

test('all connected entrance branches descend and share a mouth without extra portals', () => {
    const main = road(
        'main',
        [
            [-100, 0],
            [0, 0]
        ],
        { width: 12 }
    );
    const branch = road(
        'branch',
        [
            [-90, 35],
            [0, 0]
        ],
        { width: 6 }
    );
    const tunnel = road(
        'tunnel',
        [
            [0, 0],
            [100, 0]
        ],
        { tunnel: 'yes' }
    );
    const data = getRoadStructures(world([main, branch, tunnel]));
    expect(data.portals).toHaveLength(1);
    expect(data.portals[0].branches).toHaveLength(1);
    expect(data.elevation(main, 0, 0)).toBeCloseTo(-5.2);
    expect(data.elevation(branch, 0, 0)).toBeCloseTo(-5.2);
    expect(data.elevation(branch, -18, 7)).toBeLessThan(-2);
    expect(data.elevation(branch, -90, 35)).toBe(0);
});

test('a branch at an intermediate approach junction shares its local depth', () => {
    const main = road(
        'main',
        [
            [-100, 0],
            [-20, 0],
            [0, 0]
        ],
        { width: 12 }
    );
    const branch = road(
        'branch',
        [
            [-65, 30],
            [-20, 0]
        ],
        { width: 6 }
    );
    const tunnel = road(
        'tunnel',
        [
            [0, 0],
            [100, 0]
        ],
        { tunnel: 'yes' }
    );
    const data = getRoadStructures(world([main, branch, tunnel]));
    expect(data.portals).toHaveLength(1);
    expect(data.portals[0].branches).toHaveLength(1);
    expect(data.elevation(main, -20, 0)).toBeCloseTo(-2.6);
    expect(data.elevation(branch, -20, 0)).toBeCloseTo(-2.6);
    expect(data.elevation(branch, -65, 30)).toBe(0);
});

test('retaining walls are clipped at exact branch boundaries, not whole segments', () => {
    const mask = [
        [3, -2],
        [6, -2],
        [6, 2],
        [3, 2]
    ];
    expect(exposedWallIntervals([0, 0], [10, 0], [mask])).toEqual([
        [0, 0.3],
        [0.6, 1]
    ]);
    expect(exposedWallIntervals([4, 0], [5, 0], [mask])).toEqual([]);
});

test('local pillar checks retain long crossing roads and ignore remote segments', () => {
    const bridge = road(
        'bridge',
        [
            [-800, -100],
            [-200, -100]
        ],
        { bridge: 'yes' }
    );
    const crossing = road('crossing', [
        [-10000, -100],
        [10000, -100]
    ]);
    const remote = road('remote', [
        [-10000, 9000],
        [10000, 9000]
    ]);
    const w = world([bridge, crossing, remote]);
    const shared = getRoadStructures(w);
    /** @param {import('./geography.js').GeoFeature[]} roads */
    const build = (roads) =>
        buildRoadStructureTile(
            w,
            {
                key: '-1,-1',
                features: new Set(['bridge']),
                portals: [],
                roads
            },
            shared
        );
    const clear = build([bridge]);
    const blocked = build([bridge, crossing]);
    const distant = build([bridge, remote]);
    expect(clear.stats().structureSupports).toBeGreaterThan(0);
    const mesh = (
        /** @type {ReturnType<typeof buildRoadStructureTile>} */ tile
    ) =>
        /** @type {THREE.Mesh<THREE.BufferGeometry>} */ (
            tile.group.children[0]
        );
    const hasPillarFoot = (
        /** @type {ReturnType<typeof buildRoadStructureTile>} */ tile
    ) =>
        Array.from(mesh(tile).geometry.attributes.position.array).some(
            (value, i) => i % 3 === 1 && value === 0
        );
    expect(hasPillarFoot(clear)).toBe(true);
    expect(hasPillarFoot(blocked)).toBe(false);
    expect(distant.stats()).toEqual(clear.stats());
    expect(
        Array.from(mesh(distant).geometry.attributes.position.array)
    ).toEqual(Array.from(mesh(clear).geometry.attributes.position.array));
    for (const tile of [clear, blocked, distant]) tile.dispose();
});

test('unfinished structure tiles stay hidden and cancel cleanly when detail is disabled', () => {
    const w = world([
        road(
            'bridge',
            [
                [100, 100],
                [400, 100]
            ],
            { bridge: 'yes' }
        )
    ]);
    const stream = createRoadStructures(w);
    let time = 0;
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => time++);
    const dispose = vi.spyOn(THREE.BufferGeometry.prototype, 'dispose');
    try {
        stream.update({ x: 200, y: 30, z: 100 }, 'high');
        expect(stream.stats().structurePending).toBeGreaterThan(0);
        expect(stream.stats().structureActiveTiles).toBe(0);
        expect(stream.group.children).toHaveLength(0);
        stream.update({ x: 200, y: 30, z: 100 }, 'low');
        expect(dispose).toHaveBeenCalled();
        expect(stream.stats().structurePending).toBe(0);
        expect(stream.stats().structureResidentTiles).toBe(0);
        for (let i = 0; i < 30; i++)
            stream.update({ x: 200, y: 30, z: 100 }, 'high');
        expect(stream.stats().structurePending).toBe(0);
        expect(stream.stats().structureTriangles).toBeGreaterThan(0);
        expect(stream.group.children.length).toBeGreaterThan(0);
    } finally {
        stream.dispose();
        dispose.mockRestore();
        clock.mockRestore();
    }
});
