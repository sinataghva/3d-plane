import * as THREE from 'three';
import { createAzadiFlags } from './azadiFlags.js';
import { inRing, segmentDistance } from './geography.js';
import {
    clipToTerrain,
    createRenderedHeight,
    roadRibbon
} from './groundDetail.js';

/** Source-aligned square detail. No generated oval or radial garden pattern.
 * @param {import('./geography.js').Geography} world */
export function createAzadiSquare(world) {
    const group = new THREE.Group();
    group.name = 'Azadi Square · mapped landscape';
    if (!world.data.airfield?.includes('OIII')) return group;
    const ids = new Set([
        'w544306451-0',
        'w545099122-0',
        'w545099229-0',
        'w545099230-0',
        'w545098816-0',
        'w545098817-0',
        'w545300305-0',
        'w545300307-0',
        'w545300123-0',
        'w545300308-0'
    ]);
    const features = new Map(
        world.data.features.filter((f) => ids.has(f.id)).map((f) => [f.id, f])
    );
    const boundary = features.get('w544306451-0');
    if (!boundary) return group;
    const height = createRenderedHeight(world);
    const ring = boundary.points;
    // Four separate mapped garden islands form the outer square. Keeping
    // their contours separate leaves both traffic rings and radial roads open.
    const outerRings = [
        'w545300305-0',
        'w545300307-0',
        'w545300123-0',
        'w545300308-0'
    ].flatMap((id) => {
        const feature = features.get(id);
        return feature ? [feature.points] : [];
    });
    const rings = [ring, ...outerRings];
    // Independently simplified cached ways can miss the outer boundary by
    // up to three metres. Allow those joins without extending the lawn contour.
    const regions = rings.map((points, i) => ({
        tolerance: i === 0 ? 0.2 : 3,
        points,
        minX: Math.min(...points.map((p) => p[0])) - (i === 0 ? 0.2 : 3),
        maxX: Math.max(...points.map((p) => p[0])) + (i === 0 ? 0.2 : 3),
        minZ: Math.min(...points.map((p) => p[1])) - (i === 0 ? 0.2 : 3),
        maxZ: Math.max(...points.map((p) => p[1])) + (i === 0 ? 0.2 : 3)
    }));
    const contains = regions.map(
        ({ points, minX, maxX, minZ, maxZ, tolerance }) =>
            (/** @type {number[]} */ p) =>
                p[0] >= minX &&
                p[0] <= maxX &&
                p[1] >= minZ &&
                p[1] <= maxZ &&
                (inRing(p[0], p[1], points) ||
                    points
                        .slice(1)
                        .some(
                            (b, i) =>
                                segmentDistance(p[0], p[1], points[i], b) <
                                tolerance
                        ))
    );
    const paths = world.data.features.filter(
        (f) =>
            f.kind === 'road' &&
            f.class === 'footway' &&
            f.points.length > 1 &&
            contains.some((inside) => f.points.every(inside))
    );
    const fountains = world.data.features.filter(
        (f) =>
            f.kind === 'water' &&
            f.id.startsWith('r7787479-') &&
            contains.some((inside) => f.points.every(inside))
    );
    /** @type {Record<string, number[]>} */
    const buffers = { lawn: [], paving: [], coping: [], water: [] };
    /** Triangulate concave mapped contours before splitting at terrain edges.
     * @param {string} kind @param {number[][]} points @param {number} offset
     * @param {number|undefined} [level] */
    function surface(kind, points, offset, level) {
        const contour = points.filter(
            (p, i) =>
                !i ||
                Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) >
                    0.001
        );
        if (contour.length < 3) return;
        const triangles = THREE.ShapeUtils.triangulateShape(
            contour.map(([x, z]) => new THREE.Vector2(x, z)),
            []
        );
        for (const triangle of triangles)
            for (const [x, z] of clipToTerrain(
                triangle.map((i) => contour[i]),
                world
            ))
                buffers[kind].push(x, (level ?? height(x, z)) + offset, z);
    }
    for (const contour of rings) surface('lawn', contour, 0.12);
    // The mapped scalloped central walk bounds the paved apron. Closing its
    // eastern gap joins the two mapped sides of the east approach.
    const apron = features.get('w545099122-0');
    if (apron) surface('paving', apron.points, 0.15);
    // Fill between paired walks flanking the fountain approach, using their
    // actual endpoints rather than a rectangle centered on the tower.
    for (const [a, b] of [
        ['w545099229-0', 'w545099230-0'],
        ['w545098816-0', 'w545098817-0']
    ]) {
        const left = features.get(a),
            right = features.get(b);
        if (left && right) {
            const start =
                a === 'w545098816-0' && apron
                    ? [apron.points[apron.points.length - 1]]
                    : [];
            const end = a === 'w545098816-0' && apron ? [apron.points[0]] : [];
            surface(
                'paving',
                [
                    ...start,
                    ...left.points,
                    ...[...right.points].reverse(),
                    ...end
                ],
                0.15
            );
        }
    }
    const ends = new Map();
    for (const path of paths) {
        for (const segment of roadRibbon(path.points, path.width || 2))
            surface('paving', segment.corners, 0.15);
        for (const p of [path.points[0], path.points.at(-1)]) {
            if (!p) continue;
            ends.set(`${p[0]},${p[1]}`, p);
        }
    }
    // Small circular joins close cracks where separate cached ways meet.
    for (const [x, z] of ends.values())
        surface(
            'paving',
            Array.from({ length: 10 }, (_, i) => [
                x + Math.cos((i * Math.PI) / 5),
                z + Math.sin((i * Math.PI) / 5)
            ]),
            0.15
        );
    for (const fountain of fountains) {
        // Each basin has a horizontal water plane, a raised stone coping, and
        // skirts down to the sloped ground. They do not flatten the terrain.
        const level = Math.max(
            ...fountain.points.map(([x, z]) => height(x, z))
        );
        surface('water', fountain.points, 0.23, level);
        for (const segment of roadRibbon(fountain.points, 0.55)) {
            surface('coping', segment.corners, 0.43, level);
            for (const [a, b] of [
                [segment.corners[0], segment.corners[1]],
                [segment.corners[2], segment.corners[3]]
            ]) {
                const lowA = height(a[0], a[1]) + 0.15,
                    lowB = height(b[0], b[1]) + 0.15;
                buffers.coping.push(
                    a[0],
                    lowA,
                    a[1],
                    b[0],
                    lowB,
                    b[1],
                    b[0],
                    level + 0.43,
                    b[1],
                    a[0],
                    lowA,
                    a[1],
                    b[0],
                    level + 0.43,
                    b[1],
                    a[0],
                    level + 0.43,
                    a[1]
                );
            }
        }
    }
    const colors = {
        lawn: 0x7d9b61,
        paving: 0xd3cbb8,
        coping: 0xc4b99f,
        water: 0x428e9c
    };
    for (const [kind, positions] of Object.entries(buffers)) {
        if (!positions.length) continue;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        );
        geometry.computeVertexNormals();
        const material = new THREE.MeshLambertMaterial({
            color: colors[/** @type {keyof typeof colors} */ (kind)],
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: kind === 'lawn' ? -1 : -2,
            polygonOffsetUnits: kind === 'lawn' ? -1 : -2
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `Azadi ${kind}`;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    // Restrained low planting along the perimeter, clear of the mapped paths.
    // Decorative placement; no claim of individual surveyed shrubs.
    const center = ring
        .slice(0, -1)
        .reduce(
            (c, p) => [
                c[0] + p[0] / (ring.length - 1),
                c[1] + p[1] / (ring.length - 1)
            ],
            [0, 0]
        );
    const spots = ring
        .slice(0, -1)
        .map((p) => {
            const dx = center[0] - p[0],
                dz = center[1] - p[1],
                length = Math.hypot(dx, dz);
            return [p[0] + (dx / length) * 5, p[1] + (dz / length) * 5];
        })
        .filter(([x, z]) =>
            paths.every((f) =>
                f.points
                    .slice(1)
                    .every(
                        (b, i) => segmentDistance(x, z, f.points[i], b) > 2.5
                    )
            )
        )
        .slice(0, 24);
    if (spots.length) {
        const shrubs = new THREE.InstancedMesh(
            new THREE.SphereGeometry(1, 8, 5),
            new THREE.MeshLambertMaterial({ color: 0x526d42 }),
            spots.length
        );
        shrubs.name = 'Azadi perimeter shrubs';
        const matrix = new THREE.Matrix4();
        spots.forEach(([x, z], i) => {
            matrix
                .makeScale(1.25, 0.7, 1.25)
                .setPosition(x, height(x, z) + 0.65, z);
            shrubs.setMatrixAt(i, matrix);
        });
        shrubs.castShadow = shrubs.receiveShadow = true;
        group.add(shrubs);
    }
    group.add(createAzadiFlags(world));
    group.userData.summary = {
        outerGardens: outerRings.length,
        paths: paths.length,
        fountains: fountains.length,
        shrubs: spots.length
    };
    return group;
}
