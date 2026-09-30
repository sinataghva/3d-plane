import * as THREE from 'three';
import {
    getRoadStructures,
    prepareRoadStructureTile
} from './roadStructures.js';
import { subtractConvex } from './scenerySurfaces.js';

const TILE = 500;
export const STRUCTURE_PRESETS = {
    low: { radius: 0, tiles: 0 },
    balanced: { radius: 1700, tiles: 24 },
    high: { radius: 2400, tiles: 48 }
};
const owners = new WeakMap();
/** @param {import('./geography.js').GeoFeature} feature @param {number} x @param {number} z */
export function structureSurfaceReady(feature, x, z) {
    return Boolean(
        owners
            .get(feature)
            ?.has(`${Math.floor(x / TILE)},${Math.floor(z / TILE)}`)
    );
}

/** Replace only terrain triangles containing currently loaded entrance cuts.
 * Unloaded cells keep their original index entries and allocate no patch mesh.
 * @param {import('./geography.js').Geography} world @param {any} data
 * @param {THREE.Mesh<THREE.BufferGeometry,THREE.MeshLambertMaterial>} terrain */
function terrainCuts(world, data, terrain) {
    const geometry = terrain.geometry,
        index = /** @type {THREE.BufferAttribute} */ (geometry.index);
    if (!index) throw new Error('Terrain must be indexed');
    const original = index.array.slice(),
        positions = geometry.getAttribute('position');
    index.setUsage(THREE.DynamicDrawUsage);
    /** @type {Map<number,{signature:string,mesh:THREE.Mesh}>} */
    const patches = new Map();
    const sx = world.width / 256,
        sz = world.depth / 256;
    /** @param {any[]} portals */
    function update(portals) {
        /** @type {Map<number,{masks:number[][][],ids:number[]}>} */
        const cells = new Map();
        for (const portal of portals) {
            if (!portal.recessed) continue;
            for (const mask of portal.cuts || []) {
                const xs = mask.map((/** @type {number[]} */ p) => p[0]),
                    zs = mask.map((/** @type {number[]} */ p) => p[1]);
                for (
                    let x = Math.max(
                        0,
                        Math.floor((Math.min(...xs) - world.minX) / sx)
                    );
                    x <=
                    Math.min(
                        255,
                        Math.floor((Math.max(...xs) - world.minX) / sx)
                    );
                    x++
                )
                    for (
                        let z = Math.max(
                            0,
                            Math.floor((Math.min(...zs) - world.minZ) / sz)
                        );
                        z <=
                        Math.min(
                            255,
                            Math.floor((Math.max(...zs) - world.minZ) / sz)
                        );
                        z++
                    ) {
                        const cell = z * 256 + x;
                        if (!cells.has(cell))
                            cells.set(cell, { masks: [], ids: [] });
                        cells.get(cell)?.masks.push(mask);
                        cells.get(cell)?.ids.push(portal.streamId);
                    }
            }
        }
        let changed = false;
        for (const [cell, patch] of patches)
            if (!cells.has(cell)) {
                for (let j = 0; j < 6; j++)
                    index.setX(cell * 6 + j, original[cell * 6 + j]);
                index.addUpdateRange(cell * 6, 6);
                changed = true;
                terrain.remove(patch.mesh);
                patch.mesh.geometry.dispose();
                patches.delete(cell);
            }
        for (const [cell, value] of cells) {
            const signature = value.ids.join(',');
            if (patches.get(cell)?.signature === signature) continue;
            const old = patches.get(cell);
            if (old) {
                terrain.remove(old.mesh);
                old.mesh.geometry.dispose();
            }
            const vertices = [],
                uvs = [];
            for (let t = 0; t < 2; t++) {
                let pieces = [
                    Array.from({ length: 3 }, (_, j) => {
                        const id = original[cell * 6 + t * 3 + j];
                        return [positions.getX(id), positions.getZ(id)];
                    })
                ];
                for (const mask of value.masks)
                    pieces = pieces.flatMap((p) => subtractConvex(p, mask));
                for (const polygon of pieces)
                    for (let j = 1; j < polygon.length - 1; j++)
                        for (const [x, z] of [
                            polygon[0],
                            polygon[j],
                            polygon[j + 1]
                        ]) {
                            vertices.push(x, data.height(x, z), z);
                            uvs.push(
                                (x - world.minX) / world.width,
                                1 - (z - world.minZ) / world.depth
                            );
                        }
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(vertices, 3)
            );
            geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, terrain.material);
            mesh.name = 'Nearby tunnel terrain patch';
            mesh.receiveShadow = true;
            terrain.add(mesh);
            patches.set(cell, { signature, mesh });
            for (let j = 0; j < 6; j++) index.setX(cell * 6 + j, 0);
            index.addUpdateRange(cell * 6, 6);
            changed = true;
        }
        if (changed) index.needsUpdate = true;
    }
    return { update, dispose: () => update([]), count: () => patches.size };
}

/** Nearby, bounded structure preparation; at most one completed tile per frame. No meshes at creation.
 * @param {import('./geography.js').Geography} world */
export function createRoadStructures(world) {
    const shared = getRoadStructures(world),
        group = new THREE.Group();
    group.name = 'Nearby Tehran road structures';
    /** @type {Map<string,any>} */ const cells = new Map();
    /** @type {Map<string,Set<import('./geography.js').GeoFeature>>} */ const roads =
        new Map();
    /** @type {Set<string>} */ const active = new Set();
    /** @param {number} x @param {number} z */
    const cellAt = (x, z) => {
        const key = `${x},${z}`;
        if (!cells.has(key))
            cells.set(key, {
                key,
                x: (x + 0.5) * TILE,
                z: (z + 0.5) * TILE,
                features: new Set(),
                portals: [],
                roads: []
            });
        return cells.get(key);
    };
    for (const profile of shared.profiles.values()) {
        const points = profile.feature.points;
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1],
                b = points[i];
            for (
                let x = Math.floor((Math.min(a[0], b[0]) - 20) / TILE);
                x <= Math.floor((Math.max(a[0], b[0]) + 20) / TILE);
                x++
            )
                for (
                    let z = Math.floor((Math.min(a[1], b[1]) - 20) / TILE);
                    z <= Math.floor((Math.max(a[1], b[1]) + 20) / TILE);
                    z++
                )
                    cellAt(x, z).features.add(profile.feature.id);
        }
        owners.set(profile.feature, active);
    }
    for (const f of shared.roads)
        if (shared.approaches.has(f.id)) {
            owners.set(f, active);
            for (let i = 1; i < f.points.length; i++) {
                const a = f.points[i - 1],
                    b = f.points[i];
                for (
                    let x = Math.floor((Math.min(a[0], b[0]) - 20) / TILE);
                    x <= Math.floor((Math.max(a[0], b[0]) + 20) / TILE);
                    x++
                )
                    for (
                        let z = Math.floor((Math.min(a[1], b[1]) - 20) / TILE);
                        z <= Math.floor((Math.max(a[1], b[1]) + 20) / TILE);
                        z++
                    )
                        cellAt(x, z).features.add(f.id);
            }
        }
    shared.portals.forEach((/** @type {any} */ p, /** @type {number} */ i) => {
        p.streamId = i;
        cellAt(
            Math.floor(p.point[0] / TILE),
            Math.floor(p.point[1] / TILE)
        ).portals.push(p);
    });
    // Road references only, for local pillar clearance checks; no city-wide mesh arrays.
    if (cells.size)
        for (const f of shared.roads)
            for (let i = 1; i < f.points.length; i++) {
                const a = f.points[i - 1],
                    b = f.points[i];
                for (
                    let x = Math.floor((Math.min(a[0], b[0]) - 40) / TILE);
                    x <= Math.floor((Math.max(a[0], b[0]) + 40) / TILE);
                    x++
                )
                    for (
                        let z = Math.floor((Math.min(a[1], b[1]) - 40) / TILE);
                        z <= Math.floor((Math.max(a[1], b[1]) + 40) / TILE);
                        z++
                    ) {
                        const key = `${x},${z}`;
                        if (!cells.has(key)) continue;
                        if (!roads.has(key)) roads.set(key, new Set());
                        roads.get(key)?.add(f);
                    }
            }
    for (const cell of cells.values()) {
        cell.roads = [...(roads.get(cell.key) || [])];
        cell.y = shared.height(cell.x, cell.z);
    }
    /** @type {Map<string,{built:ReturnType<typeof import('./roadStructures.js').buildRoadStructureTile>,last:number}>} */ const cache =
        new Map();
    /** @type {ReturnType<typeof terrainCuts>|undefined} */ let cuts;
    let tick = 0,
        dirty = false,
        disposed = false,
        builds = 0,
        maxBuildMs = 0,
        maxWorkMs = 0,
        lastQuality = '';
    /** @type {{key:string,iterator:ReturnType<typeof prepareRoadStructureTile>}|null} */
    let preparation = null;
    /** @type {string[]} */ let wanted = [];
    const syncCuts = () =>
        cuts?.update([...active].flatMap((k) => cells.get(k).portals));
    return {
        group,
        data: shared,
        /** @param {THREE.Mesh<THREE.BufferGeometry,THREE.MeshLambertMaterial>} mesh */
        attachTerrain(mesh) {
            if (!cells.size) return;
            cuts = terrainCuts(
                world,
                {
                    ...shared,
                    width: (/** @type {any} */ f) =>
                        Math.max(2, Math.min(28, f.width || 8))
                },
                mesh
            );
        },
        consumeSurfaceChange() {
            if (dirty && wanted.every((k) => active.has(k))) {
                dirty = false;
                return true;
            }
            return false;
        },
        stats() {
            const list = [...cache.values()].map((x) => x.built.stats());
            return {
                structureBridges: list.reduce(
                    (n, s) => n + s.structureBridges,
                    0
                ),
                structurePortals: [...active].reduce(
                    (n, k) => n + cells.get(k).portals.length,
                    0
                ),
                structureTriangles: list.reduce(
                    (n, s) => n + s.structureTriangles,
                    0
                ),
                structureBytes: list.reduce((n, s) => n + s.structureBytes, 0),
                structureBatches: list.reduce(
                    (n, s) => n + s.structureBatches,
                    0
                ),
                structureResidentTiles: cache.size,
                structureActiveTiles: active.size,
                structurePending: wanted.filter((k) => !active.has(k)).length,
                structureBuilds: builds,
                structureMaxBuildMs: maxBuildMs,
                structureMaxWorkMs: maxWorkMs,
                structureTerrainPatches: cuts?.count() || 0
            };
        },
        /** @param {{x:number,y:number,z:number}} position @param {string} quality */
        update(position, quality) {
            if (disposed) return;
            const workStarted = performance.now();
            tick++;
            const settings =
                STRUCTURE_PRESETS[
                    /** @type {keyof typeof STRUCTURE_PRESETS} */ (quality)
                ] || STRUCTURE_PRESETS.high;
            if (tick % 15 === 1 || quality !== lastQuality)
                wanted = settings.radius
                    ? [...cells.values()]
                          .map((c) => ({
                              cell: c,
                              distance: Math.hypot(
                                  Math.max(0, Math.abs(position.x - c.x) - 250),
                                  Math.max(0, Math.abs(position.z - c.z) - 250),
                                  Math.max(0, Math.abs(position.y - c.y) - 60)
                              )
                          }))
                          .filter((c) => c.distance < settings.radius)
                          .sort((a, b) => a.distance - b.distance)
                          .slice(0, settings.tiles)
                          .map((c) => c.cell.key)
                    : [];
            lastQuality = quality;
            let changed = false;
            for (const key of active)
                if (!wanted.includes(key)) {
                    const old = cache.get(key);
                    if (old) old.built.group.visible = false;
                    active.delete(key);
                    changed = true;
                }
            for (const key of wanted) {
                const entry = cache.get(key);
                if (entry) {
                    entry.last = tick;
                    if (!active.has(key)) {
                        entry.built.group.visible = true;
                        active.add(key);
                        changed = true;
                    }
                }
            }
            if (preparation && !wanted.includes(preparation.key)) {
                preparation.iterator.return(/** @type {never} */ (undefined));
                preparation = null;
            }
            const missing = wanted.find((k) => !cache.has(k));
            if (!preparation && missing)
                preparation = {
                    key: missing,
                    iterator: prepareRoadStructureTile(
                        world,
                        cells.get(missing),
                        shared
                    )
                };
            if (preparation) {
                const started = performance.now();
                // Cooperative budget: an individual feature/finalization step may
                // exceed it. Never expose a partial tile or its terrain cuts.
                do {
                    const step = preparation.iterator.next();
                    if (step.done) {
                        const { key } = preparation,
                            built = step.value;
                        cache.set(key, { built, last: tick });
                        group.add(built.group);
                        active.add(key);
                        builds++;
                        preparation = null;
                        changed = true;
                        break;
                    }
                } while (performance.now() - started < 2);
                maxBuildMs = Math.max(maxBuildMs, performance.now() - started);
            }
            for (const key of active)
                cache.get(key)?.built.group.traverse((o) => {
                    if (o instanceof THREE.Mesh)
                        o.castShadow =
                            Math.hypot(
                                position.x - cells.get(key).x,
                                position.y - cells.get(key).y,
                                position.z - cells.get(key).z
                            ) < 1750;
                });
            while (cache.size > 64) {
                const candidate = [...cache]
                    .filter(([k]) => !active.has(k))
                    .sort((a, b) => a[1].last - b[1].last)[0];
                if (!candidate) break;
                group.remove(candidate[1].built.group);
                candidate[1].built.dispose();
                cache.delete(candidate[0]);
            }
            if (changed) {
                syncCuts();
                dirty = true;
            }
            maxWorkMs = Math.max(maxWorkMs, performance.now() - workStarted);
        },
        dispose() {
            disposed = true;
            preparation?.iterator.return(/** @type {never} */ (undefined));
            preparation = null;
            active.clear();
            cuts?.dispose();
            for (const entry of cache.values()) entry.built.dispose();
            cache.clear();
            group.clear();
        }
    };
}
