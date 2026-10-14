import { azadiLayout } from './azadiLayout.js';
import { subtractConvex } from './scenerySurfaces.js';
import * as THREE from 'three';
import { createAzadiFlags } from './azadiFlags.js';
import { segmentDistance } from './geography.js';
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
    const layout = azadiLayout(world);
    if (!layout) return group;
    const { features, ring, rings, outerRings, paths, fountains } = layout;
    const height = createRenderedHeight(world);
    // Cut basin footprints out of paving and grass rather than stacking water
    // centimetres above solid surfaces (unstable at distant camera angles).
    const waterMasks = fountains.flatMap((f) =>
        THREE.ShapeUtils.triangulateShape(
            f.points.map(([x, z]) => new THREE.Vector2(x, z)),
            []
        ).map((tri) => tri.map((i) => f.points[i]))
    );
    /** @type {Record<string, number[]>} */
    const buffers = { lawn: [], paving: [], coping: [], water: [] };
    /** Ignore touching/disjoint convex pieces before subtraction, avoiding
     * fragmentation along extended edges of paths outside the lawn piece.
     * @param {number[][]} a @param {number[][]} b */
    function overlaps(a, b) {
        for (const poly of [a, b])
            for (let i = 0; i < poly.length; i++) {
                const p = poly[i],
                    q = poly[(i + 1) % poly.length];
                const nx = -(q[1] - p[1]),
                    nz = q[0] - p[0];
                if (Math.hypot(nx, nz) < 1e-8) continue;
                const pa = a.map((v) => v[0] * nx + v[1] * nz),
                    pb = b.map((v) => v[0] * nx + v[1] * nz);
                if (
                    Math.max(...pa) <= Math.min(...pb) + 1e-7 ||
                    Math.max(...pb) <= Math.min(...pa) + 1e-7
                )
                    return false;
            }
        return true;
    }
    /** @type {number[][][]} */
    const pavingMasks = [];
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
        for (const triangle of triangles) {
            const clipped = clipToTerrain(
                triangle.map((i) => contour[i]),
                world
            );
            for (let i = 0; i < clipped.length; i += 3) {
                const tri = clipped.slice(i, i + 3);
                if (kind === 'paving') pavingMasks.push(tri);
                let pieces = [tri];
                if (kind === 'lawn' || kind === 'paving') {
                    const xs = tri.map((p) => p[0]),
                        zs = tri.map((p) => p[1]);
                    const minX = Math.min(...xs),
                        maxX = Math.max(...xs),
                        minZ = Math.min(...zs),
                        maxZ = Math.max(...zs);
                    for (const mask of kind === 'lawn'
                        ? [...pavingMasks, ...waterMasks]
                        : waterMasks) {
                        if (
                            mask.every((p) => p[0] <= minX) ||
                            mask.every((p) => p[0] >= maxX) ||
                            mask.every((p) => p[1] <= minZ) ||
                            mask.every((p) => p[1] >= maxZ)
                        )
                            continue;
                        pieces = pieces.flatMap((piece) =>
                            overlaps(piece, mask)
                                ? subtractConvex(piece, mask)
                                : [piece]
                        );
                    }
                }
                for (const piece of pieces.filter(
                    (poly) =>
                        Math.abs(
                            poly.reduce((sum, p, i) => {
                                const q = poly[(i + 1) % poly.length];
                                return sum + p[0] * q[1] - q[0] * p[1];
                            }, 0)
                        ) > 0.0001
                ))
                    for (let j = 1; j < piece.length - 1; j++)
                        for (const [x, z] of [piece[0], piece[j], piece[j + 1]])
                            buffers[kind].push(
                                x,
                                (level ?? height(x, z)) + offset,
                                z
                            );
            }
        }
    }
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
    for (const contour of rings) surface('lawn', contour, 0.12);
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
