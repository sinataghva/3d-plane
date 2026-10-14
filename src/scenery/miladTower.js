import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Original procedural interpretation. NCK's project reference fixes the roof at
// 315 m and the mast at 120 m; the lower head begins at roughly 247.5 m.
// The podium and detailed sections are photo-derived, not survey dimensions.
export const MILAD = {
    headBottom: 247.5,
    roof: 315,
    tip: 435,
    podiumRadius: 52
};
// These cached objects are elevated tower floors (min_height 248/251), not
// ground-level buildings. Replace them in rendering AND obstacle indexing.
export const MILAD_REPLACED_SOURCES = ['w531217177-0', 'w531217179-0'];

/** Place the entrance above the entire footprint, not just its centre.
 * Cached by the caller so terrain sampling stays out of the flight loop.
 * @param {(x:number,z:number)=>number} height @param {number} x @param {number} z */
export function miladBaseHeight(height, x, z) {
    let top = height(x, z);
    for (let radius = 13; radius <= MILAD.podiumRadius; radius += 13)
        for (let i = 0; i < 64; i++) {
            const angle = (i * Math.PI) / 32;
            top = Math.max(
                top,
                height(
                    x + Math.sin(angle) * radius,
                    z + Math.cos(angle) * radius
                )
            );
        }
    return top + 0.5;
}

const stone = 0xd2cbbb,
    trim = 0xe6e1d3,
    glass = 0x486b72,
    steel = 0x9ca9a7;
/** [height, radius] shared by the head surface and collision envelope. */
const headProfile = [
    [247.5, 10],
    [252, 12],
    [260, 18],
    [270, 26],
    [280, 31],
    [281, 31],
    [284.4, 28.5],
    [285, 28.5],
    [286, 25.5],
    [288, 25.5],
    [289, 23],
    [290, 22],
    [292, 22],
    [293, 20],
    [293.8, 20],
    [295, 20],
    [296, 17],
    [296.5, 17],
    [298, 16],
    [300, 15.8],
    [302, 15.2],
    [304, 14.3],
    [306, 13.1],
    [308, 11.5],
    [310, 9.5],
    [312, 6.8],
    [313, 6],
    [315, 6]
];
/** @param {number[][]} profile @param {number} y */
function radiusAt(profile, y) {
    for (let i = 1; i < profile.length; i++) {
        const [a, r] = profile[i - 1],
            [b, s] = profile[i];
        if (y <= b) return r + (s - r) * Math.max(0, (y - a) / (b - a));
    }
    return profile[profile.length - 1][1];
}
const shaftOutline = [
    [5, 12],
    [-5, 12],
    [-5, 9],
    [-9, 5],
    [-12, 5],
    [-12, -5],
    [-9, -5],
    [-5, -9],
    [-5, -12],
    [5, -12],
    [5, -9],
    [9, -5],
    [12, -5],
    [12, 5],
    [9, 5],
    [5, 9]
];
/** @param {number} y */
const shaftScale = (y) => 1 - 0.29 * Math.min(1, Math.max(0, y) / 247.5);
/** @param {number} x @param {number} y @param {number} z */
export function miladContains(x, y, z) {
    if (y < -32 || y > MILAD.tip) return false;
    const r = Math.hypot(x, z);
    if (y <= 9 && r <= MILAD.podiumRadius) return true;
    if (
        y <= 20 &&
        r <=
            radiusAt(
                [
                    [9, 38],
                    [14, 35],
                    [18, 28],
                    [20, 17]
                ],
                y
            )
    )
        return true;
    if (y >= MILAD.roof)
        return (
            r <=
            radiusAt(
                [
                    [315, 3.4],
                    [355, 2.6],
                    [385, 1.3],
                    [385.1, 0.9],
                    [420, 0.65],
                    [420.1, 0.35],
                    [435, 0.2]
                ],
                y
            )
        );
    if (y >= MILAD.headBottom) return r <= radiusAt(headProfile, y) + 0.65;
    const scale = shaftScale(y);
    let inside = false;
    for (
        let i = 0, j = shaftOutline.length - 1;
        i < shaftOutline.length;
        j = i++
    ) {
        const [ax, az] = shaftOutline[i],
            [bx, bz] = shaftOutline[j];
        if (
            az * scale > z !== bz * scale > z &&
            x < ((bx - ax) * (z - az * scale)) / (bz - az) + ax * scale
        )
            inside = !inside;
    }
    return inside;
}

export function createMiladTowerGeometry() {
    /** @type {THREE.BufferGeometry[]} */ const parts = [];
    /** @param {THREE.BufferGeometry} g @param {number} color */
    const add = (g, color) => {
        const mesh = g.index ? g.toNonIndexed() : g;
        if (mesh !== g) g.dispose();
        const c = new THREE.Color(color),
            colors = new Float32Array(mesh.attributes.position.count * 3);
        for (let i = 0; i < colors.length; i += 3) {
            colors[i] = c.r;
            colors[i + 1] = c.g;
            colors[i + 2] = c.b;
        }
        mesh.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        mesh.deleteAttribute('uv');
        parts.push(mesh);
    };
    /** @param {number} y0 @param {number} r0 @param {number} y1 @param {number} r1 @param {number} color @param {number} [segments] */
    const belt = (y0, r0, y1, r1, color, segments = 48) =>
        add(
            new THREE.CylinderGeometry(
                r1,
                r0,
                y1 - y0,
                segments,
                1,
                true
            ).translate(0, (y0 + y1) / 2, 0),
            color
        );
    /** @param {number} inner @param {number} outer @param {number} y @param {number} color */
    const terrace = (inner, outer, y, color) =>
        add(
            new THREE.RingGeometry(inner, outer, 48)
                .rotateX(-Math.PI / 2)
                .translate(0, y, 0),
            color
        );
    /** @param {number} r @param {number} y @param {number} a */
    const point = (r, y, a) =>
        new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);
    /** @param {THREE.Vector3} a @param {THREE.Vector3} b @param {number} r @param {number} color */
    const beam = (a, b, r, color) => {
        const d = b.clone().sub(a),
            g = new THREE.CylinderGeometry(r, r, d.length(), 5);
        g.applyQuaternion(
            new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0, 1, 0),
                d.normalize()
            )
        );
        g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray());
        add(g, color);
    };
    // A continuous four-pier section: recessed diagonal faces are part of the
    // same shell, rather than coplanar strips laid on a cylinder.
    const levels = [0, 20, 100, 190, 240, 247.5];
    for (let k = 1; k < levels.length; k++)
        for (let i = 0; i < shaftOutline.length; i++) {
            const a = shaftOutline[i],
                b = shaftOutline[(i + 1) % shaftOutline.length];
            const low = levels[k - 1],
                high = levels[k],
                l = shaftScale(low),
                h = shaftScale(high);
            const g = new THREE.BufferGeometry();
            g.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(
                    [
                        a[0] * l,
                        low,
                        a[1] * l,
                        b[0] * l,
                        low,
                        b[1] * l,
                        a[0] * h,
                        high,
                        a[1] * h,
                        b[0] * l,
                        low,
                        b[1] * l,
                        b[0] * h,
                        high,
                        b[1] * h,
                        a[0] * h,
                        high,
                        a[1] * h
                    ],
                    3
                )
            );
            const positions = g.getAttribute('position');
            for (let v = 0; v < positions.count; v += 3) {
                const b = new THREE.Vector3().fromBufferAttribute(
                    positions,
                    v + 1
                );
                const c = new THREE.Vector3().fromBufferAttribute(
                    positions,
                    v + 2
                );
                positions.setXYZ(v + 1, c.x, c.y, c.z);
                positions.setXYZ(v + 2, b.x, b.y, b.z);
            }
            g.computeVertexNormals();
            add(g, i % 4 === 2 ? 0x788789 : stone);
        }
    // Head bands use a single angular grid and disjoint vertical intervals.
    // This avoids the old 12-sided glazing / 24-sided ring intersections.
    for (let i = 1; i < headProfile.length; i++) {
        const [y0, r0] = headProfile[i - 1],
            [y1, r1] = headProfile[i];
        belt(
            y0,
            r0,
            y1,
            r1,
            y0 >= 298 && y1 <= 313
                ? 0x397b8c
                : y1 <= 280
                  ? glass
                  : [
                          [281, 284.4],
                          [286, 288],
                          [290, 292],
                          [293.8, 295],
                          [296.5, 298]
                      ].some(([low, high]) => y0 >= low && y1 <= high)
                    ? glass
                    : trim
        );
    }
    // Fine glazing divisions sit behind the structural basket braces.
    for (let y = 253; y < 280; y += 2)
        belt(
            y - 0.045,
            radiusAt(headProfile, y - 0.045) + 0.1,
            y + 0.045,
            radiusAt(headProfile, y + 0.045) + 0.1,
            steel
        );
    for (let i = 0; i < 48; i++) {
        const angle = (i * Math.PI) / 24;
        for (const [low, high] of [
            [252, 260],
            [260, 270],
            [270, 280]
        ])
            beam(
                point(radiusAt(headProfile, low) + 0.12, low, angle),
                point(radiusAt(headProfile, high) + 0.12, high, angle),
                0.07,
                steel
            );
    }
    // Open terrace rails, with actual clearance above the glazing/roof skin.
    for (const [y, radius] of [
        [285, 28.3],
        [288.1, 25.2],
        [292.1, 21.8],
        [295.1, 19.7],
        [315, 5.8]
    ]) {
        for (const level of [0.55, 1.1])
            add(
                new THREE.TorusGeometry(radius, 0.065, 4, 48)
                    .rotateX(Math.PI / 2)
                    .translate(0, y + level, 0),
                steel
            );
        for (let i = 0; i < 48; i++) {
            const angle = (i * Math.PI) / 24;
            beam(
                point(radius, y, angle),
                point(radius, y + 1.1, angle),
                0.07,
                steel
            );
        }
    }
    for (let row = 0; row < 3; row++) {
        const y0 = 252 + row * 9.3,
            y1 = Math.min(280, y0 + 9.3);
        const r0 = radiusAt(headProfile, y0) + 0.45,
            r1 = radiusAt(headProfile, y1) + 0.45;
        for (let i = 0; i < 16; i++) {
            const a = (i * Math.PI) / 8,
                b = a + Math.PI / 8;
            beam(point(r0, y0, a), point(r1, y1, b), 0.65, trim);
            beam(point(r0, y0, b), point(r1, y1, a), 0.65, trim);
        }
    }
    for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI) / 24;
        for (const [y0, y1] of [
            [281, 284.4],
            [286, 288],
            [290, 292],
            [293.8, 295],
            [296.5, 298]
        ])
            beam(
                point(radiusAt(headProfile, y0) + 0.12, y0, a),
                point(radiusAt(headProfile, y1) + 0.12, y1, a),
                0.09,
                trim
            );
    }
    // Rounded glass dome, with framing following the same curved profile.
    for (let i = 0; i < 48; i++) {
        const angle = (i * Math.PI) / 24;
        for (let y = 298; y < 313; y += 2) {
            const next = Math.min(313, y + 2);
            beam(
                point(radiusAt(headProfile, y) + 0.16, y, angle),
                point(radiusAt(headProfile, next) + 0.16, next, angle),
                0.065,
                trim
            );
        }
    }
    for (const y of [300, 302, 304, 306, 308, 310, 312])
        belt(
            y - 0.055,
            radiusAt(headProfile, y - 0.055) + 0.12,
            y + 0.055,
            radiusAt(headProfile, y + 0.055) + 0.12,
            trim
        );
    terrace(0, 6, 315, steel);
    // Photographs show a broad enclosed lower mast, with exposed lattice above.
    belt(315, 3.4, 355, 2.6, trim, 24);
    belt(355, 2.6, 385, 1.3, trim, 24);
    for (let y = 385; y < 420; y += 5)
        for (let i = 0; i < 4; i++) {
            const a = (i * Math.PI) / 2,
                b = a + Math.PI / 2;
            const r0 = 1.35 - (y - 385) * 0.02,
                r1 = r0 - 0.1;
            beam(point(r0, y, a), point(r1, y + 5, a), 0.1, steel);
            beam(point(r0, y, a), point(r1, y + 5, b), 0.065, steel);
        }
    belt(385, 0.9, 420, 0.65, trim, 12);
    belt(420, 0.35, 435, 0.2, steel, 8);
    // The entrance is a broad circular terrace enclosing a glazed roof. Its
    // foundation skirt extends below local ground rather than leaving a gap.
    belt(-32, 52, 1, 52, stone);
    belt(1, 52, 7.8, 52, glass);
    belt(7.8, 52, 9, 52, trim);
    terrace(38, 52, 9, trim);
    for (const [a, r, b, s] of [
        [9, 38, 14, 35],
        [14, 35, 18, 28],
        [18, 28, 20, 17]
    ])
        belt(a, r, b, s, glass);
    terrace(0, 17, 20, stone);
    for (let i = 0; i < 48; i++) {
        const a = (i * Math.PI) / 24;
        beam(point(52.2, 1, a), point(52.2, 8, a), 0.28, trim);
        for (const [y0, r0, y1, r1] of [
            [9, 38, 14, 35],
            [14, 35, 18, 28],
            [18, 28, 20, 17]
        ])
            beam(
                point(r0 + 0.12, y0 + 0.12, a),
                point(r1 + 0.12, y1 + 0.12, a),
                0.16,
                steel
            );
    }
    const geometry = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    return geometry;
}
