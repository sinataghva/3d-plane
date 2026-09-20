import * as THREE from 'three';
/** Game-native stylized Mirage 2000; +X is forward, shared with the light aircraft. */
export function createMirage() {
    const airplane = new THREE.Group();
    airplane.name = 'Mirage 2000';
    airplane.userData.jet = true;
    const paint = new THREE.MeshStandardMaterial({
        color: 0x8195a3,
        emissive: 0x24343c,
        emissiveIntensity: 0.3,
        roughness: 0.7,
        metalness: 0.25
    });
    const dark = new THREE.MeshStandardMaterial({
        color: 0x26333d,
        roughness: 0.65
    });
    const glass = new THREE.MeshStandardMaterial({
        color: 0x548da5,
        metalness: 0.65,
        roughness: 0.12
    });
    /** @param {THREE.BufferGeometry} geometry @param {THREE.Material} material @param {number[]} pos */
    function mesh(geometry, material, pos) {
        const m = new THREE.Mesh(geometry, material);
        m.position.set(pos[0], pos[1], pos[2]);
        m.castShadow = true;
        airplane.add(m);
        return m;
    }
    const body = mesh(
        new THREE.CylinderGeometry(0.64, 0.85, 7.5, 16),
        paint,
        [0, 0.85, 0]
    );
    body.rotation.z = -Math.PI / 2;
    const nose = mesh(
        new THREE.ConeGeometry(0.64, 3.5, 16),
        dark,
        [5.5, 0.85, 0]
    );
    nose.rotation.z = -Math.PI / 2;
    const rear = mesh(
        new THREE.CylinderGeometry(0.85, 0.56, 2.2, 24, 1, true),
        paint,
        [-4.8, 0.85, 0]
    );
    rear.rotation.z = -Math.PI / 2;
    const exhaust = mesh(
        new THREE.CylinderGeometry(0.54, 0.6, 0.7, 16, 1, true),
        dark,
        [-6, 0.85, 0]
    );
    exhaust.rotation.z = -Math.PI / 2;
    // End the recessed chamber aft of the fin root (-5.5) and wings,
    // so their internal geometry cannot be seen through the nozzle.
    const interior = mesh(
        new THREE.CylinderGeometry(0.38, 0.5, 0.75, 24, 1, true),
        new THREE.MeshStandardMaterial({
            color: 0x14191d,
            roughness: 0.95,
            side: THREE.BackSide
        }),
        [-5.975, 0.85, 0]
    );
    interior.rotation.z = -Math.PI / 2;
    const throat = mesh(
        new THREE.CircleGeometry(0.38, 24),
        new THREE.MeshBasicMaterial({ color: 0x050709 }),
        [-5.6, 0.85, 0]
    );
    throat.rotation.y = -Math.PI / 2;
    const lip = mesh(
        new THREE.RingGeometry(0.5, 0.6, 24),
        dark,
        [-6.35, 0.85, 0]
    );
    lip.rotation.y = -Math.PI / 2;

    const canopy = mesh(
        new THREE.SphereGeometry(1, 20, 12),
        glass,
        [2.1, 1.52, 0]
    );
    canopy.scale.set(1.75, 0.64, 0.55);
    /** @param {number[][]} points @param {number} thickness */
    function foil(points, thickness) {
        const shape = new THREE.Shape(
            points.map((p) => new THREE.Vector2(p[0], p[1]))
        );
        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: thickness,
            bevelEnabled: false
        });
        geo.rotateX(Math.PI / 2);
        return geo;
    }
    mesh(
        foil(
            [
                [3.4, 0],
                [-4.5, 4.5],
                [-4.8, 0]
            ],
            0.12
        ),
        paint,
        [0, 0.65, 0]
    );
    mesh(
        foil(
            [
                [3.4, 0],
                [-4.8, 0],
                [-4.5, -4.5]
            ],
            0.12
        ),
        paint,
        [0, 0.65, 0]
    );
    const finShape = new THREE.Shape([
        new THREE.Vector2(-5.5, 1),
        new THREE.Vector2(-5.1, 4.2),
        new THREE.Vector2(-3.4, 4.2),
        new THREE.Vector2(-1.8, 1)
    ]);
    mesh(
        new THREE.ExtrudeGeometry(finShape, {
            depth: 0.12,
            bevelEnabled: false
        }),
        paint,
        [0, 0, -0.06]
    );
    for (const side of [-1, 1]) {
        mesh(new THREE.BoxGeometry(1.7, 0.75, 0.6), paint, [
            0.9,
            0.65,
            side * 0.8
        ]);
        mesh(new THREE.BoxGeometry(0.06, 0.53, 0.48), dark, [
            1.77,
            0.65,
            side * 0.8
        ]);
        const roundel = mesh(
            new THREE.CircleGeometry(0.32, 24),
            new THREE.MeshBasicMaterial({ color: 0xe64339 }),
            [-2.6, 0.67, side * 2.7]
        );
        roundel.rotation.x = -Math.PI / 2;
        const white = mesh(
            new THREE.CircleGeometry(0.22, 24),
            new THREE.MeshBasicMaterial({ color: 0xffffff }),
            [-2.6, 0.68, side * 2.7]
        );
        white.rotation.x = -Math.PI / 2;
        const blue = mesh(
            new THREE.CircleGeometry(0.12, 24),
            new THREE.MeshBasicMaterial({ color: 0x174b9b }),
            [-2.6, 0.69, side * 2.7]
        );
        blue.rotation.x = -Math.PI / 2;
    }
    const gear = new THREE.Group();
    airplane.add(gear);
    const gearLegs = [];
    for (const [x, z] of [
        [3.3, 0],
        [-1.8, -1.2],
        [-1.8, 1.2]
    ]) {
        const leg = new THREE.Group();
        leg.position.set(x, 0.45, z);
        leg.userData.side = Math.sign(z);
        gear.add(leg);
        gearLegs.push(leg);
        const strut = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 0.9, 8),
            paint
        );
        strut.position.set(0, -0.45, 0);
        leg.add(strut);
        const wheel = new THREE.Mesh(
            new THREE.CylinderGeometry(0.23, 0.23, 0.2, 12),
            dark
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(0, -0.72, 0);
        leg.add(wheel);
    }
    const flame = new THREE.Group();
    flame.name = 'afterburner';
    flame.position.set(-6.4, 0.85, 0);
    airplane.add(flame);
    flame.visible = false;
    for (const [radius, length, color, opacity] of [
        [0.5, 3.9, 0xff3b15, 0.55],
        [0.3, 2.7, 0xffa44b, 0.9],
        [0.15, 1.5, 0xffefc1, 1]
    ]) {
        const m = new THREE.Mesh(
            new THREE.ConeGeometry(radius, length, 20),
            new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        m.rotation.z = Math.PI / 2;
        m.position.x = -length / 2;
        flame.add(m);
    }
    const elevons = [-1, 1].map((side) =>
        mesh(new THREE.BoxGeometry(0.65, 0.1, 2.4), paint, [
            -4.5,
            0.64,
            side * 2.25
        ])
    );
    const brakes = [-1, 1].map((side) =>
        mesh(new THREE.BoxGeometry(1.1, 0.08, 0.7), paint, [
            -1,
            0.85,
            side * 1.3
        ])
    );
    const propeller = new THREE.Group();
    airplane.add(propeller); // Shared rendering contract; no rotating jet geometry.
    airplane.userData.jetParts = {
        gear,
        gearLegs,
        flame,
        elevons,
        canopy,
        brakes
    };
    return { airplane, propeller };
}
/** @param {THREE.Object3D} airplane @param {import('../flight/physics.js').PlaneState} state @param {import('../flight/input.js').KeyboardState} input @param {number} time */
export function updateMirage(airplane, state, input, time) {
    const parts = airplane.userData.jetParts;
    if (!parts) return;
    const extension = state.gearExtension ?? (state.gearDown ? 1 : 0);
    const folded = 1 - extension * extension * (3 - 2 * extension);
    parts.gear.visible = extension > 0.001;
    parts.gearLegs.forEach((/** @type {THREE.Object3D} */ leg) => {
        leg.rotation.x = (leg.userData.side * folded * Math.PI) / 2;
        leg.rotation.z = leg.userData.side ? 0 : (-folded * Math.PI) / 2;
    });
    parts.brakes.forEach((/** @type {THREE.Object3D} */ p) => {
        p.rotation.z =
            -0.8 * (state.airbrakeExtension ?? (state.airbrake ? 1 : 0));
    });
    parts.flame.visible = Boolean(state.afterburner && !state.isCrashed);
    parts.flame.scale.set(
        1 + 0.1 * Math.sin(time * 47),
        1 + 0.04 * Math.sin(time * 29),
        1
    );
    const pitch =
        (input.arrowDown ? 1 : 0) - (input.arrowUp ? 1 : 0) + input.stickPitch;
    const roll =
        (input.arrowRight ? 1 : 0) -
        (input.arrowLeft ? 1 : 0) +
        input.stickRoll;
    parts.elevons.forEach(
        (/** @type {THREE.Object3D} */ p, /** @type {number} */ i) => {
            p.rotation.z = pitch * 0.25 + roll * (i ? 0.3 : -0.3);
        }
    );
}
