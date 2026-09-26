import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { test, expect } from 'vitest';
import { createGeography } from './geography.js';
import { createParkedAircraft, parkedGeometry } from './parkedAircraft.js';
import { MEHRABAD_CIVIL_APRONS, MEHRABAD_MILITARY_APRONS } from './mehrabad.js';
import { Vector3 } from 'three';
import { tehranLandmarks, createTehranLandmarks } from './tehranLandmarks.js';
import { createRenderedHeight } from './groundDetail.js';
import { createUniversitySetting } from './universitySetting.js';

test('Azadi garden triangles follow the actual sloped terrain with constant clearance', () => {
    const world = createGeography({ ...data, airfield: 'OIII' }, dem, {
        icao: 'OIII',
        runwayRef: '11R/29L'
    });
    const group = createTehranLandmarks(world);
    const garden = group.getObjectByName(
        'Azadi Square · stylized geometric gardens'
    );
    const positions = garden.geometry.attributes.position;
    const height = createRenderedHeight(world);
    for (let i = 0; i < positions.count; i += 3) {
        const x =
            (positions.getX(i) +
                positions.getX(i + 1) +
                positions.getX(i + 2)) /
            3;
        const y =
            (positions.getY(i) +
                positions.getY(i + 1) +
                positions.getY(i + 2)) /
            3;
        const z =
            (positions.getZ(i) +
                positions.getZ(i + 1) +
                positions.getZ(i + 2)) /
            3;
        expect(Math.abs(y - height(x, z) - 0.16)).toBeLessThan(0.005);
    }
    group.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material?.dispose();
    });
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
