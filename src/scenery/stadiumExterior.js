import { stadiumToLocal, stadiumToWorld } from './stadiumFrame.js';
import * as THREE from 'three';
import { subtractConvex } from './scenerySurfaces.js';

// Photo-derived access features, within the existing stadium platform footprint.
const TAU = Math.PI * 2;
// A short shared landing at each goal crest, aligned to the shell grid.
const CREST_LANDING_ANGLE = (3 * TAU) / 192;
/** @param {number} angle */
function atCrestLanding(angle) {
    return (
        Math.acos(Math.min(1, Math.abs(Math.cos(angle)))) <=
        CREST_LANDING_ANGLE + 1e-9
    );
}
export const STADIUM_OUTER = [190, 220];
// Working photo-fit datum, not a surveyed elevation. The pitch is recessed
// below the exterior plaza; keep the bowl depth separate from exposed bank height.
export const STADIUM_PLAZA_HEIGHT = 12;
// Cached access segments, in stadium-local coordinates; preserve their actual
// direction, rather than substituting a ray from the bowl centre.
export const STADIUM_PATHS = [
    [
        [-190.9, 45.2],
        [-126, 26.3]
    ],
    [
        [-42.9, -160.5],
        [-37.6, -139.7]
    ],
    [
        [-115.6, 154.8],
        [-96.8, 129.3]
    ],
    [
        [-175.8, -99.3],
        [-143.6, -68.2]
    ],
    // The paired southern portals are defined together below; these cached
    // segments locate the remaining entrances.
    [
        [196.7, -46.1],
        [155.4, -36.3]
    ],
    [
        [118.3, -165.6],
        [94, -126.9]
    ],
    [
        [173.5, 87.2],
        [144.6, 73.5]
    ]
].map((segment) => segment.map(([x, z]) => stadiumToLocal(x, z)));
export const STADIUM_APPROACHES = STADIUM_PATHS.map((p) => p[0]);
/** @param {number} across @param {number} width */
function rear(across, width) {
    return (
        width * 0.72 - width * Math.sqrt(Math.max(0, 1 - (across / width) ** 2))
    );
}
/** Main circulation is raised over the extra southern embankment only.
 * @param {number} angle */
export function stadiumMainLevel(angle) {
    const south = Math.max(0, Math.cos(angle));
    return STADIUM_PLAZA_HEIGHT + 6 * south * south;
}
// End each rising arc on the goal side of its corner entrance. The margin
// clears the entrance court, rather than starting the incline across its mouth.
const rampLimits = [2, 3, 5, 6].map((index) => {
    const [x, z] = STADIUM_PATHS[index][0];
    const angle = Math.atan2(x / 120, z / 137);
    return {
        west: x < 0,
        north: z < 0,
        limit: Math.acos(Math.abs(Math.cos(angle))) - 0.12
    };
});
/** Two independent behind-goal ramps join the fixed main and upper rings.
 * Their crests lie on the pitch long axis, not beside midfield.
 * @param {number} angle */
export function stadiumRampProfile(angle) {
    const distance = Math.acos(Math.min(1, Math.abs(Math.cos(angle))));
    const quadrant = rampLimits.find(
        (p) => p.west === Math.sin(angle) < 0 && p.north === Math.cos(angle) < 0
    );
    const phase = Math.max(
        0,
        1 -
            Math.max(0, distance - CREST_LANDING_ANGLE) /
                ((quadrant?.limit ?? 0.7) - CREST_LANDING_ANGLE)
    );
    const u = phase * phase * (3 - 2 * phase);
    // Keep the plan curve independent of the height profile. Pulling its
    // radius inward as u rises creates the spurious W-shaped crest.
    const alongArc = Math.min(1, distance / (quadrant?.limit ?? 0.7));
    // The reference has a narrow gap at the goal-end crest, widening
    // toward the corner landings; retain that spacing without an inward notch.
    const lo = 0.14 + 0.44 * alongArc * alongArc,
        hi = lo + 0.12;
    return {
        center: (lo + hi) / 2,
        lo,
        hi,
        level: stadiumMainLevel(angle) * (1 - u) + 38 * u
    };
}
/** @param {number} a @param {number} t */
export function stadiumExteriorPoint(a, t) {
    const x = Math.sin(a) * 120,
        z = Math.cos(a) * 137;
    const outer = 1 / Math.hypot(x / STADIUM_OUTER[0], z / STADIUM_OUTER[1]);
    const r = 1 + (outer - 1) * t;
    return [x * r, z * r];
}
/** Cross-section boundaries: upper ring, bank, ramp, bank, main ring,
 * southern bank, southern crescent. North of midfield the last two lie flat
 * and merge into the main plaza, without an extra enclosing embankment.
 * @param {number} angle */
function sections(angle) {
    const { lo, hi, level } = stadiumRampProfile(angle),
        main = stadiumMainLevel(angle);
    return {
        t: [0, 0.08, lo, hi, 0.7, 0.84, 0.92, 1],
        y: [
            38,
            38,
            level,
            level,
            main,
            main,
            STADIUM_PLAZA_HEIGHT,
            STADIUM_PLAZA_HEIGHT
        ]
    };
}
/** @param {number} x @param {number} z */
export function stadiumExteriorSurface(x, z) {
    const inner = Math.hypot(x / 120, z / 137);
    const outer = Math.hypot(x / STADIUM_OUTER[0], z / STADIUM_OUTER[1]);
    const t = Math.max(0, Math.min(1, (inner - 1) / (inner / outer - 1)));
    const angle = Math.atan2(x / 120, z / 137);
    const profile = sections(angle);
    for (let i = 0; i < 7; i++) {
        if (
            t <= profile.t[i + 1] + 1e-9 &&
            profile.t[i + 1] > profile.t[i] + 1e-9
        ) {
            const u = (t - profile.t[i]) / (profile.t[i + 1] - profile.t[i]);
            return {
                y: profile.y[i] * (1 - u) + profile.y[i + 1] * u,
                road:
                    i === 0 ||
                    (i === 1 && atCrestLanding(angle)) ||
                    i === 2 ||
                    i === 4 ||
                    i === 6 ||
                    (i === 5 && Math.cos(angle) <= 0)
            };
        }
    }
    return { y: STADIUM_PLAZA_HEIGHT, road: true };
}
const surface = stadiumExteriorSurface;

export const STADIUM_PORTALS = STADIUM_PATHS.map(([outer, inner], i) => {
    const length = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]);
    const nx = (outer[0] - inner[0]) / length,
        nz = (outer[1] - inner[1]) / length;
    // Intersect the original segment bearing with the outer shell, then inset
    // its mouth. The court remains on the lower level beneath the upper ramp.
    let distance = 0;
    while (
        Math.hypot(
            (inner[0] + nx * distance) / STADIUM_OUTER[0],
            (inner[1] + nz * distance) / STADIUM_OUTER[1]
        ) < 1
    )
        distance += 0.25;
    const width = i === 0 ? 30 : 6;
    const floor =
        i === 0
            ? STADIUM_PLAZA_HEIGHT
            : stadiumMainLevel(Math.atan2(inner[0] / 120, inner[1] / 137));
    let depth = i === 0 ? 50 : width * 0.72 + 1;
    while (
        depth < 44 &&
        surface(
            inner[0] + nx * (distance - depth - width * 0.28),
            inner[1] + nz * (distance - depth - width * 0.28)
        ).y <
            floor + 1 + width * 0.55 + 0.8
    )
        depth += 0.5;
    return {
        x: inner[0] + nx * (distance - depth),
        z: inner[1] + nz * (distance - depth),
        nx,
        nz,
        width,
        floor,
        depth: i === 0 ? depth : Math.max(width * 0.75, depth - 14),
        type: i === 0 ? 'court' : 'portal'
    };
});
// Cached southern footway w628749885-0, continued by w628749872-0.
// Preserve this approach's position AND bearing; a radial ray from the bowl
// centre puts both entrances east of the existing road after stadium rotation.
export const STADIUM_SOUTH_APPROACH = [
    [43.7, 175.5],
    [48.6, 210.2]
].map(([x, z]) => stadiumToLocal(x, z));
{
    const [inner, outer] = STADIUM_SOUTH_APPROACH;
    const length = Math.hypot(outer[0] - inner[0], outer[1] - inner[1]);
    const nx = (outer[0] - inner[0]) / length;
    const nz = (outer[1] - inner[1]) / length;
    // Intersect the cached centreline with each bank, rather than changing
    // the approach road to meet independently placed portal mouths.
    const at = (/** @type {number} */ t) => {
        let lo = -100,
            hi = 100;
        for (let i = 0; i < 40; i++) {
            const d = (lo + hi) / 2;
            const x = inner[0] + nx * d,
                z = inner[1] + nz * d;
            const ri = Math.hypot(x / 120, z / 137);
            const ro = Math.hypot(x / STADIUM_OUTER[0], z / STADIUM_OUTER[1]);
            if ((ri - 1) / (ri / ro - 1) < t) lo = d;
            else hi = d;
        }
        const d = (lo + hi) / 2;
        return [inner[0] + nx * d, inner[1] + nz * d];
    };
    for (const [t, end] of [
        [0.5, 0.71],
        [0.86, 0.99]
    ]) {
        const [x, z] = at(t),
            [ex, ez] = at(end);
        const angle = Math.atan2(x / 120, z / 137);
        STADIUM_PORTALS.push({
            x,
            z,
            nx,
            nz,
            width: 6,
            depth: Math.hypot(ex - x, ez - z),
            floor: t < 0.7 ? stadiumMainLevel(angle) : STADIUM_PLAZA_HEIGHT,
            type: 'portal'
        });
    }
}
/** @param {number} x @param {number} z */
export function stadiumExteriorHeight(x, z) {
    const profile = surface(x, z);

    for (const p of STADIUM_PORTALS) {
        if (profile.road && p.type !== 'court' && profile.y > p.floor + 1)
            continue;
        const dx = x - p.x,
            dz = z - p.z;
        const along = dx * p.nx + dz * p.nz;
        const across = dx * p.nz - dz * p.nx;
        if (
            Math.abs(across) <
                p.width *
                    (p.type === 'court' && along > p.width * 0.72
                        ? 1 -
                          (0.45 * (along - p.width * 0.72)) /
                              (p.depth - p.width * 0.72)
                        : 1) &&
            along > rear(across, p.width) &&
            along < p.depth
        )
            return p.floor;
    }
    return surface(x, z).y;
}

export function createStadiumExteriorGeometry() {
    /** @type {number[]} */ const positions = [];
    /** @type {number[]} */ const colors = [];
    const stone = new THREE.Color(0xc3bca4),
        wall = new THREE.Color(0xd9d1bb);
    const paving = new THREE.Color(0x858b82),
        dark = new THREE.Color(0x172322);
    /** @param {number[]} a @param {number[]} b @param {number[]} c @param {THREE.Color} color */
    const tri = (a, b, c, color) => {
        positions.push(...a, ...b, ...c);
        for (let i = 0; i < 3; i++) colors.push(color.r, color.g, color.b);
    };
    /** @param {number[][]} p @param {THREE.Color} color */
    const quad = (p, color) => {
        tri(p[0], p[1], p[2], color);
        tri(p[0], p[2], p[3], color);
    };
    /** @param {typeof STADIUM_PORTALS[number]} p @param {number} across @param {number} along */
    const portalPoint = (p, across, along) => [
        p.x + p.nz * across + p.nx * along,
        p.z - p.nx * across + p.nz * along
    ];
    const masks = STADIUM_PORTALS.map((p) => [
        ...Array.from({ length: 33 }, (_, i) => {
            const a = Math.PI + (i * Math.PI) / 32;
            return portalPoint(
                p,
                p.width * Math.cos(a),
                p.width * 0.72 + p.width * Math.sin(a)
            );
        }),
        portalPoint(p, p.width * (p.type === 'court' ? 0.55 : 1), p.depth),
        portalPoint(p, -p.width * (p.type === 'court' ? 0.55 : 1), p.depth)
    ]);
    const bounds = masks.map((m) => ({
        minX: Math.min(...m.map((p) => p[0])),
        maxX: Math.max(...m.map((p) => p[0])),
        minZ: Math.min(...m.map((p) => p[1])),
        maxZ: Math.max(...m.map((p) => p[1]))
    }));
    // Cut real holes in the shell. No flat shell remains
    // in front of tunnel mouths, avoiding coincident ground/entrance overlays.
    for (let i = 0; i < 192; i++)
        for (let j = 0; j < 7; j++) {
            const a = (i * TAU) / 192,
                b = ((i + 1) * TAU) / 192;
            /** @param {number} angle @param {number} row */
            const gridPoint = (angle, row) => {
                return stadiumExteriorPoint(angle, sections(angle).t[row]);
            };
            let pieces = [
                [
                    gridPoint(a, j),
                    gridPoint(a, j + 1),
                    gridPoint(b, j + 1),
                    gridPoint(b, j)
                ]
            ];
            masks.forEach((mask, k) => {
                if (
                    j === 0 ||
                    (STADIUM_PORTALS[k].type !== 'court' &&
                        (j === 2 || j === 4 || j === 6) &&
                        pieces.every((poly) =>
                            poly.every(
                                ([x, z]) =>
                                    surface(x, z).y >
                                    STADIUM_PORTALS[k].floor + 1
                            )
                        ))
                )
                    return; // Keep the upper ramp deck continuous above lower portals.
                const box = bounds[k];
                pieces = pieces.flatMap((poly) =>
                    poly.every((p) => p[0] < box.minX) ||
                    poly.every((p) => p[0] > box.maxX) ||
                    poly.every((p) => p[1] < box.minZ) ||
                    poly.every((p) => p[1] > box.maxZ)
                        ? [poly]
                        : subtractConvex(poly, mask)
                );
            });
            for (const poly of pieces)
                for (let k = 1; k < poly.length - 1; k++) {
                    const points = [poly[0], poly[k], poly[k + 1]];
                    const color =
                        j === 0 ||
                        (j === 1 && atCrestLanding((a + b) / 2)) ||
                        j === 2 ||
                        j === 4 ||
                        j === 6 ||
                        (j === 5 && Math.cos((a + b) / 2) <= 0)
                            ? paving
                            : stone;
                    const v = points.map(([x, z]) => [x, surface(x, z).y, z]);
                    // Preserve upward winding of the radial grid through clipping.
                    tri(v[0], v[1], v[2], color);
                }
        }
    for (const [index, p] of STADIUM_PORTALS.entries()) {
        const mouth = (
            /** @type {number} */ u,
            /** @type {number} */ d,
            /** @type {number} */ y
        ) => {
            const [x, z] = portalPoint(
                p,
                u,
                p.type !== 'court' && d === -8 ? -2 : d
            );
            return [x, y + p.floor, z];
        };
        const edge = masks[index].slice(0, 33);
        const depth = p.depth;
        const outline = [
            ...edge,
            portalPoint(p, p.width * (p.type === 'court' ? 0.55 : 1), depth),
            portalPoint(p, -p.width * (p.type === 'court' ? 0.55 : 1), depth)
        ];
        // Open horseshoe court: the rounded retaining wall follows the slope,
        // with a bright coping lip rather than a rectangular facade cutout.
        for (let i = 0; i < outline.length - 1; i++) {
            const [x, z] = outline[i],
                [xx, zz] = outline[i + 1];
            const across = (x - p.x) * p.nz - (z - p.z) * p.nx;
            const across2 = (xx - p.x) * p.nz - (zz - p.z) * p.nx;
            const arch = (/** @type {number} */ u) =>
                Math.abs(u) < p.width * (p.type === 'court' ? 0.36 : 0.55)
                    ? p.type === 'court'
                        ? 18 + 2 * Math.sqrt(1 - (u / (p.width * 0.36)) ** 2)
                        : 1 +
                          p.width *
                              0.55 *
                              Math.sqrt(1 - (u / (p.width * 0.55)) ** 2)
                    : 0;
            const y = p.floor + (i < 32 ? arch(across) : 0),
                yy = p.floor + (i < 32 ? arch(across2) : 0);
            const top = surface(x, z).y,
                top2 = surface(xx, zz).y;
            quad(
                [
                    [x, y, z],
                    [x, top, z],
                    [xx, top2, zz],
                    [xx, yy, zz]
                ],
                wall
            );
            const cx = p.x + p.nx * (p.width * 0.72),
                cz = p.z + p.nz * (p.width * 0.72);
            const len = Math.hypot(x - cx, z - cz),
                len2 = Math.hypot(xx - cx, zz - cz);
            if (i < 33)
                quad(
                    [
                        [x, top + 0.15, z],
                        [
                            x + ((x - cx) / len) * 0.7,
                            top + 0.15,
                            z + ((z - cz) / len) * 0.7
                        ],
                        [
                            xx + ((xx - cx) / len2) * 0.7,
                            top2 + 0.15,
                            zz + ((zz - cz) / len2) * 0.7
                        ],
                        [xx, top2 + 0.15, zz]
                    ],
                    wall
                );
            if (i < 32 && (y > p.floor + 0.01 || yy > p.floor + 0.01)) {
                quad(
                    [
                        [x, y, z],
                        [xx, yy, zz],
                        [xx - p.nx * 5, yy, zz - p.nz * 5],
                        [x - p.nx * 5, y, z - p.nz * 5]
                    ],
                    stone
                );
            }
        }
        // Close the remaining approach cheek.
        const [x, z] = outline[0],
            [xx, zz] = outline[outline.length - 1];
        quad(
            [
                [x, p.floor, z],
                [x, surface(x, z).y, z],
                [xx, surface(xx, zz).y, zz],
                [xx, p.floor, zz]
            ],
            wall
        );
        for (let i = 0; i < outline.length; i++) {
            const q = outline[i],
                r = outline[(i + 1) % outline.length];
            tri(
                mouth(0, p.width * 0.72, 0),
                [r[0], p.floor, r[1]],
                [q[0], p.floor, q[1]],
                paving
            );
        }
        if (p.type === 'court') {
            // Three stacked recessed levels, with curved projecting slabs.
            // The oval retaining walls above belong to the bank itself.
            for (const y of [6, 12, 18]) {
                for (let k = 0; k < 32; k++) {
                    const u = -11 + (k * 22) / 32,
                        v = u + 22 / 32;
                    const edge = (/** @type {number} */ t) =>
                        -5 + 7 * Math.sqrt(Math.max(0, 1 - (t / 11) ** 2));
                    const yu =
                        y + 2.2 * Math.sqrt(Math.max(0, 1 - (u / 11) ** 2));
                    const yv =
                        y + 2.2 * Math.sqrt(Math.max(0, 1 - (v / 11) ** 2));
                    quad(
                        [
                            mouth(u, -8, yu),
                            mouth(u, edge(u), yu),
                            mouth(v, edge(v), yv),
                            mouth(v, -8, yv)
                        ],
                        wall
                    );
                    quad(
                        [
                            mouth(u, edge(u), yu - 0.8),
                            mouth(u, edge(u), yu),
                            mouth(v, edge(v), yv),
                            mouth(v, edge(v), yv - 0.8)
                        ],
                        wall
                    );
                }
            }
            // Recessed glazing divisions give the three openings depth and scale.
            for (let u = -10; u <= 10; u += 2) {
                quad(
                    [
                        mouth(u - 0.12, -7.9, 0),
                        mouth(u - 0.12, -7.9, 20),
                        mouth(u + 0.12, -7.9, 20),
                        mouth(u + 0.12, -7.9, 0)
                    ],
                    stone
                );
            }
            for (const u of [-11, 11]) {
                quad(
                    [
                        mouth(u - 0.7, -7, 0),
                        mouth(u - 0.7, -7, 20),
                        mouth(u + 0.7, -7, 20),
                        mouth(u + 0.7, -7, 0)
                    ],
                    wall
                );
            }
        }
        quad(
            [
                mouth(-p.width * (p.type === 'court' ? 0.36 : 0.6), -8, 0),
                mouth(
                    -p.width * (p.type === 'court' ? 0.36 : 0.6),
                    -8,
                    p.type === 'court' ? 20 : p.width * 0.55 + 1
                ),
                mouth(
                    p.width * (p.type === 'court' ? 0.36 : 0.6),
                    -8,
                    p.type === 'court' ? 20 : p.width * 0.55 + 1
                ),
                mouth(p.width * (p.type === 'court' ? 0.36 : 0.6), -8, 0)
            ],
            dark
        );
        // Extend the floor into the tunnel only where the court fan does not
        // already cover it. Coplanar floor quads caused the striped flicker.
        const half = p.width * (p.type === 'court' ? 0.36 : 0.6);
        const back = p.type === 'court' ? -8 : -2;
        const tunnelFloor = [
            portalPoint(p, -half, back),
            portalPoint(p, -half, 3),
            portalPoint(p, half, 3),
            portalPoint(p, half, back)
        ];
        for (const poly of subtractConvex(tunnelFloor, outline)) {
            for (let i = 1; i < poly.length - 1; i++) {
                const v = [poly[0], poly[i], poly[i + 1]].map(([x, z]) => [
                    x,
                    p.floor,
                    z
                ]);
                tri(v[0], v[1], v[2], paving);
            }
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
}

/** Connect each entrance to its cached access path with terrain-following paving.
 * @param {import('./geography.js').Geography} world */
export function createStadiumApproaches(world) {
    if (!world.stadium) return new THREE.Group();
    /** @type {number[]} */
    const positions = [];
    const { x: cx, z: cz, base } = world.stadium;
    STADIUM_PORTALS.forEach((p, i) => {
        const a = [p.x + p.nx * p.depth, p.z + p.nz * p.depth];
        // The broad south ground connector is generated separately below.
        const cached = STADIUM_APPROACHES[i];
        if (!cached || p.floor > STADIUM_PLAZA_HEIGHT + 0.5) return;
        const run = Math.max(
            0,
            (cached[0] - a[0]) * p.nx + (cached[1] - a[1]) * p.nz
        );
        if (run < 0.5) return;
        const end = [a[0] + p.nx * run, a[1] + p.nz * run];
        const vertex = (
            /** @type {number} */ t,
            /** @type {number} */ side
        ) => {
            const width = 1.8;
            const x = a[0] * (1 - t) + end[0] * t + p.nz * width * side;
            const z = a[1] * (1 - t) + end[1] * t - p.nx * width * side;
            return [
                x,
                (world.terrainHeight(
                    cx + stadiumToWorld(x, z)[0],
                    cz + stadiumToWorld(x, z)[1]
                ) -
                    base) *
                    t +
                    p.floor * (1 - t) +
                    0.12,
                z
            ];
        };
        for (let j = 0; j < 16; j++) {
            const l = vertex(j / 16, -1),
                r = vertex(j / 16, 1),
                ll = vertex((j + 1) / 16, -1),
                rr = vertex((j + 1) / 16, 1);
            positions.push(...l, ...ll, ...rr, ...l, ...rr, ...r);
        }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(
        g,
        new THREE.MeshLambertMaterial({
            color: 0x858b82,
            side: THREE.DoubleSide
        })
    );
    mesh.name = 'Stadium aligned approach paths';
    mesh.receiveShadow = true;
    return mesh;
}

/** Ground connection into the low end of the two ascending upper routes.
 * @param {number} x @param {number} z @param {number} ground @param {number} base */
export function stadiumRampGroundHeight(x, z, ground, base) {
    const [lx, lz] = stadiumToLocal(x, z);
    return stadiumRampLocalGroundHeight(lx, lz, ground, base);
}
/** @param {number} x @param {number} z @param {number} ground @param {number} base */
export function stadiumRampLocalGroundHeight(x, z, ground, base) {
    void x;
    void z;
    void base;
    return ground;
}
