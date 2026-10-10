import { azadiContains, createAzadiTowerGeometry } from './azadiTower.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createUniversitySetting } from './universitySetting.js';
import { createAzadiSquare } from './azadiSquare.js';

// Positions: retained OSM footprints where present; supplemental monument
// coordinates and architectural references are documented in data/tehran/README.md.
export const TEHRAN_LANDMARKS = [
    {
        id: 'azadi',
        name: 'Azadi Tower',
        lat: 35.69974,
        lon: 51.33803,
        height: 45,
        width: 24,
        depth: 63
    },
    {
        id: 'milad',
        name: 'Milad Tower',
        lat: 35.74484,
        lon: 51.3753,
        height: 435,
        width: 24,
        depth: 24
    },
    {
        id: 'golestan',
        name: 'Golestan Palace',
        source: 'w312398800-0',
        lat: 35.68044,
        lon: 51.42062,
        height: 15,
        width: 130,
        depth: 27
    },
    {
        id: 'tabiat',
        name: 'Tabiat Bridge',
        source: 'r6695059-0',
        lat: 35.7542,
        lon: 51.4205,
        height: 40,
        width: 280,
        depth: 24
    },
    {
        id: 'saadabad',
        name: 'Saadabad · White Palace',
        source: 'w375114161-0',
        lat: 35.81354,
        lon: 51.42413,
        height: 16,
        width: 53,
        depth: 55
    },
    {
        id: 'niavaran',
        name: 'Niavaran Palace',
        source: 'w330356348-0',
        lat: 35.81173,
        lon: 51.47322,
        height: 14,
        width: 65,
        depth: 82
    },
    {
        id: 'university',
        name: 'Tehran University Gate',
        lat: 35.7012,
        lon: 51.3958,
        height: 11.5,
        width: 36,
        depth: 8
    },
    {
        id: 'stadium',
        name: 'Azadi Stadium',
        source: 'r1640944-0',
        lat: 35.72454,
        lon: 51.27552,
        height: 40,
        width: 241,
        depth: 275
    }
];

/** @type {WeakMap<object, (typeof TEHRAN_LANDMARKS[number] & {x:number,z:number})[]>} */
const placements = new WeakMap();
/** @param {import('./geography.js').GeoData} data */
export function tehranLandmarks(data) {
    if (!data.airfield?.includes('OIII')) return [];
    const cached = placements.get(data);
    if (cached) return cached;
    const result = TEHRAN_LANDMARKS.map((landmark) => {
        const feature = data.features.find((f) => f.id === landmark.source);
        const points = feature?.points.slice(0, -1);
        const x = points
            ? (Math.min(...points.map((p) => p[0])) +
                  Math.max(...points.map((p) => p[0]))) /
              2
            : (landmark.lon - data.origin[1]) *
              111320 *
              Math.cos((data.origin[0] * Math.PI) / 180);
        const z = points
            ? (Math.min(...points.map((p) => p[1])) +
                  Math.max(...points.map((p) => p[1]))) /
              2
            : (data.origin[0] - landmark.lat) * 111320;
        return { ...landmark, x, z };
    });
    placements.set(data, result);
    return result;
}

/** Simplified collision envelopes preserve the large arch and bridge openings.
 * @param {string} id @param {number} x @param {number} y @param {number} z */
export function landmarkContains(id, x, y, z) {
    const spec = TEHRAN_LANDMARKS.find((l) => l.id === id);
    if (!spec || y < 0 || y > spec.height) return false;
    if (id === 'azadi') return azadiContains(x, y, z);
    if (id === 'milad')
        return (
            Math.hypot(x, z) < (y > 350 ? 3.2 : y > 280 ? 28 : 16 - y * 0.03)
        );
    if (id === 'stadium') {
        const r = Math.hypot(x, z / 1.18);
        return r > 72 && r < 112 && y < (r - 72) * 1.06 + 2;
    }
    if (id === 'tabiat')
        return (
            Math.abs(x) < 140 &&
            Math.abs(z) < 10 &&
            (y >= 26 ||
                (Math.abs(z) < 3 &&
                    [-92, 0, 92].some((p) => Math.abs(x - p) < 3)))
        );
    if (id === 'university') {
        if (Math.abs(z) > 2.6) return false;
        for (const spine of [-9.3, 9.3]) {
            for (const direction of [-1, 1]) {
                const anchor = spine + direction * 0.65;
                const v = (z + 2.4) / 4.8;
                if (
                    Math.abs(x - anchor) < 0.42 &&
                    y < universityPageHeight(0, v)
                )
                    return true;
                const u = ((x - anchor) * direction) / 7.6;
                if (
                    u >= 0 &&
                    u <= 1 &&
                    Math.abs(y - universityPageHeight(u, (z + 2.4) / 4.8)) < 0.4
                )
                    return true;
                if (
                    Math.abs(x - anchor - direction * 7.6) < 0.35 &&
                    z < -2.05 &&
                    y < 3.2
                )
                    return true;
            }
        }
        return false;
    }
    return Math.abs(x) < spec.width / 2 && Math.abs(z) < spec.depth / 2;
}

/** Opposing front/rear arches make a saddle-shaped concrete page.
 * @param {number} u @param {number} v */
function universityPageHeight(u, v) {
    // Quarter-ellipse: vertical tangent into a substantial pier, level at the lip.
    const rise = Math.sqrt(Math.max(0, 1 - (1 - u) ** 2));
    const rearRise = Math.sqrt(Math.max(0, 1 - u ** 2));
    return (
        (3.2 + 8.1 * rearRise) * (1 - v) +
        (4.5 + 5.3 * rise) * v +
        0.8 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v)
    );
}

/** Stylized planted bridge approaches, shared by drawing and collision.
 * @param {number} x @param {number} z @param {number} base @param {number} ground */
export function tabiatApproachHeight(x, z, base, ground) {
    const a = Math.abs(x);
    if (a < 125 || a > 300 || Math.abs(z) > 77) return ground;
    const smooth = (/** @type {number} */ t) => {
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    };
    const blend =
        smooth((a - 125) / 15) *
        (1 - smooth((a - 140) / 160)) *
        (1 - smooth((Math.abs(z) - 12) / 65));
    return ground + Math.max(0, base + 34.75 - ground) * blend;
}

/** Original stylized meshes; all small parts are baked into one draw per landmark.
 * @param {string} id */
export function landmarkGeometry(id) {
    if (id === 'azadi') return createAzadiTowerGeometry();
    /** @type {THREE.BufferGeometry[]} */ const parts = [];
    const transform = new THREE.Matrix4();
    /** @param {THREE.BufferGeometry} geometry @param {number} color @param {number[]} [position] */
    const add = (geometry, color, position = [0, 0, 0]) => {
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        if (g !== geometry) geometry.dispose();
        g.translate(.../** @type {[number,number,number]} */ (position));
        const c = new THREE.Color(color),
            colors = [];
        for (let i = 0; i < g.attributes.position.count; i++)
            colors.push(c.r, c.g, c.b);
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.deleteAttribute('uv');
        parts.push(g);
    };
    /** @param {number[]} size @param {number[]} position @param {number} color */
    const box = (size, position, color) =>
        add(
            new THREE.BoxGeometry(
                .../** @type {[number,number,number]} */ (size)
            ),
            color,
            position
        );
    /** @param {number[]} a @param {number[]} b @param {number} radius @param {number} color */
    const beam = (a, b, radius, color) => {
        const start = new THREE.Vector3(...a),
            end = new THREE.Vector3(...b),
            delta = end.clone().sub(start);
        transform.compose(
            start.add(end).multiplyScalar(0.5),
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                delta.clone().normalize()
            ),
            new THREE.Vector3(1, 1, 1)
        );
        add(
            new THREE.CylinderGeometry(
                radius,
                radius,
                delta.length(),
                5
            ).applyMatrix4(transform),
            color
        );
    };
    const stone = 0xeee7d4,
        joint = 0xaca998,
        glass = 0x35575e,
        tile = 0x348b93;
    if (id === 'milad') {
        add(new THREE.CylinderGeometry(7, 16, 300, 8), 0xbdb8aa, [0, 150, 0]);
        add(new THREE.CylinderGeometry(28, 12, 26, 12), stone, [0, 292, 0]);
        add(new THREE.CylinderGeometry(20, 28, 34, 12), glass, [0, 322, 0]);
        for (let y = 307; y <= 339; y += 5)
            add(
                new THREE.CylinderGeometry(
                    27 - (y - 307) * 0.2,
                    27 - (y - 307) * 0.2,
                    1.2,
                    24
                ),
                stone,
                [0, y, 0]
            );
        add(new THREE.CylinderGeometry(7, 20, 12, 12), stone, [0, 345, 0]);
        add(
            new THREE.CylinderGeometry(0.5, 3.2, 84, 12),
            0xc2c7c8,
            [0, 393, 0]
        );
    } else if (id === 'tabiat') {
        for (const y of [27, 34]) box([280, 1.3, 17], [0, y, 0], 0xa6926b);
        for (const z of [-9, 9]) {
            for (const y of [26, 35, 40])
                beam([-140, y, z], [140, y, z], 0.45, 0x778d85);
            for (let x = -140; x < 140; x += 14) {
                beam([x, 26, z], [x + 14, 40, z], 0.35, 0x778d85);
                beam([x, 40, z], [x + 14, 26, z], 0.35, 0x778d85);
            }
        }
        for (const x of [-92, 0, 92])
            for (const side of [-1, 1])
                beam([x, 0, 0], [x + side * 19, 27, side * 7], 1.4, 0x8b9588);
    } else if (id === 'stadium') {
        for (let tier = 0; tier < 10; tier++) {
            const ring = new THREE.RingGeometry(
                72 + tier * 3.6,
                76 + tier * 3.6,
                96
            );
            ring.rotateX(-Math.PI / 2);
            ring.scale(1, 1, 1.18);
            add(ring, tier % 2 ? 0xc4c1b2 : 0x97a9ab, [0, tier * 3.8 + 1, 0]);
        }
        box([70, 0.25, 108], [0, 0.2, 0], 0x547746);
        for (const x of [-35, 35]) box([0.45, 0.3, 108], [x, 0.4, 0], stone);
        for (const z of [-54, 0, 54]) box([70, 0.3, 0.45], [0, 0.4, z], stone);
        for (const x of [-108, 108])
            for (const z of [-110, 110]) {
                beam([x, 0, z], [x, 48, z], 0.8, joint);
                box([12, 4, 2], [x, 48, z], stone);
            }
    } else if (id === 'university') {
        // Two open books, each with independently mirrored thin concrete pages.
        // Warping across depth avoids the solid extruded pointed-arch silhouette.
        for (const spine of [-9.3, 9.3]) {
            for (const direction of [-1, 1]) {
                const anchor = spine + direction * 0.65;
                const page = new THREE.BoxGeometry(1, 0.28, 1, 40, 1, 24);
                const p = page.attributes.position;
                for (let i = 0; i < p.count; i++) {
                    const u = 1 - Math.cos(((p.getX(i) + 0.5) * Math.PI) / 2),
                        v = p.getZ(i) + 0.5;
                    p.setXYZ(
                        i,
                        anchor + direction * 7.6 * u,
                        universityPageHeight(u, v) + p.getY(i),
                        -2.4 + 4.8 * v
                    );
                }
                // Reflection reverses the triangle winding, not just normals.
                if (direction < 0 && page.index) {
                    const index = page.index;
                    for (let i = 0; i < index.count; i += 3) {
                        const a = index.getX(i);
                        index.setX(i, index.getX(i + 2));
                        index.setX(i + 2, a);
                    }
                }
                page.computeVertexNormals();
                add(page, stone);
                box(
                    [0.65, 3.2, 0.65],
                    [anchor + direction * 7.6, 1.6, -2.4],
                    stone
                );
                const pier = new THREE.BoxGeometry(0.8, 1, 4.8, 1, 1, 24);
                const pp = pier.attributes.position;
                for (let i = 0; i < pp.count; i++)
                    pp.setY(
                        i,
                        (pp.getY(i) + 0.5) *
                            universityPageHeight(0, (pp.getZ(i) + 2.4) / 4.8)
                    );
                pier.computeVertexNormals();
                add(pier, stone, [anchor, 0, 0]);
            }
            box([2.3, 0.55, 2.1], [spine, 0.3, 2], joint);
        }
        box([38, 0.25, 10], [0, 0.08, 0], 0xb4b1a3);
        for (let x = -18; x <= 18; x += 0.6)
            box([0.055, 2.6, 0.055], [x, 1.5, -1.8], 0x344343);
        for (const y of [0.6, 2.65])
            box([36, 0.075, 0.075], [0, y, -1.8], 0x344343);
    } else {
        const spec = TEHRAN_LANDMARKS.find((l) => l.id === id);
        if (!spec) throw new Error(`Unknown landmark: ${id}`);
        const { width: w, depth: d, height: h } = spec;
        box([w, h, d], [0, h / 2, 0], id === 'golestan' ? 0xcba66b : stone);
        box([w + 2, 1, d + 2], [0, h, 0], 0xb6ac98);
        for (const side of [-1, 1])
            for (let x = -w / 2 + 3; x < w / 2; x += 4) {
                for (let y = 4; y < h - 1; y += 5)
                    box([1.8, 3, 0.2], [x, y, side * (d / 2 + 0.12)], glass);
                if (id === 'golestan')
                    box(
                        [2.7, 1.2, 0.25],
                        [x, h - 2, side * (d / 2 + 0.15)],
                        tile
                    );
            }
        for (let x = -10; x <= 10; x += 4)
            add(new THREE.CylinderGeometry(0.55, 0.7, h - 1, 8), stone, [
                x,
                h / 2,
                d / 2 + 3
            ]);
        box([26, 1.5, 8], [0, h, d / 2 + 1], stone);
    }
    const geometry = mergeGeometries(parts);
    parts.forEach((p) => p.dispose());
    geometry.computeBoundingSphere();
    return geometry;
}

/** @param {import('./geography.js').Geography} world */
export function createTehranLandmarks(world) {
    const group = new THREE.Group();
    group.name = 'Tehran landmarks';
    for (const landmark of tehranLandmarks(world.data)) {
        const mesh = new THREE.Mesh(
            landmarkGeometry(landmark.id),
            new THREE.MeshLambertMaterial({
                vertexColors: true,
                side: THREE.DoubleSide
            })
        );
        mesh.name = landmark.name;
        mesh.position.set(
            landmark.x,
            world.height(landmark.x, landmark.z) + 0.1,
            landmark.z
        );
        mesh.castShadow = mesh.receiveShadow = true;
        group.add(mesh);
        if (landmark.id === 'azadi') group.add(createAzadiSquare(world));
        if (landmark.id === 'university')
            group.add(createUniversitySetting(world, landmark));
        if (landmark.id === 'tabiat') {
            // Both ends land on planted banks with paths descending to the parks.
            for (const side of [-1, 1]) {
                const bank = new THREE.PlaneGeometry(175, 154, 70, 44);
                bank.rotateX(-Math.PI / 2);
                const p = bank.attributes.position,
                    colors = [];
                for (let i = 0; i < p.count; i++) {
                    const x = side * (212.5 + p.getX(i)),
                        z = p.getZ(i);
                    const ground = world.height(landmark.x + x, landmark.z + z);
                    const y = tabiatApproachHeight(
                        x,
                        z,
                        mesh.position.y,
                        ground
                    );
                    p.setXYZ(i, landmark.x + x, y + 0.12, landmark.z + z);
                    const path = Math.abs(z) < 5.5 && Math.abs(x) >= 139;
                    const c = new THREE.Color(path ? 0xc6b18d : 0x66834b);
                    const edge = Math.min(
                        Math.abs(x) - 125,
                        300 - Math.abs(x),
                        77 - Math.abs(z)
                    );
                    colors.push(
                        c.r,
                        c.g,
                        c.b,
                        Math.min(1, Math.max(0, edge / 16))
                    );
                }
                bank.setAttribute(
                    'color',
                    new THREE.Float32BufferAttribute(colors, 4)
                );
                bank.computeVertexNormals();
                const approach = new THREE.Mesh(
                    bank,
                    new THREE.MeshLambertMaterial({
                        vertexColors: true,
                        transparent: true,
                        depthWrite: false,
                        side: THREE.DoubleSide
                    })
                );
                approach.name = `Tabiat planted park approach ${side}`;
                approach.receiveShadow = true;
                group.add(approach);
            }
        }
    }
    return group;
}
