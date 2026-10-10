import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared shell dimensions in metres; world X is the main passage axis.
 * These photo-informed profiles are a game approximation, not a survey.
 * @param {number} y */
export function azadiProfile(y) {
    const t = Math.max(0, 1 - y / 45);
    return {
        long: 8.7 + 22.8 * t ** 2.7,
        short: 7.8 + 4.2 * t ** 2,
        cross: y < 13 ? 4.6 * Math.sqrt(1 - y / 13) : 0
    };
}
// Four projecting faces with re-entrant corners and shallow V-shaped centres.
// A single contour defines the upper shell, terrace and parapet.
const CROWN = [
    [1, 0.6],
    [0.78, 0.78],
    [0.6, 1],
    [0, 0.84],
    [-0.6, 1],
    [-0.78, 0.78],
    [-1, 0.6],
    [-0.84, 0],
    [-1, -0.6],
    [-0.78, -0.78],
    [-0.6, -1],
    [0, -0.84],
    [0.6, -1],
    [0.78, -0.78],
    [1, -0.6],
    [0.84, 0]
];
/** @param {number} y */
function faceDepth(y) {
    return azadiProfile(y).short;
}
/** Radially map the rectangular lower shell into the indented crown.
 * @param {number} x @param {number} y @param {number} z */
function crownScale(x, y, z) {
    const p = azadiProfile(y),
        nx = x / p.short,
        nz = z / p.long;
    const radius = Math.max(Math.abs(nx), Math.abs(nz));
    if (radius < 1e-8 || y <= 18) return 1;
    const dx = nx / radius,
        dz = nz / radius;
    let hit = 1;
    for (let i = 0; i < CROWN.length; i++) {
        const a = CROWN[i],
            b = CROWN[(i + 1) % CROWN.length];
        const ex = b[0] - a[0],
            ez = b[1] - a[1],
            den = dx * ez - dz * ex;
        if (Math.abs(den) < 1e-9) continue;
        const t = (a[0] * ez - a[1] * ex) / den;
        const u = (a[0] * dz - a[1] * dx) / den;
        if (t > 0 && u >= -1e-8 && u <= 1 + 1e-8) hit = Math.min(hit, t);
    }
    const v = Math.min(1, (y - 18) / 18),
        blend = v * v * (3 - 2 * v);
    return 1 + (hit - 1) * blend;
}
/** @param {number} [y] */
export function azadiCrownContour(y = 43.8) {
    const p = azadiProfile(y);
    return CROWN.map(([x, z]) => [x * p.short, z * p.long]);
}
/** @param {number} x @param {number} z @param {number[]} a @param {number[]} b */
function edgeDistance(x, z, a, b) {
    const dx = b[0] - a[0],
        dz = b[1] - a[1];
    const t = Math.max(
        0,
        Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz))
    );
    return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
/** The pointed entrance blends into a lower rounded vault at mid-depth.
 * @param {number} y @param {number} u normalized transverse depth */
function opening(y, u) {
    const h = 23.5 + 8 * u * u,
        c = 1.4 * u * u;
    if (y >= h) return 0;
    const t = Math.min(1, Math.max(0, y / h));
    return 12 * (Math.sqrt((1 + c) ** 2 - (1 + 2 * c) * t * t) - c);
}
/** Equally spaced grooves follow one continuous pier section, including its
 * corner and side face. Spacing is measured after crown deformation, rather
 * than squeezing separate face grids into the corner. Above 36m the inner
 * boundary is fixed, so the upper grooves remain nearly vertical and parallel.
 * @param {number} y @param {number} fraction */
export function azadiGroovePoint(y, fraction) {
    const p = azadiProfile(y);
    const v = Math.min(1, Math.max(0, y / 36));
    const inner = Math.max(
        opening(y, 1) + 0.12,
        5.25 + 6.75 * (1 - v * v * (3 - 2 * v))
    );
    const section = [];
    for (let i = 0; i <= 48; i++) {
        const t = i / 24;
        const x = t <= 1 ? p.short : p.short + (p.cross - p.short) * (t - 1);
        const z = t <= 1 ? inner + (p.long - inner) * t : p.long;
        const scale = crownScale(x, y, z);
        section.push(new THREE.Vector3(x * scale, y, z * scale));
    }
    const lengths = [0];
    for (let i = 1; i < section.length; i++)
        lengths.push(lengths[i - 1] + section[i].distanceTo(section[i - 1]));
    const target =
        Math.max(0, Math.min(1, fraction)) * lengths[lengths.length - 1];
    for (let i = 1; i < section.length; i++) {
        if (lengths[i] < target) continue;
        const blend = (target - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
        return section[i - 1].clone().lerp(section[i], blend);
    }
    return section[section.length - 1];
}
/** @param {number} x @param {number} y @param {number} z */
export function azadiContains(x, y, z) {
    if (y < 0 || y > 45) return false;
    if (y >= 43.7) {
        const ring = azadiCrownContour();
        const scale = crownScale(x, 43.8, z),
            p = azadiProfile(43.8);
        return (
            (y <= 43.85 &&
                Math.abs(x) < p.short * scale &&
                Math.abs(z) < p.long * scale) ||
            (y < 44.7 &&
                ring.some(
                    (a, i) =>
                        edgeDistance(x, z, a, ring[(i + 1) % ring.length]) <
                        0.16
                )) ||
            (y >= 43.9 &&
                (x * x + z * z) / 2.2 ** 2 + ((y - 43.9) / 0.7) ** 2 < 1)
        );
    }
    const scale = crownScale(x, y, z);
    x /= scale;
    z /= scale;
    const p = azadiProfile(y),
        d = faceDepth(y),
        u = Math.abs(x) / d;
    return (
        u < 1 &&
        Math.abs(z) < p.long &&
        (y >= 23.5 + 8 * u * u || Math.abs(z) > opening(y, u)) &&
        (y >= 13 || u * p.short > p.cross)
    );
}

/** Original procedural marble shell, inset tile vault and crown, one draw call. */
export function createAzadiTowerGeometry() {
    /** @type {THREE.BufferGeometry[]} */
    const parts = [];
    const stone = 0xeee6d3,
        seam = 0xc4bdac,
        turquoise = 0x559c9b;
    /** @param {THREE.BufferGeometry} source @param {number} color @param {boolean} [shapeCrown] */
    function add(source, color, shapeCrown = true) {
        if (shapeCrown) {
            const p = source.attributes.position;
            for (let i = 0; i < p.count; i++) {
                const x = p.getX(i),
                    y = p.getY(i),
                    z = p.getZ(i),
                    scale = crownScale(x, y, z);
                p.setXYZ(i, x * scale, y, z * scale);
            }
            source.computeVertexNormals();
        }
        const g = source.index ? source.toNonIndexed() : source;
        if (g !== source) source.dispose();
        const c = new THREE.Color(color),
            colors = [];
        for (let i = 0; i < g.attributes.position.count; i++)
            colors.push(c.r, c.g, c.b);
        g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        g.deleteAttribute('uv');
        parts.push(g);
    }
    /** @param {(u:number,v:number)=>number[]} sample @param {number} nu @param {number} nv @param {number} color */
    function patch(sample, nu, nv, color) {
        const g = new THREE.PlaneGeometry(1, 1, nu, nv),
            p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const q = sample(p.getX(i) + 0.5, p.getY(i) + 0.5);
            p.setXYZ(i, q[0], q[1], q[2]);
        }
        g.computeVertexNormals();
        add(g, color);
    }
    /** @param {number[]} a @param {number[]} b @param {number} radius @param {number} color @param {boolean} [shapeCrown] */
    function beam(a, b, radius, color, shapeCrown = true) {
        const start = new THREE.Vector3(...a),
            end = new THREE.Vector3(...b);
        const delta = end.clone().sub(start);
        if (delta.lengthSq() < 1e-10) return;
        const g = new THREE.CylinderGeometry(
            radius,
            radius,
            delta.length(),
            4,
            1,
            true
        );
        g.applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                delta.normalize()
            )
        );
        g.translate(...start.add(end).multiplyScalar(0.5).toArray());
        add(g, color, shapeCrown);
    }
    /** @param {(t:number)=>number[]} sample @param {number} steps @param {number} radius @param {number} color */
    function curve(sample, steps, radius, color) {
        for (let i = 0; i < steps; i++)
            beam(sample(i / steps), sample((i + 1) / steps), radius, color);
    }
    for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
            const shellStart = parts.length;
            // Broad exterior, narrow exterior and the smaller crossing passage.
            patch(
                (u, v) => {
                    const y = v * 43.8,
                        p = azadiProfile(y),
                        a = opening(y, 1);
                    const z = a + (p.long - a) * u;
                    return [sx * faceDepth(y), y, sz * z];
                },
                10,
                40,
                stone
            );
            patch(
                (u, v) => {
                    const y = v * 43.8,
                        p = azadiProfile(y);
                    return [
                        sx * (p.cross + (p.short - p.cross) * u),
                        y,
                        sz * p.long
                    ];
                },
                10,
                40,
                stone
            );
            patch(
                (u, v) => {
                    const y = v * 13,
                        p = azadiProfile(y),
                        t = p.cross / p.short;
                    const a = opening(y, t),
                        z = a + (p.long - a) * u;
                    return [sx * t * faceDepth(y), y, sz * z];
                },
                8,
                26,
                stone
            );
            // Curved vault surface. The lower edge clips against the small arch;
            // above the central keystone the valid depth interval shrinks to zero.
            patch(
                (u, v) => {
                    const y = 31.5 * v,
                        p = azadiProfile(y);
                    const start = Math.max(
                        p.cross / p.short,
                        Math.sqrt(Math.max(0, (y - 23.5) / 8))
                    );
                    const t = start + (1 - start) * u,
                        z = opening(y, t);
                    return [sx * t * faceDepth(y), y, sz * z];
                },
                12,
                40,
                stone
            );
            // Blue tile panels and diamond stone ribs occupy the upper vault.
            // Parameter v follows the arch towards its foot, u follows its depth.
            const vault = (
                /** @type {number} */ u,
                /** @type {number} */ v,
                offset = 0
            ) => {
                const c = 1.4 * u * u;
                const y =
                    (23.5 + 8 * u * u) *
                    Math.sqrt(
                        Math.max(0, ((1 + c) ** 2 - (v + c) ** 2) / (1 + 2 * c))
                    );
                const z = 12 * v;
                return [sx * u * faceDepth(y), y - offset, sz * z];
            };
            // Colored geometry is authored here; reference photos are not textures.
            patch((u, v) => vault(u, v * 0.8, 0.04), 16, 16, 0x719e9b);
            // Inset diamonds follow the same diagonal coordinates as the ribs.
            // Small nested geometric tiles suggest mosaic without a photo map.
            for (let a = 0; a < 15; a++)
                for (let b = -7; b < 8; b++) {
                    const ac = (a + 0.5) / 8,
                        bc = (b + 0.5) / 8;
                    const uc = (ac + bc) / 2,
                        vc = (ac - bc) / 2;
                    if (uc < 0.063 || uc > 0.937 || vc < 0.063 || vc > 0.737)
                        continue;
                    for (const [size, color] of [
                        [0.052, 0x528e93],
                        [0.029, 0xbed1bd],
                        [0.018, 0x397080]
                    ]) {
                        patch(
                            (u, v) => {
                                const da = (u * 2 - 1) * size,
                                    db = (v * 2 - 1) * size;
                                return vault(
                                    uc + (da + db) / 2,
                                    vc + (da - db) / 2,
                                    0.07 + (0.052 - size)
                                );
                            },
                            1,
                            1,
                            color
                        );
                    }
                }
            for (const slope of [-1, 1])
                for (let k = -7; k <= 15; k++) {
                    const intercept = k / 8;
                    const lo = Math.max(
                        0,
                        slope === 1 ? -intercept : intercept - 1
                    );
                    const hi = Math.min(
                        0.8,
                        slope === 1 ? 1 - intercept : intercept
                    );
                    if (hi <= lo) continue;
                    curve(
                        (t) => {
                            const v = lo + (hi - lo) * t;
                            return vault(intercept + slope * v, v, 0.16);
                        },
                        6,
                        0.13,
                        stone
                    );
                }
            // Subtle staggered stone courses, instead of a dark rectangular grid.
            for (let y = 1.5; y < 39; y += 1.8) {
                const p = azadiProfile(y),
                    a = opening(y, 1);
                curve(
                    (t) => {
                        const z = a + (p.long - a) * t;
                        return [sx * (faceDepth(y) + 0.018), y, sz * z];
                    },
                    6,
                    0.017,
                    seam
                );
                beam(
                    [sx * p.cross, y, sz * (p.long + 0.02)],
                    [sx * p.short, y, sz * (p.long + 0.02)],
                    0.017,
                    seam
                );
            }
            for (let course = 0; course < 21; course++)
                for (let panel = 0; panel < 9; panel++) {
                    const t = (panel + (course % 2 ? 0.3 : 0.7)) / 9;
                    patch(
                        (u, v) => {
                            const y = 0.1 + course * 1.8 + v * 1.78;
                            const p = azadiProfile(y),
                                a = opening(y, 1);
                            const z = a + (p.long - a) * t + (u - 0.5) * 0.027;
                            return [sx * (faceDepth(y) + 0.022), y, sz * z];
                        },
                        1,
                        1,
                        seam
                    );
                }
            // Follow each pier continuously into the crown. Build these fine
            // details on the mapped surface so crown deformation cannot bury
            // them in the coarser shell triangles.
            const shellMaterial = new THREE.MeshBasicMaterial({
                side: THREE.DoubleSide
            });
            const shell = parts
                .slice(shellStart, shellStart + 2)
                .map((g) => new THREE.Mesh(g, shellMaterial));
            // Interior samples avoid duplicate grooves on mirrored boundaries.
            const count = 12;
            for (let rib = 0; rib < count; rib++) {
                const sample = (/** @type {number} */ v) => {
                    const y = v * 43.65;
                    const q = azadiGroovePoint(y, (rib + 0.5) / count);
                    const direction = new THREE.Vector3(
                        sx * q.x,
                        0,
                        sz * q.z
                    ).normalize();
                    const ray = new THREE.Raycaster(
                        direction.clone().multiplyScalar(80).setY(y),
                        direction.clone().negate()
                    );
                    const hit = ray.intersectObjects(shell, false)[0];
                    return hit
                        ? hit.point.addScaledVector(direction, 0.1)
                        : new THREE.Vector3(sx * q.x, y, sz * q.z);
                };
                const strip = new THREE.PlaneGeometry(1, 1, 1, 80);
                const positions = strip.attributes.position;
                for (let i = 0; i < positions.count; i++) {
                    const v = positions.getY(i) + 0.5;
                    const q = sample(v);
                    const width =
                        (0.025 + 0.055 * (1 - v)) * positions.getX(i) * 2;
                    const length = Math.hypot(q.x, q.z);
                    positions.setXYZ(
                        i,
                        q.x - (q.z / length) * width,
                        q.y,
                        q.z + (q.x / length) * width
                    );
                }
                strip.computeVertexNormals();
                add(strip, turquoise, false);
            }
            shellMaterial.dispose();
        }
    // Pointed window recesses at the crown, with stone reveals and mullions.
    for (const broad of [true, false])
        for (const side of [-1, 1]) {
            const count = broad ? 9 : 5,
                spacing = broad ? 1.07 : 1.65;
            const point = (
                /** @type {number} */ x,
                /** @type {number} */ y,
                offset = 0
            ) =>
                broad
                    ? [side * (faceDepth(y) + offset), y, x]
                    : [x, y, side * (azadiProfile(y).long + offset)];
            for (let i = 0; i < count; i++) {
                const x = (i - (count - 1) / 2) * spacing,
                    w = broad ? 0.43 : 0.32;
                const coords = [
                    [x - w, 39.6],
                    [x - w, 42.35],
                    [x, 42.85],
                    [x + w, 42.35],
                    [x + w, 39.6],
                    [x, 39.25]
                ];
                const shape = new THREE.Shape(
                    coords.map(([a, b]) => new THREE.Vector2(a, b))
                );
                const g = new THREE.ShapeGeometry(shape),
                    p = g.attributes.position;
                for (let n = 0; n < p.count; n++) {
                    const q = point(p.getX(n), p.getY(n), 0.035);
                    p.setXYZ(n, q[0], q[1], q[2]);
                }
                g.computeVertexNormals();
                add(g, 0x28626c);
                for (let n = 0; n < coords.length; n++) {
                    const a = coords[n],
                        b = coords[(n + 1) % coords.length];
                    beam(
                        point(a[0], a[1], 0.11),
                        point(b[0], b[1], 0.11),
                        0.075,
                        stone
                    );
                }
                beam(
                    point(x - w, 40.1, 0.12),
                    point(x + w, 40.1, 0.12),
                    0.085,
                    stone
                );
            }
        }
    // The terrace follows the indented outline; there is no rectangular cap.
    const crown = azadiCrownContour();
    const roof = new THREE.ShapeGeometry(
        new THREE.Shape(crown.map(([x, z]) => new THREE.Vector2(x, z)))
    );
    const rp = roof.attributes.position;
    for (let i = 0; i < rp.count; i++)
        rp.setXYZ(i, rp.getX(i), 43.8, rp.getY(i));
    roof.computeVertexNormals();
    add(roof, 0xd5cfbf, false);
    // Low parapet walls follow every return and facet of that same outline.
    for (let i = 0; i < crown.length; i++) {
        const a = crown[i],
            b = crown[(i + 1) % crown.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const wall = new THREE.BoxGeometry(length, 0.78, 0.28);
        wall.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
        wall.translate((a[0] + b[0]) / 2, 44.19, (a[1] + b[1]) / 2);
        add(wall, stone, false);
    }
    const skylightCurb = new THREE.CylinderGeometry(2.55, 2.75, 0.22, 8);
    skylightCurb.translate(0, 43.91, 0);
    add(skylightCurb, stone, false);
    const dome = new THREE.SphereGeometry(
        1,
        16,
        5,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
    );
    dome.scale(2.2, 0.7, 2.2);
    dome.translate(0, 43.9, 0);
    add(dome, 0x408b96, false);
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    return geometry;
}
