import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planAircraftParking } from './parkedAircraft.js';
import { createRenderedHeight } from './groundDetail.js';

/** Small, original procedural scenery models. Local +X is forward.
 * @param {string} type @param {boolean} military */
export function createVehicleGeometry(type, military) {
    /** @type {THREE.BufferGeometry[]} */
    const parts = [];
    const paint = military ? 0x66705a : 0xd9dfdc;
    /** @param {THREE.BufferGeometry} geometry @param {number[]} position @param {number} color */
    function part(geometry, position, color) {
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        if (g !== geometry) geometry.dispose();
        g.translate(.../** @type {[number,number,number]} */ (position));
        g.deleteAttribute('uv');
        const c = new THREE.Color(color);
        const colors = new Float32Array(g.getAttribute('position').count * 3);
        for (let i = 0; i < colors.length; i += 3)
            colors.set([c.r, c.g, c.b], i);
        g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        parts.push(g);
    }
    /** @param {number[]} size @param {number[]} pos @param {number} color */
    const box = (size, pos, color) =>
        part(
            new THREE.BoxGeometry(
                .../** @type {[number,number,number]} */ (size)
            ),
            pos,
            color
        );
    const tanker = type === 'fuel truck';
    const tug = type === 'tug';
    const length = tanker ? 6.4 : tug ? 3.2 : 4.6;
    const width = tanker ? 2.25 : 1.9;
    const wheel = tug ? 0.3 : 0.4;
    box([length, 0.32, width], [0, 0.65, 0], 0x323a3b);
    box(
        [length - 0.2, tug ? 0.5 : 0.6, width],
        [0, tug ? 0.9 : 1.02, 0],
        paint
    );
    const cabX = length / 2 - 0.85;
    box(
        [1.45, tug ? 0.7 : 1.05, width - 0.1],
        [cabX, tug ? 1.4 : 1.7, 0],
        paint
    );
    box(
        [0.04, tug ? 0.4 : 0.65, width - 0.3],
        [cabX + 0.74, tug ? 1.48 : 1.8, 0],
        0x274c5a
    );
    for (const side of [-1, 1]) {
        box(
            [0.95, tug ? 0.4 : 0.65, 0.025],
            [cabX + 0.12, tug ? 1.48 : 1.8, side * (width / 2 - 0.035)],
            0x274c5a
        );
        for (const x of [-length / 2 + 0.8, length / 2 - 0.8]) {
            const tire = new THREE.CylinderGeometry(wheel, wheel, 0.22, 12);
            tire.rotateX(Math.PI / 2);
            part(tire, [x, wheel, (side * width) / 2], 0x20272a);
            const hub = new THREE.CylinderGeometry(
                wheel * 0.45,
                wheel * 0.45,
                0.24,
                10
            );
            hub.rotateX(Math.PI / 2);
            part(hub, [x, wheel, side * (width / 2 + 0.02)], 0x939b97);
        }
        box(
            [0.06, 0.18, 0.3],
            [length / 2 + 0.02, 0.88, side * width * 0.33],
            0xffedb0
        );
        box(
            [0.06, 0.16, 0.22],
            [-length / 2 - 0.02, 0.88, side * width * 0.33],
            0xb73b2b
        );
    }
    if (tanker) {
        const tank = new THREE.CylinderGeometry(0.87, 0.87, 3.8, 16);
        tank.rotateZ(Math.PI / 2);
        part(tank, [-0.85, 1.68, 0], military ? 0x828875 : 0xb9c4c4);
        box([2.8, 0.1, 0.3], [-0.85, 2.6, 0], 0x454d49);
        box([0.4, 0.14, 0.5], [-0.8, 2.69, 0], paint);
    } else if (!tug) {
        box([2.7, 1.25, width - 0.08], [-0.8, 1.65, 0], paint);
        for (const side of [-1, 1])
            box(
                [2.65, 0.12, 0.03],
                [-0.8, 1.4, side * (width / 2 - 0.025)],
                military ? 0xb6ab74 : 0x315b85
            );
        box([0.03, 1.0, 0.025], [-2.16, 1.65, 0], 0x687474);
    } else {
        box([0.7, 0.18, 0.32], [-length / 2 - 0.3, 0.48, 0], 0x8c9590);
    }
    box([0.25, 0.18, 0.25], [cabX, tug ? 1.85 : 2.32, 0], 0xe7a332);
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    if (!merged) throw new Error('Unable to build service vehicle');
    merged.computeBoundingBox();
    return merged;
}

/** @param {import('./geography.js').Geography} world
 * @param {import('./parkedAircraft.js').ParkingSpot[]} occupied */
export function createServiceVehicles(world, occupied) {
    const military = Boolean(world.data.airfield?.includes('LFSX'));
    const spots = planAircraftParking(world, military, {
        radius: 4,
        limit: military ? 12 : 6,
        perApron: 2,
        occupied,
        slope: 0.3
    });
    const types = military
        ? ['fuel truck', 'tug', 'van']
        : ['van', 'tug', 'fuel truck'];
    const group = new THREE.Group();
    group.name = 'Fictional parked service vehicles';
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const height = createRenderedHeight(world);
    const transform = new THREE.Object3D();
    for (const [index, type] of types.entries()) {
        const selected = spots.filter((_, i) => i % types.length === index);
        if (!selected.length) continue;
        const geometry = createVehicleGeometry(type, military);
        // Small fleet: one static draw call per vehicle type.
        const mesh = new THREE.InstancedMesh(
            geometry,
            material,
            selected.length
        );
        mesh.name = `Parked ${type}`;
        selected.forEach((p, i) => {
            transform.position.set(p.x, height(p.x, p.z) + 0.05, p.z);
            transform.rotation.set(0, p.yaw, 0);
            transform.updateMatrix();
            mesh.setMatrixAt(i, transform.matrix);
        });
        mesh.computeBoundingSphere();
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    if (!spots.length) material.dispose();
    return {
        group,
        spots,
        /** @param {THREE.Vector3} position @param {string} quality */
        update(position, quality) {
            const range =
                quality === 'low' ? 500 : quality === 'balanced' ? 1000 : 1800;
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
