import { test, expect, vi } from 'vitest';
import { createTerrain } from './terrain.js';
import { createGeography } from './geography.js';
import { Mesh, MeshLambertMaterial, Raycaster, Vector3 } from 'three';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

vi.mock('../map/cartography.js', () => ({
    createGeographicCanvas: () => ({ width: 1, height: 1 })
}));

test('actual Mehrabad terrain triangles do not protrude through the departure runway', () => {
    const data = JSON.parse(
        readFileSync(
            new URL('../../data/tehran/map.json', import.meta.url),
            'utf8'
        )
    );
    const dem = JSON.parse(
        readFileSync(
            new URL('../../data/tehran/elevation.json', import.meta.url),
            'utf8'
        )
    );
    const world = createGeography(data, dem, {
        icao: 'OIII',
        runwayRef: '11R/29L'
    });
    // Keep the real height function and bounds, but omit unrelated object meshes.
    const terrain = createTerrain({
        ...world,
        data: { ...world.data, airfield: '', features: [] },
        runways: []
    });
    const ground = /** @type {Mesh} */ (terrain.children[0]);
    terrain.updateMatrixWorld(true);
    const a = world.runway.points[0],
        b = world.runway.points[world.runway.points.length - 1];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / length,
        dz = (b[1] - a[1]) / length;
    const ray = new Raycaster();
    // The distant sand backdrop must not hide roads/buildings on low terrain
    // inside the map, or cover the sloping transition shoulders outside it.
    const outer = terrain.children[1];
    for (const [x, z] of [
        [world.spawn.x, world.spawn.z + 4000],
        [world.spawn.x, world.spawn.z + 6000],
        [world.minX + 10, world.maxZ - 10],
        [world.maxX - 10, world.minZ + 10],
        [world.spawn.x, world.maxZ + 1500]
    ]) {
        ray.set(new Vector3(x, 5000, z), new Vector3(0, -1, 0));
        expect(ray.intersectObject(outer, false)).toHaveLength(0);
        const visible = ray.intersectObject(terrain, true)[0];
        expect(visible).toBeTruthy();
        expect(visible.object).not.toBe(outer);
    }
    // The actual terrain south of Mehrabad lies below the old backdrop height.
    expect(world.height(world.spawn.x, world.spawn.z + 6000)).toBeLessThan(-35);
    ray.set(
        new Vector3(world.maxX + 4000, 5000, world.spawn.z),
        new Vector3(0, -1, 0)
    );
    const distant = ray.intersectObject(outer, false)[0];
    expect(distant).toBeTruthy();
    expect(distant.point.y).toBeCloseTo(-35);
    for (const distance of [0, 30, 80, 150, length / 2, length - 30]) {
        for (const offset of [-30, 0, 30]) {
            const x = a[0] + dx * distance - dz * offset,
                z = a[1] + dz * distance + dx * offset;
            ray.set(new Vector3(x, 100, z), new Vector3(0, -1, 0));
            const hit = ray.intersectObject(ground, false)[0];
            expect(hit).toBeTruthy();
            expect(Math.abs(hit.point.y - world.height(x, z))).toBeLessThan(
                0.001
            );
        }
    }
    terrain.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            if (material instanceof MeshLambertMaterial)
                material.map?.dispose();
            material.dispose();
        }
    });
});

test('terrain and edge aprons follow an off-center geographic rectangle', () => {
    const world = createGeography(
        {
            origin: [35.675, 51.38],
            bounds: [35.53, 51.1, 35.85, 51.66],
            features: [
                {
                    id: 'runway',
                    name: 'Test runway',
                    kind: 'runway',
                    points: [
                        [0, 0],
                        [1000, 0]
                    ],
                    holes: [],
                    line: true,
                    surface: 'asphalt',
                    width: 30
                }
            ],
            places: [],
            timestamp: ''
        },
        { size: 2, values: [100, 200, 300, 400] }
    );
    const terrain = createTerrain(world);
    const ground = /** @type {Mesh} */ (terrain.children[0]).geometry;
    ground.computeBoundingBox();
    if (!ground.boundingBox) throw new Error('Missing ground bounds');
    expect(ground.boundingBox.min.x).toBeCloseTo(world.minX, 2);
    expect(ground.boundingBox.max.x).toBeCloseTo(world.maxX, 2);
    expect(ground.boundingBox.min.z).toBeCloseTo(world.minZ, 2);
    expect(ground.boundingBox.max.z).toBeCloseTo(world.maxZ, 2);
    const vertices = ground.attributes.position;
    for (const i of [0, 256, vertices.count - 1]) {
        expect(vertices.getY(i)).toBeCloseTo(
            world.height(vertices.getX(i), vertices.getZ(i)),
            2
        );
    }
    const westApron = /** @type {Mesh} */ (terrain.children[2]).geometry;
    westApron.computeBoundingBox();
    if (!westApron.boundingBox) throw new Error('Missing apron bounds');
    expect(westApron.boundingBox.max.x).toBeCloseTo(world.minX, 2);
    expect(
        (westApron.boundingBox.min.z + westApron.boundingBox.max.z) / 2
    ).toBeCloseTo((world.minZ + world.maxZ) / 2, 2);
    terrain.traverse((o) => {
        if (!(o instanceof Mesh)) return;
        o.geometry.dispose();
        for (const material of Array.isArray(o.material)
            ? o.material
            : [o.material]) {
            if (material instanceof MeshLambertMaterial)
                material.map?.dispose();
            material.dispose();
        }
    });
});
