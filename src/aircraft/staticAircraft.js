import * as THREE from 'three';

/** Low-poly scenery only: +X nose, gear down, no animated/flight parts.
 * Deliberately generic airline paint; dimensions are visual approximations.
 * @param {'f5'|'airliner'} type */
export function createStaticAircraft(type) {
    const airplane = new THREE.Group();
    const civil = type === 'airliner';
    const body = civil ? 0xe9e8df : 0xa49b73;
    const trim = civil ? 0x25677d : 0x58644a;
    /** @param {THREE.BufferGeometry} geometry @param {number} color
     * @param {number[]} position @param {number[]} [rotation] */
    function part(geometry, color, position, rotation = [0, 0, 0]) {
        const mesh = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color })
        );
        mesh.position.set(position[0], position[1], position[2]);
        mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
        airplane.add(mesh);
        return mesh;
    }
    /** @param {number[]} size @param {number[]} position @param {number} color */
    const box = (size, position, color) =>
        part(new THREE.BoxGeometry(...size), color, position);
    /** @param {number[][]} points @param {number} color */
    function foil(points, color) {
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        for (let i = 1; i < points.length - 1; i++)
            vertices.push(...points[0], ...points[i], ...points[i + 1]);
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.computeVertexNormals();
        part(geometry, color, [0, 0, 0]);
    }
    const length = civil ? 37 : 14.5,
        radius = civil ? 1.85 : 0.65;
    const y = civil ? 3.9 : 1.65;
    part(
        new THREE.CylinderGeometry(radius * 0.8, radius, length * 0.66, 12),
        body,
        [0, y, 0],
        [0, 0, -Math.PI / 2]
    );
    if (civil)
        part(new THREE.SphereGeometry(1, 16, 10), body, [
            length * 0.32,
            y,
            0
        ]).scale.set(4.2, radius * 0.8, radius * 0.8);
    else
        part(
            new THREE.ConeGeometry(radius * 0.8, length * 0.22, 12),
            0x343b38,
            [length * 0.44, y, 0],
            [0, 0, -Math.PI / 2]
        );
    part(
        new THREE.ConeGeometry(radius, length * 0.18, 12),
        body,
        [-length * 0.42, y, 0],
        [0, 0, Math.PI / 2]
    );
    part(new THREE.SphereGeometry(1, 12, 8), 0x294453, [
        length * 0.25,
        y + radius * 0.73,
        0
    ]).scale.set(civil ? 1.65 : 1.55, civil ? 0.72 : 0.57, civil ? 1.38 : 0.55);
    for (const side of [-1, 1]) {
        const span = civil ? 17 : 4.1;
        foil(
            [
                [length * 0.12, y, side * 0.4],
                [-length * 0.14, y + 0.25, side * span],
                [-length * 0.26, y + 0.25, side * span],
                [-length * 0.17, y, side * 0.4]
            ],
            body
        );
        foil(
            [
                [-length * 0.29, y + 0.35, side * 0.4],
                [-length * 0.43, y + 0.55, side * span * 0.42],
                [-length * 0.51, y + 0.55, side * span * 0.42],
                [-length * 0.47, y + 0.35, side * 0.4]
            ],
            trim
        );
        if (civil) {
            box([2.3, 1.1, 0.35], [-0.5, 2.65, side * 6.5], trim);
            part(
                new THREE.CylinderGeometry(0.95, 1.05, 3.5, 12),
                body,
                [0, 1.8, side * 6.5],
                [0, 0, -Math.PI / 2]
            );
            part(
                new THREE.CircleGeometry(0.8, 12),
                0x263139,
                [1.76, 1.8, side * 6.5],
                [0, Math.PI / 2, 0]
            );
            for (let x = -10; x <= 10; x += 1.2)
                box([0.45, 0.42, 0.06], [x, 4.65, side * 1.69], 0x294453);
        } else {
            box([2.2, 0.65, 0.5], [1.1, y, side * 0.72], trim);
            part(
                new THREE.CylinderGeometry(0.27, 0.34, 0.8, 10),
                0x30322d,
                [-5.1, y, side * 0.34],
                [0, 0, -Math.PI / 2]
            );
            part(
                new THREE.CircleGeometry(0.22, 10),
                0x111713,
                [-5.51, y, side * 0.34],
                [0, -Math.PI / 2, 0]
            );
        }
    }
    foil(
        [
            [-length * 0.25, y, 0],
            [-length * 0.4, y + (civil ? 7 : 2.8), 0],
            [-length * 0.49, y + (civil ? 7 : 2.8), 0],
            [-length * 0.48, y, 0]
        ],
        trim
    );
    for (const [x, z] of [
        [length * 0.27, 0],
        [-length * 0.1, civil ? 2.4 : 1.2],
        [-length * 0.1, civil ? -2.4 : -1.2]
    ]) {
        const wheel = civil ? 0.52 : 0.28;
        box([0.14, y, 0.14], [x, y / 2, z], 0x818b8e);
        part(
            new THREE.CylinderGeometry(wheel, wheel, civil ? 0.45 : 0.2, 10),
            0x202526,
            [x, wheel, z],
            [Math.PI / 2, 0, 0]
        );
    }
    return { airplane };
}
