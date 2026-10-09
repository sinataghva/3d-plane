import * as THREE from 'three';

// +X forward. Each triplet has two shoulder stores and one lower store.
const triplet = [
    [0, -0.18],
    [-0.34, 0.13],
    [0.34, 0.13]
];
export const BOMB_RACKS = [-1, 1].flatMap((side) => [
    { x: -2.5, z: side * 3.65, rows: [-3.65, -1.35], name: 'Outer MER' },
    { x: 0.05, z: side * 2.3, rows: [0.05], name: 'Inner TER' }
]);
// Alternate mirrored stores so each successive pair restores lateral balance.
export const BOMB_MOUNTS = [-3.65, -1.35, 0.05].flatMap((x) =>
    triplet.flatMap(([offset, y]) =>
        [-1, 1].map((side) => [
            x,
            y,
            side * ((x === 0.05 ? 2.3 : 3.65) + offset)
        ])
    )
);
export const BOMB_CAPACITY = BOMB_MOUNTS.length;

/** Fixed pylons, ejector racks and centerline tank; bombs use BOMB_MOUNTS. */
export function createPhantomRacks() {
    const group = new THREE.Group();
    group.name = 'F-4E MER TER racks and centerline tank';
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
        add(
            new THREE.BoxGeometry(1.1, 0.35, 0.13),
            [rack.x, 0.49, rack.z],
            `${rack.name} pylon`
        );
        add(
            new THREE.BoxGeometry(
                rack.rows.length === 2 ? 3.1 : 0.9,
                0.14,
                0.16
            ),
            [rack.x, 0.25, rack.z],
            rack.name
        );
        for (const x of rack.rows) {
            add(
                new THREE.BoxGeometry(0.4, 0.09, 0.64),
                [x, 0.28, rack.z],
                'Shoulder ejectors'
            );
            add(
                new THREE.BoxGeometry(0.4, 0.23, 0.1),
                [x, 0.06, rack.z],
                'Lower ejector'
            );
        }
    }
    add(
        new THREE.BoxGeometry(2.2, 0.18, 0.16),
        [-1.5, 0.27, 0],
        'Tank attachment'
    );
    const tank = new THREE.SphereGeometry(1, 24, 12);
    tank.scale(3.25, 0.38, 0.38);
    add(tank, [-1.5, -0.02, 0], 'Centerline fuel tank');
    return {
        group,
        dispose() {
            geometries.forEach((geometry) => geometry.dispose());
            material.dispose();
        }
    };
}
