import { createAzadiSquare } from './azadiSquare.js';
import {
    AZADI_FLAGS,
    createAzadiFlags,
    azadiFlagGeometry
} from './azadiFlags.js';
import { createRenderedHeight } from './groundDetail.js';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test, expect } from 'vitest';
import { createGeography } from './geography.js';
import { createParkedAircraft, parkedGeometry } from './parkedAircraft.js';
import { MEHRABAD_CIVIL_APRONS, MEHRABAD_MILITARY_APRONS } from './mehrabad.js';
import { Vector3 } from 'three';
import { tehranLandmarks } from './tehranLandmarks.js';
import { createUniversitySetting } from './universitySetting.js';
import { createBombSurfaces } from './bombSurfaces.js';
import { inFeature, inRing } from './geography.js';
import {
    bombLaunch,
    advanceBomb,
    createBombSimulation
} from '../flight/bombs.js';
import { createPlaneState } from '../flight/physics.js';

test('bomb contacts use real Tehran roof, lake and hill surfaces', () => {
    const world = createGeography({ ...data, airfield: 'OIII' }, dem, {
            icao: 'OIII',
            runwayRef: '11R/29L'
        }),
        surface = createBombSurfaces(world);
    const compareTrajectory = (x, z, height, kind) => {
        const state = createPlaneState('phantom');
        Object.assign(state, {
            position: { x: x + 2.4, y: height + 40, z: z + 2 },
            speed: 0,
            verticalSpeed: 0,
            yawAngle: 0,
            pitchAngle: 0,
            rollAngle: 0,
            isAirborne: true
        });
        const preview = bombLaunch(state, 0),
            previous = new Vector3();
        let predicted;
        for (let i = 0; i < 1200 && !predicted; i++) {
            previous.copy(preview.position);
            advanceBomb(preview);
            predicted = surface.sweep(previous, preview.position);
        }
        const sim = createBombSimulation(surface.sweep, surface.inside);
        let hits = sim.step(state, true, 40);
        for (let i = 0; i < 1200 && !hits.length; i++)
            hits = sim.step(state, false, 40);
        expect(predicted?.kind).toBe(kind);
        expect(hits).toHaveLength(1);
        expect(hits[0].position.distanceTo(predicted.position)).toBeLessThan(
            0.1
        );
    };
    let roofChecked = false;
    for (const f of data.features.filter(
        (f) =>
            f.kind === 'building' &&
            f.height > 20 &&
            f.points.length === 5 &&
            !f.holes.length
    )) {
        const p = f.points.slice(0, -1),
            x = p.reduce((a, p) => a + p[0], 0) / 4,
            z = p.reduce((a, p) => a + p[1], 0) / 4;
        if (!inFeature(x, z, f)) continue;
        const roof = world.height(f.points[0][0], f.points[0][1]) + f.height;
        const hit = surface.sweep(
            new Vector3(x, roof + 10, z),
            new Vector3(x, roof - 1, z)
        );
        if (hit?.kind === 'building' && Math.abs(hit.position.y - roof) < 0.1) {
            compareTrajectory(x, z, roof, 'building');
            roofChecked = true;
            break;
        }
    }
    expect(roofChecked).toBe(true);
    const f = data.features.find((f) => f.id === 'r8128152-0'),
        x = f.points.reduce((a, p) => a + p[0], 0) / f.points.length,
        z = f.points.reduce((a, p) => a + p[1], 0) / f.points.length;
    const water = surface.sweep(
        new Vector3(x, surface.height(x, z) + 30, z),
        new Vector3(x, surface.height(x, z) - 5, z)
    );
    expect(water.kind).toBe('water');
    compareTrajectory(x, z, surface.height(x, z), 'water');
    expect(Math.abs(water.position.y - surface.height(x, z))).toBeLessThan(0.1);
    const hill = surface.sweep(
        new Vector3(15000, surface.height(15000, -17000) + 40, -17000),
        new Vector3(15000, surface.height(15000, -17000) - 5, -17000)
    );
    expect(hill.kind).toBe('ground');
    compareTrajectory(15000, -17000, surface.height(15000, -17000), 'ground');
    compareTrajectory(
        world.spawn.x,
        world.spawn.z,
        surface.height(world.spawn.x, world.spawn.z),
        'ground'
    );
    expect(
        Math.abs(hill.position.y - surface.height(15000, -17000))
    ).toBeLessThan(0.1);
});

test('university planting is bounded and keeps the cached Enghelab bus alignment', () => {
    const world = createGeography(
        { ...data, airfield: 'Mehrabad · OIII' },
        dem,
        { icao: 'OIII', runwayRef: '11R/29L' }
    );
    const gate = tehranLandmarks(world.data).find((l) => l.id === 'university');
    const setting = createUniversitySetting(world, gate);
    const trees = setting.getObjectByName('Campus broadleaf trees');
    expect(trees.count).toBeGreaterThan(10);
    expect(trees.count).toBeLessThanOrEqual(36);
    expect(
        setting.getObjectByName('Enghelab central bus corridor')
    ).toBeTruthy();
    setting.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
    });
});

test('all eight landmarks stay inside existing bounds and tall towers collide', () => {
    const world = createGeography(
        { ...data, airfield: 'Mehrabad · OIII' },
        dem,
        { icao: 'OIII', runwayRef: '11R/29L' }
    );
    const landmarks = tehranLandmarks(world.data);
    expect(landmarks).toHaveLength(8);
    for (const l of landmarks) {
        expect(l.x - l.width / 2).toBeGreaterThan(world.minX);
        expect(l.x + l.width / 2).toBeLessThan(world.maxX);
        expect(l.z - l.depth / 2).toBeGreaterThan(world.minZ);
        expect(l.z + l.depth / 2).toBeLessThan(world.maxZ);
    }
    const milad = landmarks.find((l) => l.id === 'milad'),
        azadi = landmarks[0];
    expect(
        world.obstacle(milad.x, milad.z, world.height(milad.x, milad.z) + 400)
    ).toBe('building');
    expect(
        world.obstacle(azadi.x, azadi.z, world.height(azadi.x, azadi.z) + 10)
    ).not.toBe('building');
});

test('Mehrabad has bounded, distinct static fleets with quality culling', () => {
    const world = createGeography(data, dem, {
        icao: 'OIII',
        runwayRef: '11R/29L'
    });
    const fleet = createParkedAircraft(world);
    const military = fleet.spots.filter((p) =>
        MEHRABAD_MILITARY_APRONS.includes(p.apron)
    );
    const civil = fleet.spots.filter((p) =>
        MEHRABAD_CIVIL_APRONS.includes(p.apron)
    );
    expect(military).toHaveLength(8);
    expect(civil.length).toBeGreaterThan(0);
    expect(civil.length).toBeLessThanOrEqual(6);
    expect(fleet.spots).toEqual(createParkedAircraft(world).spots);
    for (const [i, p] of fleet.spots.entries()) {
        for (const q of fleet.spots.slice(i + 1))
            expect(Math.hypot(p.x - q.x, p.z - q.z)).toBeGreaterThanOrEqual(
                p.radius + q.radius + 4
            );
    }
    const meshes = fleet.group.children.flatMap((g) => g.children);
    fleet.update(new Vector3(100000, 100000, 100000), 'high');
    expect(meshes.every((m) => !m.visible)).toBe(true);
    const p = military[0];
    const camera = new Vector3(p.x, world.height(p.x, p.z) + 50, p.z);
    fleet.update(camera, 'low');
    expect(meshes.some((m) => m.visible && m.name === 'Parked F-5 Tiger')).toBe(
        true
    );
    const low = meshes.filter((m) => m.visible).length;
    fleet.update(camera, 'high');
    expect(meshes.filter((m) => m.visible).length).toBeGreaterThanOrEqual(low);
    for (const type of ['f5', 'airliner']) {
        const geometry = parkedGeometry(type);
        const positions = geometry.getAttribute('position');
        const radius = type === 'f5' ? 8.5 : 24;
        expect([...positions.array].every(Number.isFinite)).toBe(true);
        for (let i = 0; i < positions.count; i++)
            expect(
                Math.hypot(positions.getX(i), positions.getZ(i))
            ).toBeLessThan(radius);
        expect(geometry.boundingBox.min.y).toBeCloseTo(0.06);
        expect(positions.count).toBeLessThan(15000);
        geometry.dispose();
    }
    meshes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
    });
});

// Read the large dataset directly, as the game does, instead of transforming
// it into a JavaScript module, which exceeds the bundler's string limits.
const data = JSON.parse(
    readFileSync(new URL('../../data/tehran/map.json', import.meta.url), 'utf8')
);
const dem = JSON.parse(
    readFileSync(
        new URL('../../data/tehran/elevation.json', import.meta.url),
        'utf8'
    )
);

test('Tehran has a consistent local coordinate and elevation foundation', () => {
    expect(data.bounds).toEqual(dem.bounds);
    // Preserve existing coordinates while extending only the northern edge.
    expect(data.origin).toEqual([35.675, 51.379999999999995]);
    expect(dem.values).toHaveLength(dem.size ** 2);
    expect(
        dem.values.every((v) => Number.isFinite(v) && v > -500 && v < 9000)
    ).toBe(true);
    expect(Math.max(...dem.values)).toBeGreaterThan(2000);
    const world = createGeography(data, dem);
    expect(world.width).toBeGreaterThan(25000);
    expect(world.width / world.depth).toBeGreaterThan(1.4);
    expect(data.bounds[0]).toBe(35.53);
    expect(data.bounds[2]).toBe(35.85);
    expect(data.bounds[1]).toBe(51.1);
    expect(data.bounds[3]).toBe(51.66);
    expect(world.depth).toBeGreaterThan(25000);
    expect(Number.isFinite(world.height(world.spawn.x, world.spawn.z))).toBe(
        true
    );
    expect(world.onRunway(world.spawn.x, world.spawn.z)).toBe(true);
    const ids = data.features.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(
        data.features.every((f) =>
            [f.points, ...f.holes].every((ring) =>
                ring.every((p) => p.length === 2 && p.every(Number.isFinite))
            )
        )
    ).toBe(true);
});

test('northern extension fully contains Saadabad and Darband with foothill margin', () => {
    const world = createGeography(data, dem);
    const complex = data.features.find((f) => f.id === 'w175818336-0');
    expect(complex).toBeTruthy();
    for (const [x, z] of complex.points) {
        expect(x).toBeGreaterThan(world.minX);
        expect(x).toBeLessThan(world.maxX);
        expect(z).toBeGreaterThan(world.minZ + 2000);
        expect(z).toBeLessThan(world.maxZ);
    }
    const square = data.places.find((p) => p.id === 5904296730);
    expect(square).toBeTruthy();
    expect(square.point[1] - world.minZ).toBeGreaterThan(2000);
    const oldEdge = (data.origin[0] - 35.82) * 111320;
    expect(
        data.features.filter(
            (f) => f.kind === 'road' && f.points.some((p) => p[1] < oldEdge)
        ).length
    ).toBeGreaterThan(100);
    expect(world.depth).toBeCloseTo(35622.4, 1);
});

test('Tehran retains Mehrabad runways, dry-land geometry and source credits', () => {
    const world = createGeography(data, dem);
    const lon = (/** @type {number} */ x) =>
        data.origin[1] +
        x / (111320 * Math.cos((data.origin[0] * Math.PI) / 180));
    const lat = (/** @type {number} */ z) => data.origin[0] - z / 111320;
    expect(
        world.runways.some(
            (r) =>
                r.ref === '11L/29R' &&
                r.points.some(
                    ([x, z]) =>
                        lon(x) > 51.27 &&
                        lon(x) < 51.34 &&
                        lat(z) > 35.67 &&
                        lat(z) < 35.71
                )
        )
    ).toBe(true);
    expect(data.landscape).toBe('arid');
    expect(
        data.features.some((f) => f.kind === 'airfield' && f.icao === 'OIII')
    ).toBe(true);
    expect(data.features.some((f) => f.kind === 'dry')).toBe(true);
    expect(data.features.some((f) => f.palace)).toBe(false);
    expect(data.license).toBe('ODbL-1.0');
    expect(data.source).toContain('OpenStreetMap');
    expect(dem.sources.length).toBeGreaterThan(0);
});

test('Azadi landscape follows cached paths and terrain without changing the road network', () => {
    const world = createGeography({ ...data, airfield: 'OIII' }, dem, {
        icao: 'OIII',
        runwayRef: '11R/29L'
    });
    const before = JSON.stringify(world.data.features);
    const setting = createAzadiSquare(world);
    const height = createRenderedHeight(world);
    expect(setting.userData.summary.outerGardens).toBe(4);
    expect(setting.userData.summary.fountains).toBe(16);
    expect(setting.userData.summary.paths).toBeGreaterThan(100);
    expect(setting.userData.summary.shrubs).toBeLessThanOrEqual(24);
    expect(
        setting.children.filter((c) => c.name !== 'Azadi outer garden flags')
            .length
    ).toBeLessThanOrEqual(5);
    for (const [name, offset] of [
        ['Azadi lawn', 0.12],
        ['Azadi paving', 0.15]
    ]) {
        const mesh = setting.getObjectByName(name);
        const p = mesh.geometry.attributes.position;
        expect(p.count).toBeGreaterThan(0);
        for (let i = 0; i < p.count; i += 3) {
            const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3;
            const z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3;
            const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
            expect(Math.abs(y - height(x, z) - offset)).toBeLessThan(0.006);
        }
    }
    // Lawn triangles must stay on the five mapped islands, leaving the
    // intervening roads unpainted. Every outer garden must receive geometry.
    const gardenIds = [
        'w544306451-0',
        'w545300305-0',
        'w545300307-0',
        'w545300123-0',
        'w545300308-0'
    ];
    const gardens = gardenIds.map((id) =>
        world.data.features.find((f) => f.id === id)
    );
    const covered = new Set();
    const lawn =
        setting.getObjectByName('Azadi lawn').geometry.attributes.position;
    for (let i = 0; i < lawn.count; i += 3) {
        const x = (lawn.getX(i) + lawn.getX(i + 1) + lawn.getX(i + 2)) / 3;
        const z = (lawn.getZ(i) + lawn.getZ(i + 1) + lawn.getZ(i + 2)) / 3;
        const garden = gardens.findIndex((f) => inRing(x, z, f.points));
        expect(garden).toBeGreaterThanOrEqual(0);
        covered.add(garden);
    }
    expect(covered.size).toBe(5);
    const water =
        setting.getObjectByName('Azadi water').geometry.attributes.position;
    for (let i = 0; i < water.count; i += 3) {
        expect(water.getY(i)).toBe(water.getY(i + 1));
        expect(water.getY(i)).toBe(water.getY(i + 2));
    }
    expect(JSON.stringify(world.data.features)).toBe(before);
    expect(
        createAzadiSquare({
            ...world,
            data: { ...world.data, airfield: 'LFPZ' }
        }).children
    ).toHaveLength(0);
    setting.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
    });
});

test('Azadi flags occupy four separate outer gardens and keep the center clear', () => {
    const world = createGeography({ ...data, airfield: 'OIII' }, dem, {
        icao: 'OIII',
        runwayRef: '11R/29L'
    });
    const tower = tehranLandmarks(world.data)[0];
    const height = createRenderedHeight(world);
    expect(new Set(AZADI_FLAGS.map((p) => p.garden)).size).toBe(4);
    for (const garden of new Set(AZADI_FLAGS.map((p) => p.garden)))
        expect(AZADI_FLAGS.filter((p) => p.garden === garden)).toHaveLength(3);
    for (const pole of AZADI_FLAGS) {
        const garden = world.data.features.find((f) => f.id === pole.garden);
        expect(garden).toBeDefined();
        expect(inRing(pole.x, pole.z, garden.points)).toBe(true);
        expect(Math.hypot(pole.x - tower.x, pole.z - tower.z)).toBeGreaterThan(
            175
        );
        for (const other of AZADI_FLAGS)
            if (other !== pole)
                expect(
                    Math.hypot(pole.x - other.x, pole.z - other.z)
                ).toBeGreaterThan(85);
    }
    const group = createAzadiFlags(world);
    expect(group.children.length).toBe(15);
    const flags = group.children.filter((c) => c.name.startsWith('Azadi Lion'));
    expect(flags).toHaveLength(12);
    for (const flag of flags)
        expect(
            flag.position.y - height(flag.position.x, flag.position.z)
        ).toBeCloseTo(28.13);
    const geometry = azadiFlagGeometry();
    const p = geometry.attributes.position;
    expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
    for (let i = 0; i < p.count; i++)
        if (p.getX(i) < 0.3) expect(Math.abs(p.getZ(i))).toBeLessThan(1e-6);
    geometry.dispose();
});
