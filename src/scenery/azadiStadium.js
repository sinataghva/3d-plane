import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original procedural model. Track/field proportions and tier organization follow
// the cached footprint and photographic audit, not individual-seat survey data.
export const STADIUM_SOURCES = ['w119372471-0', 'w119374214-0'];
export const STADIUM_BOUNDARIES = [
    'w119371989-0',
    'w119372474-0',
    'w119372477-0'
];
const segments = 128;
/** @param {number} a @param {number} radius */
function trackPoint(a, radius) {
    const sn = Math.sin(a),
        cs = Math.cos(a);
    const side = radius / Math.max(1e-9, Math.abs(sn));
    const r =
        Math.abs(cs) * side <= 42.2
            ? side
            : 42.2 * Math.abs(cs) +
              Math.sqrt(Math.max(0, radius * radius - 42.2 ** 2 * sn * sn));
    return [sn * r, cs * r];
}
/** Independently shaped inner track edge and outer elliptical rim.
 * @param {number} a @param {number} t */
export function stadiumBowlPoint(a, t) {
    const inner = trackPoint(a, 53);
    return [
        inner[0] * (1 - t) + Math.sin(a) * 120 * t,
        inner[1] * (1 - t) + Math.cos(a) * 137 * t
    ];
}
/** @param {number} x @param {number} z */
export const stadiumInside = (x, z) => Math.hypot(x / 165, z / 182) <= 1;
/** @param {(x:number,z:number)=>number} height @param {number} x @param {number} z */
export function stadiumBaseHeight(height, x, z) {
    let top = height(x, z);
    for (let r = 0; r <= 1; r += 0.1)
        for (let i = 0; i < 128; i++) {
            const a = (i * Math.PI) / 64;
            top = Math.max(
                top,
                height(x + Math.sin(a) * 165 * r, z + Math.cos(a) * 182 * r)
            );
        }
    return top + 2;
}
/** Solid foundation and tier volume; keep the playable interior open above pitch.
 * @param {number} x @param {number} y @param {number} z */
export function stadiumContains(x, y, z) {
    if (!stadiumInside(x, z) || y < -50) return false;
    if (y <= 0) return true;
    // The envelope tops out at 38 m. Bomb-marker roof probes call this
    // thousands of times per frame: invert height first, not two nested searches.
    if (y > 38) return false;
    if (Math.hypot(x, Math.max(0, Math.abs(z) - 42.2)) < 53) return false;
    if (Math.hypot(x / 120, z / 137) > 1) {
        const outer = Math.hypot(x / 158, z / 174);
        const inner = Math.hypot(x / 120, z / 137);
        return y <= (outer >= 1 ? 0 : (38 * (1 - outer)) / (inner - outer));
    }
    if (y <= 2) return true;
    const t =
        y <= 15 ? ((y - 2) / 13) * 0.43 : y <= 18 ? 0.5 : 0.5 + (y - 18) / 40;
    const azimuth = Math.atan2(Math.abs(x), Math.abs(z));
    let lo = 0,
        hi = Math.PI / 2;
    for (let i = 0; i < 16; i++) {
        const angle = (lo + hi) / 2;
        const p = stadiumBowlPoint(angle, t);
        if (Math.atan2(p[0], p[1]) < azimuth) lo = angle;
        else hi = angle;
    }
    const p = stadiumBowlPoint((lo + hi) / 2, t);
    return Math.hypot(x, z) >= Math.hypot(...p);
}

export function createAzadiStadiumGeometry() {
    /** @type {THREE.BufferGeometry[]} */ const parts = [];
    /** @param {THREE.BufferGeometry} g @param {number} color */
    const add = (g, color) => {
        const p = g.index ? g.toNonIndexed() : g;
        if (p !== g) g.dispose();
        p.deleteAttribute('uv');
        const c = new THREE.Color(color),
            data = new Float32Array(p.attributes.position.count * 3);
        for (let i = 0; i < data.length; i += 3) {
            data[i] = c.r;
            data[i + 1] = c.g;
            data[i + 2] = c.b;
        }
        p.setAttribute('color', new THREE.BufferAttribute(data, 3));
        parts.push(p);
    };
    /** @param {number[]} size @param {number[]} pos @param {number} color */
    const box = (size, pos, color) =>
        add(
            new THREE.BoxGeometry(size[0], size[1], size[2]).translate(
                pos[0],
                pos[1],
                pos[2]
            ),
            color
        );
    /** @param {number[][]} points @param {number} color */
    const quad = (points, color) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
                [
                    points[0],
                    points[1],
                    points[2],
                    points[0],
                    points[2],
                    points[3]
                ].flat(),
                3
            )
        );
        g.computeVertexNormals();
        add(g, color);
    };
    /** @param {(a:number)=>number[]} inner @param {number} y0 @param {(a:number)=>number[]} outer @param {number} y1 @param {number} color */
    const band = (inner, y0, outer, y1, color) => {
        for (let i = 0; i < segments; i++) {
            const a = (i * Math.PI * 2) / segments,
                b = ((i + 1) * Math.PI * 2) / segments;
            const p = inner(a),
                q = outer(a),
                r = outer(b),
                s = inner(b);
            quad(
                [
                    [p[0], y0, p[1]],
                    [q[0], y1, q[1]],
                    [r[0], y1, r[1]],
                    [s[0], y0, s[1]]
                ],
                color
            );
        }
    };
    const concrete = 0xc3c0ae,
        dark = 0x344849;
    // Watertight horizontal platform. Track and infield are adjacent surfaces.
    band(
        (a) => trackPoint(a, 46.3),
        0,
        (a) => stadiumBowlPoint(a, 0),
        0,
        0x6b7e50
    );
    band(
        (a) => trackPoint(a, 36.5),
        0,
        (a) => trackPoint(a, 46.3),
        0,
        0xa26456
    );
    const shape = new THREE.Shape();
    for (let i = 0; i <= segments; i++) {
        const [x, z] = trackPoint((i * Math.PI * 2) / segments, 36.5);
        if (i === 0) shape.moveTo(x, -z);
        else shape.lineTo(x, -z);
    }
    const hole = new THREE.Path();
    hole.moveTo(-34, -52.5);
    hole.lineTo(34, -52.5);
    hole.lineTo(34, 52.5);
    hole.lineTo(-34, 52.5);
    hole.closePath();
    shape.holes.push(hole);
    add(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), 0x477747);
    for (let i = 0; i < 10; i++)
        box(
            [68, 0.3, 10.5],
            [0, -0.15, -47.25 + i * 10.5],
            i % 2 ? 0x447f46 : 0x4b874a
        );
    for (let lane = 0; lane <= 8; lane++) {
        const r = 36.5 + lane * 1.22;
        band(
            (a) => trackPoint(a, r),
            0.09,
            (a) => trackPoint(a, r + 0.09),
            0.09,
            0xe5d5c3
        );
    }
    /** @param {number} x0 @param {number} z0 @param {number} x1 @param {number} z1 */
    const line = (x0, z0, x1, z1) => {
        const length = Math.hypot(x1 - x0, z1 - z0);
        const g = new THREE.BoxGeometry(0.16, 0.04, length);
        g.rotateY(Math.atan2(x1 - x0, z1 - z0));
        g.translate((x0 + x1) / 2, 0.12, (z0 + z1) / 2);
        add(g, 0xf2efdf);
    };
    line(-34, -52.5, -34, 52.5);
    line(34, -52.5, 34, 52.5);
    for (const z of [-52.5, 0, 52.5]) line(-34, z, 34, z);
    band(
        (a) => [Math.sin(a) * 9.15, Math.cos(a) * 9.15],
        0.12,
        (a) => [Math.sin(a) * 9.31, Math.cos(a) * 9.31],
        0.12,
        0xf2efdf
    );
    for (const side of [-1, 1]) {
        for (const [w, d] of [
            [20.16, 16.5],
            [9.16, 5.5]
        ]) {
            const end = side * 52.5,
                start = side * (52.5 - d);
            line(-w, end, -w, start);
            line(w, end, w, start);
            line(-w, start, w, start);
        }
        box([0.2, 2.44, 0.2], [-3.66, 1.22, side * 52.5], 0xecebdc);
        box([0.2, 2.44, 0.2], [3.66, 1.22, side * 52.5], 0xecebdc);
        box([7.52, 0.2, 0.2], [0, 2.44, side * 52.5], 0xecebdc);
        for (let x = -3.5; x <= 3.5; x += 0.5)
            box([0.035, 2.4, 0.035], [x, 1.2, side * 54.5], 0xc9cbbd);
        for (let y = 0.4; y <= 2.4; y += 0.4)
            box([7.3, 0.035, 0.035], [0, y, side * 54.5], 0xc9cbbd);
        add(
            new THREE.CircleGeometry(0.18, 12)
                .rotateX(-Math.PI / 2)
                .translate(0, 0.13, side * 41.5),
            0xf2efdf
        );
    }
    add(
        new THREE.CircleGeometry(0.18, 12)
            .rotateX(-Math.PI / 2)
            .translate(0, 0.13, 0),
        0xf2efdf
    );
    for (const side of [-1, 1])
        for (let i = 0; i < 64; i++) {
            const a = (i * Math.PI) / 32,
                b = ((i + 1) * Math.PI) / 32;
            const z0 = side * (41.5 + Math.cos(a) * 9.15),
                z1 = side * (41.5 + Math.cos(b) * 9.15);
            if (side * z0 < 36 && side * z1 < 36)
                line(Math.sin(a) * 9.15, z0, Math.sin(b) * 9.15, z1);
        }
    for (const sx of [-1, 1])
        for (const sz of [-1, 1])
            for (let i = 0; i < 12; i++) {
                const a = (i * Math.PI) / 24,
                    b = ((i + 1) * Math.PI) / 24;
                line(
                    sx * (34 - Math.sin(a)),
                    sz * (52.5 - Math.cos(a)),
                    sx * (34 - Math.sin(b)),
                    sz * (52.5 - Math.cos(b))
                );
            }
    // Two continuous stepped tiers; no holes between horizontal treads.
    for (const [start, end, y0, y1, rows] of [
        [0, 0.43, 2, 15, 20],
        [0.5, 1, 18, 38, 28]
    ]) {
        for (let row = 0; row < rows; row++) {
            const t0 = start + ((end - start) * row) / rows,
                t1 = start + ((end - start) * (row + 1)) / rows;
            const low = y0 + ((y1 - y0) * row) / rows,
                high = y0 + ((y1 - y0) * (row + 1)) / rows;
            band(
                (a) => stadiumBowlPoint(a, t0),
                low,
                (a) => stadiumBowlPoint(a, t1),
                low,
                row % 4 < 2 ? 0x477259 : 0x638f50
            );
            band(
                (a) => stadiumBowlPoint(a, t1),
                low,
                (a) => stadiumBowlPoint(a, t1),
                high,
                0x8c9b7a
            );
        }
    }
    band(
        (a) => stadiumBowlPoint(a, 0.43),
        15,
        (a) => stadiumBowlPoint(a, 0.5),
        15,
        concrete
    );
    band(
        (a) => stadiumBowlPoint(a, 0.5),
        15,
        (a) => stadiumBowlPoint(a, 0.5),
        18,
        dark
    );
    band(
        (a) => stadiumBowlPoint(a, 0),
        0,
        (a) => stadiumBowlPoint(a, 0),
        2,
        concrete
    );
    band(
        (a) => stadiumBowlPoint(a, 1),
        38,
        (a) => [Math.sin(a) * 158, Math.cos(a) * 174],
        0,
        concrete
    );
    band(
        (a) => stadiumBowlPoint(a, 1),
        38,
        (a) => [Math.sin(a) * 122, Math.cos(a) * 139],
        38,
        concrete
    );
    band(
        (a) => stadiumBowlPoint(a, 1),
        38,
        (a) => stadiumBowlPoint(a, 1),
        39.2,
        concrete
    );
    band(
        (a) => [Math.sin(a) * 158, Math.cos(a) * 174],
        0,
        (a) => [Math.sin(a) * 165, Math.cos(a) * 182],
        0,
        concrete
    );
    band(
        (a) => [Math.sin(a) * 165, Math.cos(a) * 182],
        -50,
        (a) => [Math.sin(a) * 165, Math.cos(a) * 182],
        0,
        concrete
    );
    // Radial stairs follow each tread, with a separate wide middle concourse.
    for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16,
            da = 0.012;
        for (const [start, end, y0, y1, rows] of [
            [0, 0.43, 2, 15, 20],
            [0.5, 1, 18, 38, 28]
        ])
            for (let row = 0; row < rows; row++) {
                const t0 = start + ((end - start) * row) / rows,
                    t1 = start + ((end - start) * (row + 1)) / rows;
                const y = y0 + ((y1 - y0) * row) / rows + 0.07;
                const p = stadiumBowlPoint(a - da, t0),
                    q = stadiumBowlPoint(a - da, t1),
                    r = stadiumBowlPoint(a + da, t1),
                    s = stadiumBowlPoint(a + da, t0);
                quad(
                    [
                        [p[0], y, p[1]],
                        [q[0], y, q[1]],
                        [r[0], y, r[1]],
                        [s[0], y, s[1]]
                    ],
                    concrete
                );
            }
        const p = stadiumBowlPoint(a, 0.51);
        box([3, 2.3, 1.5], [p[0], 19.2, p[1]], dark);
    }
    // Access routes run down the outer concourse; portals remain dark recesses.
    for (let i = 0; i < 24; i++) {
        const a = (i * Math.PI) / 12,
            da = 0.009;
        const p = [Math.sin(a - da) * 122, Math.cos(a - da) * 139],
            q = [Math.sin(a - da) * 158, Math.cos(a - da) * 174];
        const r = [Math.sin(a + da) * 158, Math.cos(a + da) * 174],
            s = [Math.sin(a + da) * 122, Math.cos(a + da) * 139];
        quad(
            [
                [p[0], 36.15, p[1]],
                [q[0], 0.15, q[1]],
                [r[0], 0.15, r[1]],
                [s[0], 36.15, s[1]]
            ],
            0xa4a28e
        );
    }
    // Broad central hospitality / press frontage replaces seat-like uniformity.
    box([2.5, 5, 28], [-101, 25.5, 0], concrete);
    box([0.25, 3.6, 26], [-99.6, 25.5, 0], 0x426169);
    // Large recognizable fixtures, all merged rather than separate seat meshes.
    for (const side of [-1, 1]) {
        box([21, 9, 1.8], [0, 43, side * 135], 0x4c5654);
        box([19, 6.8, 0.2], [0, 43, side * 133.9], 0x1d3438);
    }
    for (const x of [-106, 106])
        for (const z of [-108, 108]) {
            add(
                new THREE.CylinderGeometry(1.1, 2.4, 88, 8).translate(x, 4, z),
                concrete
            );
            box([15, 5.5, 1.8], [x, 48, z], 0x5c6764);
            for (let col = 0; col < 10; col++)
                for (let row = 0; row < 3; row++)
                    box(
                        [0.9, 0.9, 0.3],
                        [
                            x - 6.4 + col * 1.42,
                            46.5 + row * 1.5,
                            z + (z > 0 ? -1 : 1)
                        ],
                        0xe0dfc8
                    );
        }
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    return geometry;
}
