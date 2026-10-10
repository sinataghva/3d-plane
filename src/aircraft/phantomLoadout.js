import * as THREE from 'three';

// +X forward. Each triplet has two shoulder stores and one lower store.
const triplet = [
    [0, -0.18],
    [-0.34, 0.13],
    [0.34, 0.13]
];
const wingRacks = [-1, 1].flatMap((side) => [
    { x: -2.5, z: side * 3.65, rows: [-3.65, -1.35], name: 'Outer MER' },
    { x: 0.05, z: side * 2.3, rows: [0.05], name: 'Inner TER' }
]);
const centerRack = {
    x: -1.5,
    z: 0,
    rows: [-2.65, -0.35],
    name: 'Centerline MER'
};
export const BOMB_RACKS = [...wingRacks, centerRack];
// Alternate mirrored stores so each successive pair restores lateral balance.
const wingMounts = [-3.65, -1.35, 0.05].flatMap((x) =>
    triplet.flatMap(([offset, y]) =>
        [-1, 1].map((side) => [
            x,
            y,
            side * ((x === 0.05 ? 2.3 : 3.65) + offset)
        ])
    )
);
// A shallower center triplet clears both the belly and the runway.
const centerMounts = centerRack.rows.flatMap((x) => [
    [x, -0.24, 0],
    [x, -0.1, -0.34],
    [x, -0.1, 0.34]
]);
export const BOMB_MOUNTS = [...wingMounts, ...centerMounts];
export const BOMB_CAPACITY = BOMB_MOUNTS.length;

/** Fixed pylons and ejector racks; bombs use BOMB_MOUNTS. */
export function createPhantomRacks() {
    const group = new THREE.Group();
    group.name = 'F-4E three MER and two TER racks';
    const material = new THREE.MeshStandardMaterial({
        color: 0xb7bdb3,
        roughness: 0.65
    });
    /** @type {THREE.BufferGeometry[]} */
    const geometries = [];
    /** @param {THREE.BufferGeometry} geometry @param {number[]} position @param {string} name */
    function add(geometry, position, name) {
        geometries.push(geometry);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position[0], position[1], position[2]);
        mesh.name = name;
        group.add(mesh);
        return mesh;
    }
    for (const rack of BOMB_RACKS) {
        const yOffset = rack.z === 0 ? -0.2 : 0;
        add(
            new THREE.BoxGeometry(1.1, 0.35, 0.13),
            [rack.x, 0.49 + yOffset, rack.z],
            `${rack.name} pylon`
        );
        add(
            new THREE.BoxGeometry(
                rack.rows.length === 2 ? 3.1 : 0.9,
                0.14,
                0.16
            ),
            [rack.x, 0.25 + yOffset, rack.z],
            rack.name
        );
        for (const x of rack.rows) {
            add(
                new THREE.BoxGeometry(0.4, 0.09, 0.64),
                [x, 0.28 + yOffset, rack.z],
                'Shoulder ejectors'
            );
            add(
                new THREE.BoxGeometry(0.4, 0.23, 0.1),
                [x, 0.06 + yOffset, rack.z],
                'Lower ejector'
            );
        }
    }
    return {
        group,
        dispose() {
            geometries.forEach((geometry) => geometry.dispose());
            material.dispose();
        }
    };
}
