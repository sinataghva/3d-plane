import { stadiumToLocal, stadiumToWorld } from './stadiumFrame.js';
import { test, expect } from 'vitest';
import * as THREE from 'three';
import {
    createStadiumExteriorGeometry,
    stadiumExteriorHeight,
    stadiumRampProfile,
    stadiumMainLevel,
    stadiumExteriorPoint,
    stadiumExteriorSurface,
    STADIUM_OUTER,
    STADIUM_PORTALS
} from './stadiumExterior.js';

test('exterior recesses remove the shell instead of hiding it beneath overlays', () => {
    const geometry = createStadiumExteriorGeometry();
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.updateMatrixWorld(true);
    const hit = (x, z) =>
        new THREE.Raycaster(
            new THREE.Vector3(x, 70, z),
            new THREE.Vector3(0, -1, 0)
        ).intersectObject(mesh)[0];
    for (const p of STADIUM_PORTALS) {
        // The approach must stay open all the way to the outer perimeter,
        // rather than leaving a disconnected pit enclosed by the shell.
        for (const distance of [p.depth * 0.2, p.depth * 0.5, p.depth * 0.8]) {
            const x = p.x + p.nx * distance,
                z = p.z + p.nz * distance;
            expect(hit(x, z).point.y).toBeCloseTo(
                stadiumExteriorHeight(x, z),
                0
            );
        }
    }
    // Away from recesses, the visible outer shell and contact height agree.
    for (const [x, z] of [
        [130, 20],
        [-125, 35],
        [135, -30],
        [10, 160],
        [-10, -160]
    ]) {
        expect(hit(x, z).point.y).toBeCloseTo(stadiumExteriorHeight(x, z), 0);
        expect(hit(x, z).face.normal.y).toBeGreaterThan(0);
    }
    geometry.dispose();
    material.dispose();
});

test('upper routes rise and descend between ground landings with matching contact heights', () => {
    const mesh = new THREE.Mesh(
        createStadiumExteriorGeometry(),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    mesh.updateMatrixWorld(true);
    for (const direction of [-1, 1])
        for (let i = 0; i <= 96; i++) {
            const a = (direction * i * Math.PI) / 96 + 1e-7,
                { hi, level } = stadiumRampProfile(a);
            const x = Math.sin(a) * 120,
                z = Math.cos(a) * 137;
            const outer =
                1 / Math.hypot(x / STADIUM_OUTER[0], z / STADIUM_OUTER[1]);
            // At the long sides the route has ended in the main plaza, which
            // is interrupted by the ceremonial entrance; test the rising arcs.
            if (Math.abs(level - stadiumMainLevel(a)) < 1e-8) continue;
            const r = 1 + (outer - 1) * (hi - 0.01),
                xx = x * r,
                zz = z * r;
            const hit = new THREE.Raycaster(
                new THREE.Vector3(xx, 70, zz),
                new THREE.Vector3(0, -1, 0)
            ).intersectObject(mesh)[0];
            expect(
                hit,
                `route ${direction} sample ${i}: ${xx}, ${zz}`
            ).toBeDefined();
            expect(hit.point.y).toBeCloseTo(level, 0);
            expect(stadiumExteriorHeight(xx, zz)).toBeCloseTo(hit.point.y, 0);
        }
    mesh.geometry.dispose();
    mesh.material.dispose();
});

test('separate upper and main rings connect through ramps behind both goals', () => {
    for (const goal of [0, Math.PI]) {
        expect(stadiumRampProfile(goal).level).toBeCloseTo(38);
        expect(stadiumRampProfile(goal - 1.15).level).toBeLessThan(19);
        expect(stadiumRampProfile(goal + 1.15).level).toBeLessThan(19);
    }
    for (let i = 0; i < 32; i++) {
        const a = (i * Math.PI) / 16;
        expect(
            stadiumExteriorSurface(...stadiumExteriorPoint(a, 0.04)).y
        ).toBeCloseTo(38);
        expect(
            stadiumExteriorSurface(...stadiumExteriorPoint(a, 0.77)).road
        ).toBe(true);
    }
    expect(
        stadiumExteriorSurface(...stadiumExteriorPoint(0, 0.88)).y
    ).toBeGreaterThan(0);
    expect(
        stadiumExteriorSurface(...stadiumExteriorPoint(Math.PI, 0.88)).y
    ).toBe(12);
});

test('western cached approach keeps its world bearing after the stadium rotates', () => {
    const local = stadiumToLocal(-64.9, 18.9);
    expect(local[1]).toBeCloseTo(0, 8);
    const world = stadiumToWorld(...local);
    expect(world[0]).toBeCloseTo(-64.9, 8);
    expect(world[1]).toBeCloseTo(18.9, 8);
    const main = STADIUM_PORTALS.find((p) => p.type === 'court');
    expect(main.x).toBeLessThan(-120);
    expect(Math.abs(main.z)).toBeLessThan(15);
});

test('entrance floors have one surface, not coincident court, road and tunnel faces', () => {
    const mesh = new THREE.Mesh(
        createStadiumExteriorGeometry(),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    mesh.updateMatrixWorld(true);
    for (const p of STADIUM_PORTALS) {
        for (const u of [-0.313, 0.217])
            for (const t of [0.237, 0.563, 0.891]) {
                const x = p.x + p.nz * p.width * u + p.nx * p.depth * t;
                const z = p.z - p.nx * p.width * u + p.nz * p.depth * t;
                const hits = new THREE.Raycaster(
                    new THREE.Vector3(x, 70, z),
                    new THREE.Vector3(0, -1, 0)
                ).intersectObject(mesh);
                const floors = hits.filter(
                    (h) => Math.abs(h.point.y - p.floor) < 0.001
                );
                expect(
                    floors.length,
                    `portal ${p.x},${p.z}, sample ${u},${t}`
                ).toBe(1);
            }
    }
    mesh.geometry.dispose();
    mesh.material.dispose();
});

test('rising ramp arcs clear all four corner entrance courts', () => {
    for (const index of [2, 3, 5, 6]) {
        const p = STADIUM_PORTALS[index];
        const a = Math.atan2(p.x / 120, p.z / 137);
        for (const offset of [-0.06, 0, 0.06]) {
            const angle = a + offset;
            expect(stadiumRampProfile(angle).level).toBeCloseTo(
                stadiumMainLevel(angle),
                8
            );
        }
    }
});

test('ramp plan arcs remain convex without a radial notch at the crest', () => {
    for (const goal of [0, Math.PI]) {
        const points = [];
        for (let i = 0; i <= 80; i++) {
            const angle = goal - 0.7 + (i * 1.4) / 80;
            points.push(
                stadiumExteriorPoint(angle, stadiumRampProfile(angle).center)
            );
        }
        const turns = [];
        for (let i = 1; i < points.length - 1; i++) {
            const [a, b, c] = [points[i - 1], points[i], points[i + 1]];
            turns.push(
                (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
            );
        }
        expect(turns.every((t) => t < 0)).toBe(true);
    }
});

test('both ramp crests provide a level paved connection to the upper ring', () => {
    for (const goal of [0, Math.PI]) {
        for (const offset of [-0.06, 0, 0.06]) {
            const angle = goal + offset;
            const ramp = stadiumRampProfile(angle);
            for (const t of [0.04, 0.1, ramp.lo, ramp.center]) {
                const surface = stadiumExteriorSurface(
                    ...stadiumExteriorPoint(angle, t)
                );
                expect(surface.y).toBeCloseTo(38, 8);
                expect(surface.road).toBe(true);
            }
        }
    }
});
