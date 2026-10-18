import * as THREE from 'three';
import {
    STADIUM_OUTER,
    STADIUM_PORTALS,
    stadiumExteriorHeight,
    stadiumExteriorSurface
} from './stadiumExterior.js';
/** Lightweight paving joints and planted terrace edges; no collision detail. */
export function createStadiumLandscape() {
    const group = new THREE.Group();
    group.name = 'Stadium terrace paving and planting';
    /** @type {number[]} */ const lines = [];
    const usable = (/** @type {number} */ x, /** @type {number} */ z) => {
        if (
            Math.hypot(x / 123, z / 140) < 1 ||
            Math.hypot(x / STADIUM_OUTER[0], z / STADIUM_OUTER[1]) > 0.99
        )
            return false;
        if (
            STADIUM_PORTALS.some((p) => {
                const dx = x - p.x,
                    dz = z - p.z;
                const across = dx * p.nz - dz * p.nx,
                    along = dx * p.nx + dz * p.nz;
                return (
                    Math.abs(across) < p.width + 2 &&
                    along > -p.width * 0.3 - 2 &&
                    along < p.depth + 2
                );
            })
        )
            return false;
        return !stadiumExteriorSurface(x, z).road;
    };
    for (const sign of [-1, 1])
        for (let offset = -380; offset <= 380; offset += 9)
            for (let x = -STADIUM_OUTER[0]; x < STADIUM_OUTER[0]; x += 2) {
                const z = sign * x + offset,
                    xx = x + 2,
                    zz = sign * xx + offset;
                if (usable(x, z) && usable(xx, zz))
                    lines.push(
                        x,
                        stadiumExteriorHeight(x, z) + 0.14,
                        z,
                        xx,
                        stadiumExteriorHeight(xx, zz) + 0.14,
                        zz
                    );
            }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    group.add(
        new THREE.LineSegments(
            g,
            new THREE.LineBasicMaterial({
                color: 0xd6d0ba,
                transparent: true,
                opacity: 0.45
            })
        )
    );
    const trees = [];
    for (let i = 0; i < 160; i++) {
        const a = (i * Math.PI * 2) / 160,
            x = Math.sin(a) * (STADIUM_OUTER[0] - 3),
            z = Math.cos(a) * (STADIUM_OUTER[1] - 3);
        if (
            STADIUM_PORTALS.some((p) => {
                const dx = x - p.x,
                    dz = z - p.z;
                return (
                    Math.abs(dx * p.nz - dz * p.nx) < p.width + 3 &&
                    dx * p.nx + dz * p.nz > -p.width
                );
            }) ||
            Math.abs(Math.sin(a)) < 0.15
        )
            continue;
        trees.push([x, stadiumExteriorHeight(x, z), z]);
    }
    const plants = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1.1, 3.5, 5),
        new THREE.MeshLambertMaterial({ color: 0x344a2d }),
        trees.length
    );
    const matrix = new THREE.Matrix4();
    trees.forEach(([x, y, z], i) =>
        plants.setMatrixAt(i, matrix.makeTranslation(x, y + 1.75, z))
    );
    group.add(plants);
    return group;
}
