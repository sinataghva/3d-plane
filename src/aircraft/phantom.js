import * as THREE from 'three';
import { updateMirage } from './mirage.js';

/** Original procedural Asia Minor-inspired camouflage, not a downloaded skin. */
export function createPhantomPaint() {
    const size = 128,
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
            const color = colors[field > 0.48 ? 2 : field < -0.48 ? 1 : 0];
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

/** Stylized IIAF Phantom: twin engines, tandem canopy, raised outer wings and
 * drooped stabilators. No gun, stores or bomb behavior.
 * +X forward; shared jet gear, controls and exhaust animation contract. */
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
        roughness: 0.8
    });
    const glass = new THREE.MeshStandardMaterial({
        color: 0x638c9b,
        roughness: 0.18,
        metalness: 0.55
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
    const body = mesh(
        new THREE.CylinderGeometry(0.85, 1.12, 10.5, 24),
        paint,
        [0.2, 1.05, 0]
    );
    body.rotation.z = -Math.PI / 2;
    body.scale.z = 1.12;
    const nose = mesh(
        new THREE.ConeGeometry(0.85, 4.5, 24),
        dark,
        [7.65, 0.95, 0]
    );
    nose.rotation.z = -Math.PI / 2;
    mesh(new THREE.BoxGeometry(8, 0.32, 1.8), underside, [-0.4, 0.16, 0]);
    const canopy = new THREE.Group();
    airplane.add(canopy);
    // One continuous glazing envelope over both seats, with transverse frames
    // rather than two separate bubble shapes with a dip between them.
    mesh(
        new THREE.SphereGeometry(1, 32, 16),
        glass,
        [2.7, 1.91, 0],
        canopy
    ).scale.set(2.65, 0.81, 0.65);
    for (const x of [1.6, 3.7]) {
        const frame = mesh(
            new THREE.TorusGeometry(1, 0.045, 6, 24, Math.PI),
            dark,
            [x, 1.91, 0],
            canopy
        );
        frame.rotation.y = Math.PI / 2;
        const section = Math.sqrt(1 - ((x - 2.7) / 2.65) ** 2);
        frame.scale.set(0.65 * section, 0.81 * section, 1);
    }
    const flame = new THREE.Group();
    airplane.add(flame);
    flame.visible = false;
    flame.name = 'Twin afterburners';
    for (const side of [-1, 1]) {
        mesh(new THREE.BoxGeometry(3.9, 1.25, 0.8), paint, [
            1.55,
            0.85,
            side * 1.12
        ]);
        mesh(new THREE.BoxGeometry(0.07, 0.95, 0.64), dark, [
            3.54,
            0.88,
            side * 1.12
        ]);
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
        foil([
            [-1.8, 0.65, side * 4.1],
            [-3.5, 1.2, side * 5.85],
            [-5.4, 1.2, side * 5.85],
            [-5, 0.65, side * 4.1]
        ]);
        foil([
            [-5.3, 1.15, side * 0.65],
            [-7.1, 0.15, side * 3.2],
            [-8.7, 0.15, side * 3.2],
            [-7.8, 1.15, side * 0.65]
        ]);
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
        for (const [r, color] of [
            [0.38, 0x176b38],
            [0.26, 0xf3f1df],
            [0.13, 0xbd302c]
        ]) {
            const circle = mesh(
                new THREE.CircleGeometry(r, 24),
                new THREE.MeshBasicMaterial({ color }),
                [-3, 1.05, side * (1.08 + (0.4 - r) * 0.01)]
            );
            circle.rotation.y = side > 0 ? 0 : Math.PI;
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
    // Period-style plain tricolor fin flash, and readable IIAF letters on both sides.
    const glyphs = {
        I: ['111', '010', '010', '010', '111'],
        A: ['010', '101', '111', '101', '101'],
        F: ['111', '100', '110', '100', '100']
    };
    for (const side of [-1, 1]) {
        for (const [index, color] of [0x22834d, 0xf4f2dc, 0xb83931].entries())
            mesh(
                new THREE.BoxGeometry(1.05, 0.24, 0.015),
                new THREE.MeshBasicMaterial({ color }),
                [-6.45, 4.15 - index * 0.24, side * 0.081]
            );
        const label = new THREE.Group();
        label.name = 'IIAF';
        label.position.set(side > 0 ? -7.35 : -4.95, 2.7, side * 0.09);
        label.rotation.y = side > 0 ? 0 : Math.PI;
        airplane.add(label);
        for (const [i, char] of [...'IIAF'].entries())
            for (const [row, bits] of glyphs[
                /** @type {keyof typeof glyphs} */ (char)
            ].entries())
                for (let col = 0; col < bits.length; col++)
                    if (bits[col] === '1')
                        mesh(
                            new THREE.BoxGeometry(0.1, 0.1, 0.015),
                            dark,
                            [i * 0.5 + col * 0.11, -row * 0.11, 0],
                            label
                        );
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
        const wheel = mesh(
            new THREE.CylinderGeometry(0.28, 0.28, 0.25, 16),
            dark,
            [0, -0.72, 0],
            leg
        );
        wheel.rotation.x = Math.PI / 2;
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
