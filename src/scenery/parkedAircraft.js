import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createAirplane } from '../aircraft/airplane.js';
import { createMirage } from '../aircraft/mirage.js';
import { createStaticAircraft } from '../aircraft/staticAircraft.js';
import {
    isMehrabad,
    MEHRABAD_MILITARY_APRONS,
    MEHRABAD_CIVIL_APRONS
} from './mehrabad.js';
import { inFeature, segmentDistance } from './geography.js';
import { createRenderedHeight } from './groundDetail.js';

/** @typedef {{x:number,z:number,yaw:number,apron:string,radius:number}} ParkingSpot */
/** Deterministic fictional parking, constrained by the cached apron geometry.
 * @param {import('./geography.js').Geography} world @param {boolean} jet
 * @param {{radius?:number,limit?:number,perApron?:number,occupied?:ParkingSpot[],slope?:number,apronIds?:string[]}} [options]
 * @returns {ParkingSpot[]} */
export function planAircraftParking(world, jet, options = {}) {
    const radius = options.radius ?? (jet ? 8.5 : 7);
    const perApron = options.perApron ?? 4;
    const boundaries = world.data.features.filter((f) => f.kind === 'airfield');
    const aprons = world.data.features.filter(
        (f) =>
            f.aeroway === 'apron' &&
            !f.line &&
            (!options.apronIds || options.apronIds.includes(f.id)) &&
            boundaries.some((b) => inFeature(f.points[0][0], f.points[0][1], b))
    );
    const routes = world.data.features.filter(
        (f) => f.line && ['runway', 'taxiway', 'road'].includes(f.kind)
    );
    const buildings = world.data.features
        .filter((f) => f.kind === 'building')
        .map((f) => ({
            f,
            minX: Math.min(...f.points.map((p) => p[0])) - radius - 2,
            maxX: Math.max(...f.points.map((p) => p[0])) + radius + 2,
            minZ: Math.min(...f.points.map((p) => p[1])) - radius - 2,
            maxZ: Math.max(...f.points.map((p) => p[1])) + radius + 2
        }));
    /** @type {ParkingSpot[]} */ const result = [];
    const distance = (
        /** @type {number} */ x,
        /** @type {number} */ z,
        /** @type {number[][]} */ points
    ) =>
        Math.min(
            ...points
                .slice(1)
                .map((p, i) => segmentDistance(x, z, points[i], p))
        );
    // Stable source ID ordering avoids changing the parking when unrelated data is added.
    for (const apron of aprons.sort((a, b) => a.id.localeCompare(b.id))) {
        const ring = apron.points;
        const edge = ring
            .slice(1)
            .map((p, i) => ({
                a: ring[i],
                b: p,
                length: Math.hypot(p[0] - ring[i][0], p[1] - ring[i][1])
            }))
            .sort((a, b) => b.length - a.length)[0];
        if (!edge || edge.length < radius * 2) continue;
        const ux = (edge.b[0] - edge.a[0]) / edge.length,
            uz = (edge.b[1] - edge.a[1]) / edge.length;
        const local = ring.map((p) => [
            (p[0] - edge.a[0]) * ux + (p[1] - edge.a[1]) * uz,
            -(p[0] - edge.a[0]) * uz + (p[1] - edge.a[1]) * ux
        ]);
        const minU = Math.min(...local.map((p) => p[0])),
            maxU = Math.max(...local.map((p) => p[0]));
        const minV = Math.min(...local.map((p) => p[1])),
            maxV = Math.max(...local.map((p) => p[1]));
        const minX = Math.min(...ring.map((p) => p[0])) - 100,
            maxX = Math.max(...ring.map((p) => p[0])) + 100;
        const minZ = Math.min(...ring.map((p) => p[1])) - 100,
            maxZ = Math.max(...ring.map((p) => p[1])) + 100;
        const nearRoutes = routes.filter(
            (f) =>
                Math.max(...f.points.map((p) => p[0])) >= minX &&
                Math.min(...f.points.map((p) => p[0])) <= maxX &&
                Math.max(...f.points.map((p) => p[1])) >= minZ &&
                Math.min(...f.points.map((p) => p[1])) <= maxZ
        );
        let count = 0;
        for (
            let v = minV + radius + 1;
            v <= maxV - radius - 1 && count < perApron;
            v += radius * 2 + 5
        ) {
            for (
                let u = minU + radius + 1;
                u <= maxU - radius - 1 && count < perApron;
                u += radius * 2 + 5
            ) {
                const x = edge.a[0] + u * ux - v * uz,
                    z = edge.a[1] + u * uz + v * ux;
                if (
                    !inFeature(x, z, apron) ||
                    [ring, ...apron.holes].some(
                        (r) => distance(x, z, r) < radius + 0.5
                    )
                )
                    continue;
                if (Math.hypot(x - world.spawn.x, z - world.spawn.z) < 100)
                    continue;
                if (
                    [...result, ...(options.occupied || [])].some(
                        (p) =>
                            Math.hypot(x - p.x, z - p.z) < radius + p.radius + 4
                    )
                )
                    continue;
                if (
                    nearRoutes.some(
                        (f) =>
                            distance(x, z, f.points) <
                            (f.width || (f.kind === 'runway' ? 50 : 12)) / 2 +
                                radius +
                                3
                    )
                )
                    continue;
                if (
                    buildings.some(
                        (b) =>
                            x >= b.minX &&
                            x <= b.maxX &&
                            z >= b.minZ &&
                            z <= b.maxZ &&
                            (inFeature(x, z, b.f) ||
                                distance(x, z, b.f.points) < radius + 2)
                    )
                )
                    continue;
                const heights = Array.from({ length: 8 }, (_, i) =>
                    world.height(
                        x + Math.cos((i * Math.PI) / 4) * radius,
                        z + Math.sin((i * Math.PI) / 4) * radius
                    )
                );
                if (
                    Math.max(...heights) - Math.min(...heights) >
                    (options.slope ?? 0.65)
                )
                    continue;
                result.push({
                    x,
                    z,
                    yaw: Math.atan2(-uz, ux),
                    apron: apron.id,
                    radius
                });
                count++;
                if (result.length >= (options.limit ?? (jet ? 16 : 20)))
                    return result;
            }
        }
    }
    return result;
}

/** Bake the existing game aircraft into one opaque, static, vertex-colored mesh.
 * Engines are off, gear is down, no flight simulation or audio instances.
 * @param {boolean|'f5'|'airliner'} jet */
export function parkedGeometry(jet) {
    const { airplane } =
        typeof jet === 'string'
            ? createStaticAircraft(jet)
            : jet
              ? createMirage()
              : createAirplane();
    airplane.updateMatrixWorld(true);
    /** @type {THREE.BufferGeometry[]} */
    const parts = [];
    airplane.traverseVisible((o) => {
        if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
        const geometry = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
        geometry.applyMatrix4(o.matrixWorld);
        for (const name of Object.keys(geometry.attributes))
            if (!['position', 'normal'].includes(name))
                geometry.deleteAttribute(name);
        const material = /** @type {THREE.MeshStandardMaterial} */ (o.material);
        const color = material.color || new THREE.Color(0xffffff);
        const colors = new Float32Array(
            geometry.getAttribute('position').count * 3
        );
        for (let i = 0; i < colors.length; i += 3)
            colors.set([color.r, color.g, color.b], i);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(geometry);
    });
    const merged = mergeGeometries(parts);
    if (!merged) throw new Error('Unable to bake parked aircraft');
    parts.forEach((g) => g.dispose());
    const geometries = new Set(),
        materials = new Set(),
        textures = new Set();
    airplane.traverse((o) => {
        if (o instanceof THREE.Mesh) {
            geometries.add(o.geometry);
            for (const m of Array.isArray(o.material)
                ? o.material
                : [o.material]) {
                materials.add(m);
                for (const value of Object.values(m))
                    if (value instanceof THREE.Texture) textures.add(value);
            }
        }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    merged.computeBoundingBox();
    merged.translate(0, -(merged.boundingBox?.min.y || 0) + 0.06, 0);
    return merged;
}
/** @param {import('./geography.js').Geography} world */
export function createParkedAircraft(world) {
    if (isMehrabad(world.data)) {
        const military = planAircraftParking(world, true, {
            radius: 8.5,
            limit: 8,
            perApron: 8,
            apronIds: MEHRABAD_MILITARY_APRONS
        });
        const civil = planAircraftParking(world, false, {
            radius: 24,
            limit: 6,
            perApron: 3,
            occupied: military,
            apronIds: MEHRABAD_CIVIL_APRONS
        });
        const fleets = [
            createFleet(world, military, 'f5'),
            createFleet(world, civil, 'airliner')
        ];
        const group = new THREE.Group();
        group.name = 'Mehrabad · fictional static aircraft';
        fleets.forEach((fleet) => group.add(fleet.group));
        return {
            group,
            spots: [...military, ...civil],
            /** @param {THREE.Vector3} position @param {string} quality */
            update(position, quality) {
                fleets.forEach((fleet) => fleet.update(position, quality));
            }
        };
    }
    const jet = Boolean(world.data.airfield?.includes('LFSX'));
    const spots = planAircraftParking(world, jet);
    return createFleet(world, spots, jet);
}

/** @param {import('./geography.js').Geography} world @param {ParkingSpot[]} spots
 * @param {boolean|'f5'|'airliner'} jet */
function createFleet(world, spots, jet) {
    const group = new THREE.Group();
    group.name = 'Parked aircraft · fictional apron scenery';
    if (!spots.length) return { group, spots, update() {} };
    const geometry = parkedGeometry(jet);
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
    });
    const height = createRenderedHeight(world);
    /** @type {Map<string,ParkingSpot[]>} */ const cells = new Map();
    for (const p of spots) {
        const key = `${Math.floor(p.x / 500)},${Math.floor(p.z / 500)}`;
        const cell = cells.get(key) || [];
        cell.push(p);
        cells.set(key, cell);
    }
    const transform = new THREE.Object3D();
    for (const cell of cells.values()) {
        const mesh = new THREE.InstancedMesh(geometry, material, cell.length);
        mesh.name =
            jet === 'f5'
                ? 'Parked F-5 Tiger'
                : jet === 'airliner'
                  ? 'Parked Airbus-style airliner'
                  : jet
                    ? 'Parked Mirage 2000'
                    : 'Parked light aircraft';
        cell.forEach((p, i) => {
            transform.position.set(p.x, height(p.x, p.z) + 0.08, p.z);
            transform.rotation.set(0, p.yaw, 0);
            transform.updateMatrix();
            mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    return {
        group,
        spots,
        /** @param {THREE.Vector3} position @param {string} quality */
        update(position, quality) {
            const range =
                quality === 'low' ? 700 : quality === 'balanced' ? 1400 : 2500;
            for (const child of group.children) {
                const mesh = /** @type {THREE.InstancedMesh} */ (child);
                const b = mesh.boundingSphere;
                if (b)
                    mesh.visible =
                        b.center.distanceTo(position) - b.radius < range;
            }
        }
    };
}
