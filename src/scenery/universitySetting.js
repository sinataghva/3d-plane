import * as THREE from 'three';
import { createRenderedHeight, clipToTerrain } from './groundDetail.js';

/** Local decorative campus planting; the cached Enghelab road stays untouched.
 * @param {import('./geography.js').Geography} world
 * @param {{x:number,z:number}} gate */
export function createUniversitySetting(world, gate) {
    const group = new THREE.Group();
    group.name = 'University campus trees and entrance gardens';
    const renderedHeight = createRenderedHeight(world);
    const height = (/** @type {number} */ x, /** @type {number} */ z) =>
        Math.max(world.height(x, z), renderedHeight(x, z));
    const ground = new THREE.PlaneGeometry(150, 110, 50, 44);
    ground.rotateX(-Math.PI / 2);
    const p = ground.attributes.position,
        colors = [];
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
            z = p.getZ(i) - 63;
        p.setXYZ(
            i,
            gate.x + x,
            height(gate.x + x, gate.z + z) + 0.16,
            gate.z + z
        );
        const path = Math.abs(x) < 5 || Math.abs(z + 20) < 3;
        const c = new THREE.Color(path ? 0xc1bba8 : 0x657d48);
        const edge = Math.min(75 - Math.abs(x), -8 - z, z + 118);
        colors.push(c.r, c.g, c.b, Math.min(1, Math.max(0, edge / 8)));
    }
    ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    ground.computeVertexNormals();
    const garden = new THREE.Mesh(
        ground,
        new THREE.MeshLambertMaterial({
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    garden.receiveShadow = true;
    group.add(garden);
    // Existing cached central BRT alignment, clipped to the entrance context.
    const busway = world.data.features.find((f) => f.id === 'w1339845018-0');
    if (busway) {
        const [a, b] = busway.points;
        const start = gate.x - 200,
            end = gate.x + 200;
        const zAt = (/** @type {number} */ x) =>
            a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]);
        const triangles = clipToTerrain(
            [
                [start, zAt(start) + 2.75],
                [end, zAt(end) + 2.75],
                [end, zAt(end) - 2.75],
                [start, zAt(start) - 2.75]
            ],
            world
        );
        const road = new THREE.BufferGeometry();
        road.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
                triangles.flatMap(([x, z]) => [
                    x,
                    renderedHeight(x, z) + 0.09,
                    z
                ]),
                3
            )
        );
        road.computeVertexNormals();
        const lane = new THREE.Mesh(
            road,
            new THREE.MeshLambertMaterial({
                color: 0x845f56,
                side: THREE.DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                polygonOffsetUnits: -4
            })
        );
        lane.name = 'Enghelab central bus corridor';
        lane.receiveShadow = true;
        group.add(lane);
    }
    const spots = [];
    for (let row = 0; row < 6; row++)
        for (const side of [-1, 1])
            for (const offset of [24, 43, 65]) {
                const x =
                        gate.x +
                        side * (offset + Math.sin(row * 2 + offset) * 2),
                    z = gate.z - 14 - row * 17;
                if (world.obstacle(x, z, world.height(x, z) + 2) === 'building')
                    continue;
                spots.push({
                    x,
                    z,
                    y: height(x, z),
                    scale: 0.9 + 0.15 * Math.sin(offset + row)
                });
            }
    const trunks = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.28, 0.45, 6, 7),
        new THREE.MeshLambertMaterial({ color: 0x786348 }),
        spots.length
    );
    const crowns = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(1, 1),
        new THREE.MeshLambertMaterial({ color: 0xffffff }),
        spots.length
    );
    const dummy = new THREE.Object3D();
    spots.forEach((s, i) => {
        dummy.position.set(s.x, s.y + 3 * s.scale, s.z);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.y = s.y + 8 * s.scale;
        dummy.scale.set(4.3 * s.scale, 5.3 * s.scale, 4.1 * s.scale);
        dummy.rotation.y = i * 1.7;
        dummy.updateMatrix();
        crowns.setMatrixAt(i, dummy.matrix);
        crowns.setColorAt(i, new THREE.Color(i % 3 ? 0x3e6338 : 0x567749));
    });
    trunks.name = 'Campus tree trunks';
    crowns.name = 'Campus broadleaf trees';
    trunks.castShadow = crowns.castShadow = true;
    trunks.receiveShadow = crowns.receiveShadow = true;
    group.add(trunks, crowns);
    return group;
}
