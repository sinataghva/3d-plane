import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { updateMirage } from './mirage.js';

/** Original procedural Asia Minor-inspired camouflage, not a downloaded skin. */
export function createPhantomPaint() {
    const size = 512,
        pixels = new Uint8Array(size * size * 4);
    const colors = [
        [175, 151, 103],
        [104, 75, 47],
        [63, 78, 47]
    ];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            const u = (x / size) * Math.PI * 2,
                v = (y / size) * Math.PI * 2;
            const field =
                Math.sin(u * 2 + Math.cos(v) * 1.8) +
                Math.cos(v * 3 + Math.sin(u) * 1.4);
            // Keep the side-panel lettering inside a broad tan camouflage
            // patch on both sides. These UVs use the airframe projection below.
            const labelU = (x / size - 0.5075) / 0.085;
            const labelV =
                Math.min(
                    Math.abs(y / size - 0.434),
                    Math.abs(y / size - 0.689)
                ) / 0.055;
            const tanPanel =
                labelU * labelU + labelV * labelV <
                1 + 0.1 * Math.sin(v * 28 + u * 9);
            const color =
                colors[tanPanel ? 0 : field > 0.48 ? 2 : field < -0.48 ? 1 : 0];
            pixels.set([...color, 255], (y * size + x) * 4);
        }
    const map = new THREE.DataTexture(pixels, size, size);
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.needsUpdate = true;
    return map;
}

/** Procedural late-1970s IIAF F-4E. +X forward; the bombing system attaches
 * its eighteen stores and racks. The shared jet updater animates gear, brakes and exhausts. */
export function createPhantom() {
    const airplane = new THREE.Group();
    airplane.name = 'F-4 Phantom · Imperial Iranian Air Force';
    airplane.userData.jet = true;
    airplane.userData.chaseDistance = 30;
    airplane.userData.cockpitPosition = [4.4, 2.55, 0];
    const paint = new THREE.MeshStandardMaterial({
        map: createPhantomPaint(),
        roughness: 0.78,
        side: THREE.DoubleSide
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x222b2c,
        roughness: 0.65
    });
    const underside = new THREE.MeshStandardMaterial({
        color: 0xc0c0af,
        roughness: 0.8,
        side: THREE.DoubleSide
    });
    const noseGreen = new THREE.MeshStandardMaterial({
        color: 0x354630,
        roughness: 0.78,
        side: THREE.DoubleSide
    });
    const intakeBrown = new THREE.MeshStandardMaterial({
        color: 0x68503d,
        roughness: 0.82,
        side: THREE.DoubleSide
    });
    const intakeVoid = new THREE.MeshStandardMaterial({
        color: 0x101615,
        roughness: 0.95,
        side: THREE.DoubleSide
    });
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x6b929c,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        metalness: 0.05,
        roughness: 0.14,
        clearcoat: 1
    });
    /** @param {THREE.BufferGeometry} geometry @param {THREE.Material} material @param {number[]} p @param {THREE.Object3D} [parent] */
    function mesh(geometry, material, p, parent = airplane) {
        const m = new THREE.Mesh(geometry, material);
        m.position.set(p[0], p[1], p[2]);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }
    /** @param {number[][]} points @param {THREE.Material} [material] */
    function foil(points, material = paint) {
        const geometry = new THREE.BufferGeometry(),
            vertices = [],
            uv = [];
        for (let i = 1; i < points.length - 1; i++)
            for (const p of [points[0], points[i], points[i + 1]]) {
                vertices.push(...p);
                uv.push((p[0] + 10) / 20, (p[2] + 7) / 14);
            }
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        geometry.computeVertexNormals();
        return mesh(geometry, material, [0, 0, 0]);
    }
    /** Elliptical half-shell with shared station rings and continuous normals.
     * @param {number[][]} stations @param {number} start @param {number} end
     * @param {THREE.Material} material */
    function shell(stations, start, end, material) {
        const vertices = [],
            indices = [],
            segments = 24;
        for (const [x, y, ry, rz] of stations)
            for (let j = 0; j <= segments; j++) {
                const angle = start + ((end - start) * j) / segments;
                vertices.push(
                    x,
                    y + Math.sin(angle) * ry,
                    Math.cos(angle) * rz
                );
            }
        for (let i = 1; i < stations.length; i++)
            for (let j = 1; j <= segments; j++) {
                const a = i * (segments + 1) + j,
                    b = a - segments - 1;
                indices.push(a - 1, b, b - 1, a - 1, a, b);
            }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(vertices, 3)
        );
        geometry.setIndex(indices);
        geometry.computeVertexNormals();
        return mesh(geometry, material, [0, 0, 0]);
    }
    // The F-4's broad shoulders, deep intake trunk and long F-4E gun nose
    // are shaped as one continuous fuselage, rather than joined primitives.
    const stations = [
        [-8.15, 1.02, 0.52, 0.68],
        [-7.1, 1.05, 0.76, 0.98],
        [-5.4, 1.08, 0.84, 1.18],
        [-3.5, 1.08, 0.9, 1.42],
        [-1.2, 1.08, 0.94, 1.47],
        [1.0, 1.15, 0.83, 1.25],
        [3.25, 1.18, 0.69, 0.98],
        [4.6, 1.1, 0.6, 0.8],
        [5.25, 1.08, 0.57, 0.73],
        [6.75, 1.02, 0.4, 0.51],
        [7.2, 1.0, 0.31, 0.39]
    ];
    const intakeStations = [
        [-2.6, 0.94, 1.08, 0.34, 0.29],
        [-0.8, 0.9, 1.19, 0.44, 0.35],
        [1.7, 0.88, 1.17, 0.47, 0.34],
        [3.5, 0.88, 1.1, 0.46, 0.32]
    ];
    // Conform markings to the outer skin, including the engine fairings.
    /** @param {number} x @param {number} y */
    function skinZ(x, y) {
        const i = Math.max(
            1,
            stations.findIndex((station) => station[0] >= x)
        );
        const a = stations[i - 1],
            b = stations[i];
        const t = THREE.MathUtils.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
        const cy = THREE.MathUtils.lerp(a[1], b[1], t);
        const ry = THREE.MathUtils.lerp(a[2], b[2], t);
        const rz = THREE.MathUtils.lerp(a[3], b[3], t);
        let z = rz * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
        if (x >= -7.65 && x <= -3.95) {
            const r = THREE.MathUtils.lerp(0.67, 0.82, (x + 7.65) / 3.7);
            if (Math.abs(y - 0.9) < r)
                z = Math.max(z, 0.65 + Math.sqrt(r * r - (y - 0.9) ** 2));
        }
        if (x >= intakeStations[0][0] && x <= intakeStations[3][0]) {
            const j = Math.max(
                1,
                intakeStations.findIndex((row) => row[0] >= x)
            );
            const a = intakeStations[j - 1],
                b = intakeStations[j];
            const t = (x - a[0]) / (b[0] - a[0]);
            const cy = THREE.MathUtils.lerp(a[1], b[1], t);
            const cz = THREE.MathUtils.lerp(a[2], b[2], t);
            const hy = THREE.MathUtils.lerp(a[3], b[3], t);
            const hz = THREE.MathUtils.lerp(a[4], b[4], t);
            const dy = Math.abs((y - cy) / hy);
            if (dy <= 1)
                z = Math.max(
                    z,
                    cz + hz * (1 - (Math.max(0, dy - 0.82) / 0.18) * 0.22)
                );
        }
        return z + 0.012;
    }
    /** @param {THREE.BufferGeometry} geometry @param {number} side */
    function conformMarking(geometry, side) {
        const positions = geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++)
            positions.setZ(
                i,
                side * skinZ(positions.getX(i), positions.getY(i))
            );
        geometry.computeVertexNormals();
    }
    shell(stations.slice(0, 8), 0, Math.PI, paint);
    shell(stations.slice(0, 8), Math.PI, Math.PI * 2, underside);
    // The period IIAF photo shows a dark green nose behind the black radome.
    shell(stations.slice(7), 0, Math.PI * 2, noseGreen);
    const radome = [
        [7.19, 1.0, 0.31, 0.39],
        [8.2, 1.0, 0.22, 0.27],
        [9.1, 1.0, 0.1, 0.12],
        [9.7, 1.0, 0.012, 0.012]
    ];
    shell(radome, 0, Math.PI * 2, dark);
    // A shallow chin fairing merges into the nose underside. The M61 housing
    // is not a separate cylindrical pod hanging below the fuselage.
    const gun = shell(
        [
            [4.2, 0.59, 0.035, 0.07],
            [4.7, 0.58, 0.1, 0.17],
            [5.4, 0.58, 0.13, 0.21],
            [6.6, 0.63, 0.13, 0.2],
            [7.5, 0.69, 0.1, 0.16]
        ],
        0,
        Math.PI * 2,
        underside
    );
    gun.name = 'F-4E gun fairing';
    const muzzle = shell(
        [
            [7.5, 0.69, 0.1, 0.16],
            [7.72, 0.7, 0.085, 0.14],
            [7.76, 0.7, 0.015, 0.025]
        ],
        0,
        Math.PI * 2,
        dark
    );
    muzzle.name = 'F-4E gun muzzle';
    const noseProbe = shell(
        [
            [9.68, 1.0, 0.012, 0.012],
            [10.05, 1.0, 0.002, 0.002]
        ],
        0,
        Math.PI * 2,
        dark
    );
    noseProbe.name = 'Nose probe';
    const canopy = new THREE.Group();
    airplane.add(canopy);
    // The two closed hoods share one flowing roof line, rising aft from the
    // windscreen and blending into the spine without a dip between the seats.
    /** Upper skin height at a canopy attachment point.
     * @param {number} x @param {number} z */
    function cockpitSkinY(x, z) {
        const i = Math.max(
            1,
            stations.findIndex((row) => row[0] >= x)
        );
        const a = stations[i - 1],
            b = stations[i];
        const t = (x - a[0]) / (b[0] - a[0]);
        const height = (/** @type {number[]} */ row) =>
            row[1] + row[2] * Math.sqrt(Math.max(0, 1 - (z / row[3]) ** 2));
        return THREE.MathUtils.lerp(height(a), height(b), t);
    }
    // The cockpit floor follows the nose instead of forming a floating shelf.
    const deckGeometry = new THREE.SphereGeometry(1, 32, 16);
    deckGeometry.scale(2.3, 0.007, 0.47);
    const deckPositions = deckGeometry.getAttribute('position');
    for (let i = 0; i < deckPositions.count; i++) {
        const x = 2.05 + deckPositions.getX(i),
            z = deckPositions.getZ(i);
        deckPositions.setXYZ(
            i,
            x,
            cockpitSkinY(x, z) + deckPositions.getY(i),
            z
        );
    }
    deckGeometry.computeVertexNormals();
    mesh(deckGeometry, dark, [0, 0, 0], canopy);
    const glazing = [
        [-0.4, 1.86, 0.16, 0.32],
        [0.1, 1.86, 0.43, 0.53],
        [1.05, 1.86, 0.55, 0.58],
        [1.65, 1.86, 0.55, 0.59],
        [2.08, 1.86, 0.53, 0.58],
        [2.45, 1.86, 0.5, 0.56],
        [3.05, 1.86, 0.43, 0.52],
        [3.65, 1.86, 0.32, 0.46],
        [4.12, 1.86, 0.18, 0.34],
        [4.65, 1.86, 0.025, 0.03]
    ];
    for (let i = 0; i < glazing.length; i++) {
        const row = glazing[i];
        const roof = row[1] + row[2];
        row[1] = cockpitSkinY(row[0], row[3]) - 0.018;
        row[2] =
            i === glazing.length - 1 ? 0.012 : Math.max(0.012, roof - row[1]);
    }
    const glazingMesh = shell(glazing, 0, Math.PI, glass);
    glazingMesh.name = 'Tandem canopy glazing';
    glazingMesh.castShadow = false;
    glazingMesh.renderOrder = 2;
    airplane.remove(glazingMesh);
    canopy.add(glazingMesh);
    for (const [x, y, radiusY, radiusZ] of [
        glazing[1],
        glazing[4],
        glazing[7]
    ]) {
        const frame = mesh(
            new THREE.TorusGeometry(1, 0.022, 8, 40, Math.PI),
            dark,
            [x, y, 0],
            canopy
        );
        frame.rotation.y = Math.PI / 2;
        frame.scale.set(radiusZ, radiusY, 1);
    }
    for (const x of [0.9, 3.15]) {
        mesh(
            new THREE.BoxGeometry(0.34, 0.28, 0.32),
            dark,
            [x, 2.04, 0],
            canopy
        );
        mesh(
            new THREE.BoxGeometry(0.22, 0.12, 0.22),
            dark,
            [x - 0.12, x > 2 ? 2.17 : 2.25, 0],
            canopy
        );
    }
    const flame = new THREE.Group();
    airplane.add(flame);
    flame.visible = false;
    flame.name = 'Twin afterburners';
    for (const side of [-1, 1]) {
        // Rounded intake trunks taper into the wing root behind their lips.
        const intakeVertices = [],
            intakeIndices = [];
        const intakeProfile = [
            [-0.82, -1],
            [0.82, -1],
            [1, -0.78],
            [1, 0.78],
            [0.82, 1],
            [-0.82, 1],
            [-1, 0.78],
            [-1, -0.78]
        ];
        for (const [x, y, z, halfY, halfZ] of intakeStations)
            for (const [dy, dz] of intakeProfile)
                intakeVertices.push(x, y + dy * halfY, side * (z + dz * halfZ));
        for (let row = 0; row < intakeStations.length - 1; row++)
            for (let j = 0; j < intakeProfile.length; j++) {
                const a = row * intakeProfile.length + j,
                    b =
                        row * intakeProfile.length +
                        ((j + 1) % intakeProfile.length);
                // Mirroring positions reverses winding. Keep the normals
                // outward on both sides for correct shadow-map bias.
                if (side > 0) intakeIndices.push(a, b, b + 8, a, b + 8, a + 8);
                else intakeIndices.push(a, b + 8, b, a, a + 8, b + 8);
            }
        const intakeGeometry = new THREE.BufferGeometry();
        intakeGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(intakeVertices, 3)
        );
        intakeGeometry.setIndex(intakeIndices);
        intakeGeometry.computeVertexNormals();
        const intake = mesh(intakeGeometry, paint, [0, 0, 0]);
        intake.name = 'Intake trunk';
        intake.userData.side = side;
        // An octagonal face follows the trunk's rounded corners. Its thin
        // frame avoids the detached, oversized square-box silhouette.
        foil(
            intakeProfile.map(([dy, dz]) => [
                3.565,
                0.88 + dy * 0.39,
                side * (1.1 + dz * 0.27)
            ]),
            intakeVoid
        );
        const rimVertices = [];
        for (let j = 0; j < intakeProfile.length; j++) {
            const [ay, az] = intakeProfile[j],
                [by, bz] = intakeProfile[(j + 1) % intakeProfile.length];
            const outerA = [3.575, 0.88 + ay * 0.46, side * (1.1 + az * 0.32)],
                outerB = [3.575, 0.88 + by * 0.46, side * (1.1 + bz * 0.32)],
                innerA = [3.575, 0.88 + ay * 0.39, side * (1.1 + az * 0.27)],
                innerB = [3.575, 0.88 + by * 0.39, side * (1.1 + bz * 0.27)];
            rimVertices.push(...outerA, ...outerB, ...innerB);
            rimVertices.push(...outerA, ...innerB, ...innerA);
        }
        const rimGeometry = new THREE.BufferGeometry();
        rimGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(rimVertices, 3)
        );
        rimGeometry.computeVertexNormals();
        mesh(rimGeometry, intakeBrown, [0, 0, 0]);
        // The prominent splitter face carries the brown camouflage seen in
        // period IIAF photos and the IIAF Museum F-4E scale-model closeups.
        const splitter = mesh(
            new THREE.BoxGeometry(2.4, 0.86, 0.045),
            intakeBrown,
            [2.44, 0.88, side * 0.76]
        );
        splitter.rotation.y = side * -0.035;
        const rear = mesh(
            new THREE.CylinderGeometry(0.67, 0.82, 3.7, 20),
            paint,
            [-5.8, 0.9, side * 0.65]
        );
        rear.rotation.z = Math.PI / 2;
        const nozzle = mesh(
            new THREE.CylinderGeometry(0.58, 0.66, 1, 20, 1, true),
            dark,
            [-7.85, 0.9, side * 0.65]
        );
        nozzle.rotation.z = Math.PI / 2;
        const throat = mesh(new THREE.CircleGeometry(0.56, 20), dark, [
            -8.36,
            0.9,
            side * 0.65
        ]);
        throat.rotation.y = -Math.PI / 2;
        for (const [r, length, color, opacity] of [
            [0.55, 4, 0xff571c, 0.55],
            [0.3, 2.7, 0xffd18b, 0.9]
        ]) {
            const m = mesh(
                new THREE.ConeGeometry(r, length, 16),
                new THREE.MeshBasicMaterial({
                    color,
                    opacity,
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                }),
                [-8.4 - length / 2, 0.9, side * 0.65],
                flame
            );
            m.rotation.z = Math.PI / 2;
            m.castShadow = false;
        }
        foil([
            [2, 0.65, side * 0.7],
            [-1.8, 0.65, side * 4.1],
            [-5, 0.65, side * 4.1],
            [-4.4, 0.65, side * 0.7]
        ]);
        foil(
            [
                [2, 0.625, side * 0.7],
                [-1.8, 0.625, side * 4.1],
                [-5, 0.625, side * 4.1],
                [-4.4, 0.625, side * 0.7]
            ],
            underside
        );
        foil([
            [-1.8, 0.65, side * 4.1],
            [-3.5, 1.2, side * 5.85],
            [-5.4, 1.2, side * 5.85],
            [-5, 0.65, side * 4.1]
        ]);
        foil(
            [
                [-1.8, 0.625, side * 4.1],
                [-3.5, 1.175, side * 5.85],
                [-5.4, 1.175, side * 5.85],
                [-5, 0.625, side * 4.1]
            ],
            underside
        );
        foil([
            [-5.3, 1.15, side * 0.65],
            [-7.1, 0.15, side * 3.2],
            [-8.7, 0.15, side * 3.2],
            [-7.8, 1.15, side * 0.65]
        ]);
        foil(
            [
                [-5.3, 1.125, side * 0.65],
                [-7.1, 0.125, side * 3.2],
                [-8.7, 0.125, side * 3.2],
                [-7.8, 1.125, side * 0.65]
            ],
            underside
        );
        // Thin control-surface edges and leading-edge breaks remain legible in
        // the chase camera without making the whole wing a dense mesh.
        for (const points of [
            [
                [0.7, 0.668, side * 1.65],
                [-2.2, 0.668, side * 4.05]
            ],
            [
                [-3.75, 0.669, side * 0.9],
                [-4.55, 0.669, side * 4.1]
            ],
            [
                [-4.95, 1.22, side * 4.13],
                [-5.23, 1.22, side * 5.8]
            ],
            [
                [-7.3, 0.17, side * 1.55],
                [-8.12, 0.17, side * 3.16]
            ]
        ]) {
            const seam = new THREE.Line(
                new THREE.BufferGeometry().setFromPoints(
                    points.map((p) => new THREE.Vector3(...p))
                ),
                new THREE.LineBasicMaterial({ color: 0x494637 })
            );
            airplane.add(seam);
        }
        // Green outer ring, white middle and red center; no post-1979 emblem.
        for (const [r, color, h] of [
            [0.58, 0x176b38, 0.69],
            [0.39, 0xf3f1df, 0.7],
            [0.2, 0xbd302c, 0.71]
        ]) {
            const circle = mesh(
                new THREE.CircleGeometry(r, 32),
                new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
                [-2.6, h, side * 3]
            );
            circle.rotation.x = -Math.PI / 2;
            circle.name = 'Iranian roundel';
        }
        for (const [inner, outer, color] of [
            [0.2, 0.3, 0x176b38],
            [0.1, 0.2, 0xf3f1df],
            [0, 0.1, 0xbd302c]
        ]) {
            const geometry = new THREE.RingGeometry(inner, outer, 64, 6);
            geometry.translate(-5.4, 1.3, 0);
            conformMarking(geometry, side);
            const roundel = mesh(
                geometry,
                new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
                [0, 0, 0]
            );
            roundel.name = 'Fuselage roundel';
            roundel.castShadow = false;
        }
    }
    const fin = new THREE.Shape([
        new THREE.Vector2(-7.8, 1),
        new THREE.Vector2(-7.6, 4.7),
        new THREE.Vector2(-5.7, 4.7),
        new THREE.Vector2(-3.4, 1)
    ]);
    mesh(
        new THREE.ExtrudeGeometry(fin, { depth: 0.14, bevelEnabled: false }),
        paint,
        [0, 0, -0.07]
    );
    // Period-style tricolor fin flash; IIAF letters belong on the fuselage
    // behind the intakes, as seen in the 1977 Shiraz photograph.
    // Continuous vector outlines keep the narrow block letters sharp at any zoom.
    const glyphs = {
        I: [
            [
                [0, 0],
                [0.065, 0],
                [0.065, 0.36],
                [0, 0.36]
            ]
        ],
        A: [
            [
                [0, 0],
                [0.07, 0],
                [0.115, 0.27],
                [0.16, 0],
                [0.23, 0],
                [0.16, 0.36],
                [0.07, 0.36]
            ],
            [
                [0.06, 0.1],
                [0.17, 0.1],
                [0.17, 0.16],
                [0.06, 0.16]
            ]
        ],
        F: [
            [
                [0, 0],
                [0.065, 0],
                [0.065, 0.15],
                [0.17, 0.15],
                [0.17, 0.21],
                [0.065, 0.21],
                [0.065, 0.3],
                [0.21, 0.3],
                [0.21, 0.36],
                [0, 0.36]
            ]
        ]
    };
    const lettering = new THREE.MeshBasicMaterial({
        color: 0x171b17,
        side: THREE.DoubleSide
    });
    for (const side of [-1, 1]) {
        for (const [index, color] of [0x22834d, 0xf4f2dc, 0xb83931].entries())
            mesh(
                new THREE.BoxGeometry(1.05, 0.24, 0.015),
                new THREE.MeshBasicMaterial({ color }),
                [-6.45, 4.15 - index * 0.24, side * 0.081]
            );
        const label = new THREE.Group();
        label.name = 'IIAF';
        airplane.add(label);
        let offset = 0;
        for (const char of 'IIAF') {
            const outlines = glyphs[/** @type {keyof typeof glyphs} */ (char)];
            for (const outline of outlines) {
                const shape = new THREE.Shape(
                    outline.map(
                        ([x, y]) =>
                            new THREE.Vector2(
                                0.15 + side * (offset + x - 0.36),
                                0.84 + y
                            )
                    )
                );
                const outlineGeometry = new THREE.ShapeGeometry(shape);
                const geometry = new TessellateModifier(0.045, 6).modify(
                    outlineGeometry
                );
                outlineGeometry.dispose();
                conformMarking(geometry, side);
                const letter = mesh(geometry, lettering, [0, 0, 0], label);
                letter.castShadow = false;
            }
            offset += char === 'I' ? 0.13 : 0.29;
        }
    }
    const gear = new THREE.Group(),
        gearLegs = [];
    airplane.add(gear);
    for (const [x, z] of [
        [4, 0],
        [-1.5, -1.7],
        [-1.5, 1.7]
    ]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.5, z);
        leg.userData.side = Math.sign(z);
        gear.add(leg);
        gearLegs.push(leg);
        mesh(
            new THREE.CylinderGeometry(0.07, 0.07, 0.9, 8),
            underside,
            [0, -0.4, 0],
            leg
        );
        for (const wheelZ of z ? [0] : [-0.17, 0.17]) {
            const wheel = mesh(
                new THREE.CylinderGeometry(0.28, 0.28, z ? 0.25 : 0.16, 20),
                dark,
                [0, -0.72, wheelZ],
                leg
            );
            wheel.rotation.x = Math.PI / 2;
            const hub = mesh(
                new THREE.CircleGeometry(0.12, 16),
                underside,
                [0, -0.72, wheelZ + (z ? Math.sign(z) : 1) * 0.13],
                leg
            );
            hub.rotation.y = Math.PI / 2;
        }
        const door = mesh(
            new THREE.BoxGeometry(z ? 1.2 : 1.35, 0.055, z ? 0.36 : 0.3),
            underside,
            [-0.24, -0.15, z ? Math.sign(z) * 0.29 : 0.46],
            leg
        );
        door.rotation.x = z ? Math.sign(z) * 0.42 : 0.3;
        const brace = mesh(
            new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8),
            underside,
            [-0.25, -0.3, 0],
            leg
        );
        brace.rotation.z = -0.58;
    }
    const elevons = [-1, 1].map((side) =>
        mesh(new THREE.BoxGeometry(0.6, 0.09, 2), paint, [
            -4.7,
            0.64,
            side * 2.6
        ])
    );
    const brakes = [-1, 1].map((side) =>
        mesh(new THREE.BoxGeometry(1.1, 0.08, 0.7), paint, [
            -1,
            0.72,
            side * 1.8
        ])
    );
    const propeller = new THREE.Group();
    airplane.add(propeller);
    airplane.userData.jetParts = {
        gear,
        gearLegs,
        flame,
        elevons,
        brakes,
        canopy
    };
    // Project one camouflage field over the whole airframe, avoiding a repeated
    // tiny pattern on each intake/fin extrusion's automatically generated UVs.
    airplane.updateMatrixWorld(true);
    const point = new THREE.Vector3();
    airplane.traverse((object) => {
        if (!(object instanceof THREE.Mesh) || object.material !== paint)
            return;
        const positions = object.geometry.getAttribute('position');
        const uv = new Float32Array(positions.count * 2);
        for (let i = 0; i < positions.count; i++) {
            point
                .fromBufferAttribute(positions, i)
                .applyMatrix4(object.matrixWorld);
            uv[i * 2] = (point.x + 10) / 20;
            uv[i * 2 + 1] = (point.z + 6) / 12 + point.y * 0.06;
        }
        object.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    });
    return { airplane, propeller };
}
// Both jets intentionally share arcade systems; this is not a flight-training model.
export const updatePhantom = updateMirage;
