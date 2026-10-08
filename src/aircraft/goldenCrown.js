import * as THREE from 'three';
import { createGoldenCrownNumber } from './goldenCrownNumber.js';

/** Original procedural Golden Crown F-5E study, informed by the IIAF archive
 * general USAF F-5E photographs and user-supplied livery references. The crown decal uses the user-supplied reference image.
 * Approximate 14.45 m length / 8.13 m span; +X forward, +Y up.
 * This is a visual model, not yet a selectable flight/physics type. */
export function createGoldenCrown() {
    const airplane = new THREE.Group();
    airplane.name = 'F-5E Tiger II · Golden Crown';
    const white = material(0xf4f2e9),
        red = material(0xc91e32),
        green = material(0x064a38);
    const dark = material(0x162127),
        metal = material(0x73818a, 0.65),
        rubber = material(0x14181b);
    const glass = new THREE.MeshPhysicalMaterial({
        color: 0x6b929c,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        metalness: 0.05,
        roughness: 0.14,
        clearcoat: 1
    });
    /** @param {number} color @param {number} [metalness] */
    function material(color, metalness = 0.15) {
        return new THREE.MeshStandardMaterial({
            color,
            metalness,
            roughness: 0.36,
            side: THREE.DoubleSide
        });
    }
    /** @param {THREE.BufferGeometry} geometry @param {THREE.Material} paint @param {number[]} [position] @param {THREE.Object3D} [parent] */
    function mesh(geometry, paint, position = [0, 0, 0], parent = airplane) {
        const m = new THREE.Mesh(geometry, paint);
        m.position.fromArray(position);
        m.castShadow = true;
        m.receiveShadow = true;
        parent.add(m);
        return m;
    }
    /** Thin solid surface, with points in aircraft coordinates.
     * @param {number[][]} points @param {THREE.Material} paint @param {number} [thickness] */
    function wing(points, paint, thickness = 0.065) {
        const shape = new THREE.Shape(
            points.map((p) => new THREE.Vector2(p[0], -p[1]))
        );
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: thickness,
            bevelEnabled: false
        });
        geo.rotateX(-Math.PI / 2);
        return mesh(geo, paint, [0, 1.38, 0]);
    }
    /** @param {number[][]} points @param {THREE.Material} paint @param {number} z */
    function fin(points, paint, z) {
        const shape = new THREE.Shape(
            points.map((p) => new THREE.Vector2(p[0], p[1]))
        );
        return mesh(new THREE.ShapeGeometry(shape), paint, [0, 0, z]);
    }
    /** @param {number[]} a @param {number[]} b @param {number} radius @param {THREE.Material} paint @param {THREE.Object3D} [parent] */
    function rod(a, b, radius, paint, parent = airplane) {
        const start = new THREE.Vector3(...a),
            end = new THREE.Vector3(...b),
            delta = end.clone().sub(start);
        const m = mesh(
            new THREE.CylinderGeometry(radius, radius, delta.length(), 12),
            paint,
            start.clone().add(end).multiplyScalar(0.5).toArray(),
            parent
        );
        m.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            delta.normalize()
        );
        return m;
    }
    // Continuous elliptical fuselage loft, avoiding stacked primitive seams.
    const stations = [
        [-6.8, 0.69, 0.4],
        [-5.8, 0.73, 0.49],
        [-4, 0.78, 0.62],
        [-2, 0.8, 0.65],
        [0, 0.71, 0.62],
        [1.8, 0.57, 0.61],
        [3.3, 0.46, 0.5],
        [4.6, 0.36, 0.38],
        [5.7, 0.24, 0.26],
        [6.7, 0.08, 0.11],
        [7.25, 0.008, 0.008]
    ];
    const positions = [],
        uvs = [],
        indices = [],
        segments = 64;
    for (let i = 0; i < stations.length; i++) {
        const [x, rz, ry] = stations[i];
        for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * Math.PI * 2;
            positions.push(
                x,
                1.64 + Math.sin(angle) * ry,
                Math.cos(angle) * rz
            );
            uvs.push((x + 7.25) / 14.5, j / segments);
            if (i && j) {
                const a = i * (segments + 1) + j,
                    b = a - segments - 1;
                indices.push(a - 1, b, b - 1, a - 1, a, b);
            }
        }
    }
    const bodyGeometry = new THREE.BufferGeometry();
    bodyGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    bodyGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    bodyGeometry.setIndex(indices);
    bodyGeometry.computeVertexNormals();
    const width = 2048,
        height = 1024,
        pixels = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
            const px = (x / (width - 1)) * 14.5 - 7.25,
                angle = (y / height) * Math.PI * 2;
            // +X points toward the nose. The side points sweep aft (-X),
            // with a crisp tip at each side and rounded wrapping over the top.
            const chevron = 0.9 * (1 - Math.abs(Math.sin(angle)));
            let color = [244, 242, 233];
            if (px > 5.15 - chevron * 0.55) color = [6, 74, 56];
            if (px > 6.0) color = [20, 25, 29];
            if (px > 3.55 - chevron && px < 4.72 - chevron)
                color = [201, 30, 50];
            if (
                px < 1.0 &&
                px > -6.3 &&
                Math.sin(angle) < -1 + 0.7 * Math.pow((1.0 - px) / 7.3, 2)
            )
                color = [201, 30, 50];
            if (px < -5.7 && px > -5.95) color = [201, 30, 50];
            if (px < -6.15 && px > -6.4) color = [6, 74, 56];
            pixels.set([...color, 255], (y * width + x) * 4);
        }
    const texture = new THREE.DataTexture(pixels, width, height);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    mesh(
        bodyGeometry,
        new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.32,
            metalness: 0.18,
            side: THREE.DoubleSide
        })
    );
    rod([7.2, 1.64, 0], [7.65, 1.64, 0], 0.014, metal);
    // F-5E's framed windscreen and raised single-seat hood, rather than a bubble.
    mesh(new THREE.SphereGeometry(1, 40, 24), dark, [2.25, 2.08, 0]).scale.set(
        1.36,
        0.09,
        0.43
    );
    const canopySections = [
        [0.92, 2.12, 0.04],
        [1.12, 2.6, 0.35],
        [1.5, 2.66, 0.4],
        [2.3, 2.58, 0.39],
        [2.65, 2.5, 0.34],
        [3.5, 2.09, 0.035]
    ];
    const canopyVertices = [],
        canopyIndices = [];
    for (let i = 0; i < canopySections.length; i++) {
        const [x, top, radius] = canopySections[i];
        for (let j = 0; j <= 24; j++) {
            const a = (j / 24) * Math.PI;
            canopyVertices.push(
                x,
                2.09 + Math.sin(a) * (top - 2.09),
                Math.cos(a) * radius
            );
            if (i && j) {
                const k = i * 25 + j;
                canopyIndices.push(k - 1, k, k - 25, k - 1, k - 25, k - 26);
            }
        }
    }
    const canopyGeometry = new THREE.BufferGeometry();
    canopyGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(canopyVertices, 3)
    );
    canopyGeometry.setIndex(canopyIndices);
    canopyGeometry.computeVertexNormals();
    mesh(canopyGeometry, glass);
    for (const [x, top, radius] of [canopySections[1], canopySections[4]]) {
        const frame = mesh(
            new THREE.TorusGeometry(1, 0.022, 8, 40, Math.PI),
            green,
            [x, 2.09, 0]
        );
        frame.rotation.y = Math.PI / 2;
        frame.scale.set(radius, top - 2.09, 1);
    }
    // Visible cockpit interior under the glazing.
    mesh(new THREE.SphereGeometry(1, 32, 12), dark, [2.05, 2.25, 0]).scale.set(
        1.0,
        0.035,
        0.36
    );
    mesh(new THREE.BoxGeometry(0.42, 0.34, 0.38), dark, [1.55, 2.26, 0]);
    mesh(new THREE.BoxGeometry(0.25, 0.15, 0.28), dark, [1.45, 2.5, 0]);
    mesh(new THREE.BoxGeometry(0.5, 0.07, 0.4), dark, [1.9, 2.14, 0]);
    mesh(new THREE.BoxGeometry(0.12, 0.19, 0.43), dark, [2.7, 2.23, 0]);
    for (const side of [-1, 1])
        rod([1.02, 2.1, side * 0.4], [2.67, 2.1, side * 0.35], 0.025, green);
    // Tapered dorsal fairing; green follows the spine behind the canopy.
    const spinePoints = [
        [-4.65, 2.19, 0],
        [-3, 2.31, 0.14],
        [-1, 2.4, 0.27],
        [0.95, 2.49, 0.34]
    ];
    const spineVertices = [],
        spineIndices = [];
    for (let i = 0; i < spinePoints.length; i++) {
        const [x, y, w] = spinePoints[i];
        for (let j = 0; j <= 16; j++) {
            const a = (j / 16) * Math.PI;
            spineVertices.push(
                x,
                2.12 + (y - 2.12) * Math.sin(a),
                Math.cos(a) * w
            );
            if (i && j) {
                const k = i * 17 + j;
                spineIndices.push(k - 1, k, k - 17, k - 1, k - 17, k - 18);
            }
        }
    }
    const spineGeometry = new THREE.BufferGeometry();
    spineGeometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(spineVertices, 3)
    );
    spineGeometry.setIndex(spineIndices);
    spineGeometry.computeVertexNormals();
    mesh(spineGeometry, green);
    const finOutline = [
        [-6.3, 1.85],
        [-5.82, 4.18],
        [-4.95, 4.18],
        [-3.25, 2.08]
    ];
    const finShape = new THREE.Shape(
        finOutline.map((p) => new THREE.Vector2(...p))
    );
    mesh(
        new THREE.ExtrudeGeometry(finShape, {
            depth: 0.09,
            bevelEnabled: false
        }),
        white,
        [0, 0, -0.045]
    );
    for (const side of [-1, 1]) {
        // Reference tail: broad rounded white number field, a pinched neck,
        // and a small white hook beneath the green cap.
        const sweep = new THREE.Shape();
        sweep.moveTo(-3.36, 2.1);
        sweep.lineTo(-4.76, 3.8);
        sweep.bezierCurveTo(-5.08, 3.88, -5.4, 3.98, -5.62, 4.03);
        sweep.bezierCurveTo(-5.26, 3.91, -5.05, 3.72, -5.62, 3.57);
        sweep.bezierCurveTo(-4.8, 3.47, -4.37, 2.36, -5.62, 2.02);
        sweep.lineTo(-6.22, 1.97);
        sweep.closePath();
        mesh(new THREE.ShapeGeometry(sweep), red, [0, 0, side * 0.051]);
        fin(
            [
                [-5.81, 4.18],
                [-4.95, 4.18],
                [-4.72, 3.89]
            ],
            green,
            side * 0.052
        );
        // F-5E trapezoidal planform and narrow spanwise tip bands.
        const s = side;
        wing(
            [
                [0.45, s * 0.62],
                [-1.95, s * 4.065],
                [-2.9, s * 4.065],
                [-3.27, s * 0.55]
            ],
            white
        );
        // Bands are near the tips, not diagonal rays across the wing.
        for (const offset of [0.068]) {
            for (const [inner, outer, paint] of [
                [3.3, 3.52, red],
                [3.82, 4.065, green]
            ]) {
                const lo = Number(inner),
                    hi = Number(outer);
                const leading = (/** @type {number} */ z) =>
                    0.45 + ((-1.95 - 0.45) * (z - 0.62)) / (4.065 - 0.62);
                const trailing = (/** @type {number} */ z) =>
                    -3.27 + (0.37 * (z - 0.55)) / (4.065 - 0.55);
                const stripe = wing(
                    [
                        [leading(lo), s * lo],
                        [leading(hi), s * hi],
                        [trailing(hi), s * hi],
                        [trailing(lo), s * lo]
                    ],
                    /** @type {THREE.Material} */ (paint),
                    0.006
                );
                stripe.position.y += offset;
            }
        }
        // Lower wing: broad swept green bands with a narrow white separator.
        wing(
            [
                [0.38, s * 0.7],
                [-1.97, s * 4.065],
                [-2.51, s * 4.065],
                [-1.42, s * 0.72]
            ],
            green,
            0.006
        ).position.y = 1.369;
        wing(
            [
                [-0.62, s * 0.7],
                [-2.29, s * 4.065],
                [-2.38, s * 4.065],
                [-0.78, s * 0.72]
            ],
            white,
            0.006
        ).position.y = 1.361;
        // Thin leading-edge root extension ahead of the main wing.
        wing(
            [
                [1.3, s * 0.59],
                [0.25, s * 1.08],
                [-0.7, s * 1.23],
                [-0.5, s * 0.59]
            ],
            white,
            0.04
        ).position.y = 1.57;
        wing(
            [
                [-4.1, s * 0.5],
                [-5.3, s * 2.38],
                [-6.2, s * 2.38],
                [-6.39, s * 0.42]
            ],
            white
        ).position.y = 1.48;
        for (const [lo, hi, paint] of [
            [1.73, 1.94, red],
            [2.16, 2.38, green]
        ]) {
            const a = Number(lo),
                b = Number(hi);
            const lead = (/** @type {number} */ z) =>
                -4.1 - (1.2 * (z - 0.5)) / 1.88;
            const trail = (/** @type {number} */ z) =>
                -6.39 + (0.19 * (z - 0.42)) / 1.96;
            wing(
                [
                    [lead(a), s * a],
                    [lead(b), s * b],
                    [trail(b), s * b],
                    [trail(a), s * a]
                ],
                /** @type {THREE.Material} */ (paint),
                0.006
            ).position.y = 1.55;
        }
        wing(
            [
                [-4.14, s * 0.54],
                [-5.31, s * 2.38],
                [-5.92, s * 2.38],
                [-5.65, s * 0.54]
            ],
            green,
            0.006
        ).position.y = 1.469;
        wing(
            [
                [-4.53, s * 0.54],
                [-5.62, s * 2.38],
                [-5.73, s * 2.38],
                [-5.28, s * 0.54]
            ],
            white,
            0.006
        ).position.y = 1.461;
        // Slender green wingtip rails extend beyond the narrow tip chord.
        // Taper both ends rather than leaving blunt cylinder caps.
        const railGeometry = new THREE.LatheGeometry(
            [
                [0, -1.3],
                [0.055, -1.13],
                [0.085, -0.87],
                [0.085, 0.9],
                [0.05, 1.15],
                [0, 1.3]
            ].map(([radius, x]) => new THREE.Vector2(radius, x)),
            12
        );
        railGeometry.rotateZ(-Math.PI / 2);
        mesh(railGeometry, green, [-2.15, 1.44, s * 4.065]);
        // Rounded rectangular intakes merge into the fuselage; no exposed tubes.
        const section = [
            [0.53, 1.22],
            [0.86, 1.22],
            [0.96, 1.33],
            [0.96, 1.85],
            [0.85, 1.98],
            [0.53, 1.98]
        ];
        const shellVertices = [],
            shellIndices = [];
        for (const [x, scale] of [
            [1.1, 1],
            [-0.1, 1.02],
            [-2.55, 0.65]
        ]) {
            for (const [z, y] of section)
                shellVertices.push(
                    x,
                    1.64 + (y - 1.64) * scale,
                    s * (0.5 + (z - 0.5) * scale)
                );
        }
        for (let row = 0; row < 2; row++)
            for (let i = 0; i < 6; i++) {
                const a = row * 6 + i,
                    b = row * 6 + ((i + 1) % 6);
                shellIndices.push(a, b, b + 6, a, b + 6, a + 6);
            }
        const shell = new THREE.BufferGeometry();
        shell.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(shellVertices, 3)
        );
        shell.setIndex(shellIndices);
        shell.computeVertexNormals();
        mesh(shell, white);
        const mouthShape = new THREE.Shape(
            section.map(([z, y]) => new THREE.Vector2(s * z, y))
        );
        const mouthGeometry = new THREE.ShapeGeometry(mouthShape);
        mouthGeometry.rotateY(-Math.PI / 2);
        // Rotation maps the section's horizontal coordinate into aircraft Z.
        mesh(mouthGeometry, dark, [1.105, 0, 0]);
        for (let i = 0; i < section.length; i++) {
            const [z, y] = section[i],
                [z2, y2] = section[(i + 1) % section.length];
            rod([1.12, y, s * z], [1.12, y2, s * z2], 0.025, white);
        }
        // Small Iranian roundel in the white gap between the tip bands.
        for (const [radius, paint, h] of [
            [0.07, green, 1.458],
            [0.046, white, 1.46],
            [0.025, red, 1.462]
        ]) {
            const roundel = mesh(
                new THREE.CircleGeometry(Number(radius), 32),
                /** @type {THREE.Material} */ (paint),
                [-2.45, Number(h), s * 3.67]
            );
            roundel.rotation.x = -Math.PI / 2;
        }
        // Two J85 engine exhausts with recessed openings and nozzle petals.
        const nozzle = mesh(
            new THREE.CylinderGeometry(0.32, 0.35, 0.62, 32, 1, true),
            metal,
            [-6.73, 1.56, s * 0.35]
        );
        nozzle.rotation.z = Math.PI / 2;
        const throat = mesh(new THREE.CircleGeometry(0.29, 32), dark, [
            -6.99,
            1.56,
            s * 0.35
        ]);
        throat.rotation.y = -Math.PI / 2;
        const rim = mesh(new THREE.TorusGeometry(0.32, 0.026, 8, 32), dark, [
            -7.045,
            1.56,
            s * 0.35
        ]);
        rim.rotation.y = Math.PI / 2;
        for (let p = 0; p < 16; p++) {
            const a = (p / 16) * Math.PI * 2;
            rod(
                [
                    -6.44,
                    1.56 + Math.sin(a) * 0.35,
                    s * 0.35 + Math.cos(a) * 0.35
                ],
                [
                    -7.04,
                    1.56 + Math.sin(a) * 0.32,
                    s * 0.35 + Math.cos(a) * 0.32
                ],
                0.009,
                dark
            );
        }
        // Fine control-surface seams.
        rod([-2.57, 1.454, s * 1.35], [-2.54, 1.454, s * 3.9], 0.007, metal);
    }
    // Fine panel seams, kept lighter than the markings.
    const panelMaterial = new THREE.LineBasicMaterial({
        color: 0x899693,
        transparent: true,
        opacity: 0.48
    });
    /** @param {number[][]} points */
    function seam(points) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
            points.map((p) => new THREE.Vector3(...p))
        );
        airplane.add(new THREE.Line(geometry, panelMaterial));
    }
    for (const side of [-1, 1]) {
        seam([
            [0.2, 1.452, side * 0.85],
            [-1.34, 1.452, side * 3.85]
        ]);
        seam([
            [-2.44, 1.452, side * 1.1],
            [-2.65, 1.452, side * 3.81]
        ]);
        seam([
            [-0.7, 1.452, side * 2.3],
            [-2.55, 1.452, side * 2.3]
        ]);
        seam([
            [-4.54, 1.553, side * 0.96],
            [-5.79, 1.553, side * 2.3]
        ]);
        seam([
            [-5.95, 2.13, side * 0.057],
            [-5.65, 3.88, side * 0.057]
        ]);
        for (let i = 0; i < 6; i++) {
            seam([
                [-3.65 - i * 0.065, 1.71, side * 0.799],
                [-3.65 - i * 0.065, 1.92, side * 0.76]
            ]);
        }
    }
    const gear = new THREE.Group();
    gear.name = 'Landing gear';
    airplane.add(gear);
    for (const [x, z] of [
        [3.45, 0],
        [-1.5, -1.18],
        [-1.5, 1.18]
    ]) {
        const radius = z ? 0.29 : 0.23;
        rod([x - 0.15, 1.35, z], [x, radius, z], 0.045, metal, gear);
        rod([x - 0.58, 1.28, z], [x - 0.02, 0.53, z], 0.023, metal, gear);
        const wheel = mesh(
            new THREE.TorusGeometry(radius * 0.72, radius * 0.28, 12, 32),
            rubber,
            [x, radius, z],
            gear
        );
        wheel.name = 'Wheel';
        const hub = mesh(
            new THREE.CylinderGeometry(radius * 0.47, radius * 0.47, 0.16, 24),
            metal,
            [x, radius, z],
            gear
        );
        hub.rotation.x = Math.PI / 2;
        mesh(
            new THREE.BoxGeometry(0.38, 0.55, 0.045),
            white,
            [x - 0.18, 1.05, z + (z ? Math.sign(z) * 0.1 : 0.12)],
            gear
        );
    }
    // Procedural lettering is generated only in browsers; geometry is Node-safe.
    if (typeof document !== 'undefined') {
        /** @param {string} text @param {number} width @param {number} height */
        function label(text, width, height) {
            const canvas = document.createElement('canvas');
            canvas.width = 1024;
            canvas.height = Math.round((1024 * height) / width);
            const ctx = canvas.getContext('2d');
            if (!ctx) return new THREE.MeshBasicMaterial({ visible: false });
            ctx.fillStyle = '#172128';
            ctx.direction = text.includes('نیروی') ? 'rtl' : 'ltr';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font =
                text === '1' || text === '۱'
                    ? `${canvas.height * 0.85}px "Times New Roman"`
                    : `bold ${canvas.height * 0.8}px Arial`;
            ctx.fillText(text, 512, canvas.height * 0.54, 990);
            const map = new THREE.CanvasTexture(canvas);
            map.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.MeshBasicMaterial({
                map,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            m.userData.labelSize = [width, height];
            return m;
        }
        // Use the supplied Pahlavi emblem unchanged. White paper is removed
        // only by the decal shader; fine gold and black artwork is retained.
        airplane.userData.markingsReady = false;
        const crownMap = new THREE.TextureLoader().load(
            `${import.meta.env.BASE_URL}textures/golden-crown/pahlavi-crown.png`,
            () => {
                airplane.userData.markingsReady = true;
            }
        );
        crownMap.colorSpace = THREE.SRGBColorSpace;
        const crownMaterial = new THREE.MeshBasicMaterial({
            map: crownMap,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        crownMaterial.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                if (min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b)) > 0.88) discard;
            `
            );
        };
        crownMaterial.customProgramCacheKey = () => 'pahlavi-paper-cutout-v1';
        for (const side of [-1, 1]) {
            const badge = mesh(
                new THREE.PlaneGeometry(0.51, 0.47),
                crownMaterial,
                [2.04, 1.82, side * 0.57]
            );
            badge.name = 'Pahlavi crown';
            badge.castShadow = false;
            badge.receiveShadow = false;
            if (side < 0) badge.rotation.y = Math.PI;
        }
        for (const side of [-1, 1]) {
            for (const [text, x, y, z, w, h] of [
                [
                    side < 0
                        ? 'IIAF GOLDEN CROWN'
                        : 'نیروی هوایی شاهنشاهی ایران (تاج طلایی)',
                    -1.0,
                    1.8,
                    0.99,
                    2.9,
                    0.26
                ],
                [side < 0 ? '3-7099' : '۳–۷۰۹۹', -5.12, 1.72, 0.77, 0.62, 0.14],
                [side < 0 ? '1' : '۱', -5.58, 2.78, 0.058, 0.68, 1.02]
            ]) {
                const marking = mesh(
                    new THREE.PlaneGeometry(Number(w), Number(h)),
                    Number(x) === -5.58
                        ? createGoldenCrownNumber(1, side)
                        : label(String(text), Number(w), Number(h)),
                    [Number(x), Number(y), side * Number(z)]
                );
                marking.name = String(text);
                if (Number(x) === -5.58) marking.userData.displayNumber = side;
                marking.castShadow = false;
                marking.receiveShadow = false;
                if (side < 0) marking.rotation.y = Math.PI;
            }
        }
    }
    airplane.userData.gear = gear;
    return { airplane, gear };
}
