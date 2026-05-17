import * as THREE from 'three';

/**
 * @typedef {import('./input.js').KeyboardState} KeyboardState
 * @typedef {import('./physics.js').PlaneState} PlaneState
 */

/**
 * @param {THREE.Object3D} object
 */
function enableShadows(object) {
    object.castShadow = true;
    object.receiveShadow = true;
}

/**
 * @param {THREE.Vector3} start
 * @param {THREE.Vector3} end
 * @param {number} radius
 * @param {THREE.Material} material
 * @returns {THREE.Mesh}
 */
function createStrut(start, end, radius, material) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const geometry = new THREE.CylinderGeometry(radius, radius, length, 10);
    const strut = new THREE.Mesh(geometry, material);

    strut.position.copy(start).add(end).multiplyScalar(0.5);
    strut.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.normalize()
    );
    enableShadows(strut);

    return strut;
}

/**
 * @param {THREE.Mesh} mesh
 * @param {THREE.Object3D} group
 */
function addPart(mesh, group) {
    enableShadows(mesh);
    group.add(mesh);
}

/**
 * @param {number} current
 * @param {number} target
 * @param {number} delta
 * @returns {number}
 */
function dampSurface(current, target, delta) {
    return THREE.MathUtils.damp(current, target, 14, delta);
}

/**
 * @returns {{ airplane: THREE.Group, propeller: THREE.Group }}
 */
export function createAirplane() {
    const airplane = new THREE.Group();

    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0xf5f5f2,
        specular: 0x555555,
        shininess: 42
    });
    const blueMaterial = new THREE.MeshPhongMaterial({
        color: 0x0d4fb7,
        specular: 0x222222,
        shininess: 50
    });
    const redMaterial = new THREE.MeshPhongMaterial({
        color: 0xd62323,
        specular: 0x222222,
        shininess: 45
    });
    const glassMaterial = new THREE.MeshPhongMaterial({
        color: 0x168d91,
        emissive: 0x063b3d,
        emissiveIntensity: 0.08,
        specular: 0xb8ffff,
        shininess: 90,
        transparent: true,
        opacity: 0.9
    });
    const propellerMaterial = new THREE.MeshPhongMaterial({
        color: 0x202020,
        specular: 0x444444,
        shininess: 28
    });
    const metalMaterial = new THREE.MeshPhongMaterial({
        color: 0xc8cdd0,
        specular: 0x444444,
        shininess: 45
    });
    const tireMaterial = new THREE.MeshPhongMaterial({
        color: 0x111111,
        specular: 0x080808,
        shininess: 12
    });
    const cockpitPanelMaterial = new THREE.MeshBasicMaterial({
        color: 0x111820
    });
    const cockpitTrimMaterial = new THREE.MeshBasicMaterial({
        color: 0x040609
    });
    const cockpitDialMaterial = new THREE.MeshBasicMaterial({
        color: 0x8ecae6
    });

    const fuselageGeometry = new THREE.CylinderGeometry(0.5, 0.58, 5.4, 28);
    fuselageGeometry.rotateZ(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
    fuselage.position.set(-0.2, 0, 0);
    addPart(fuselage, airplane);

    const noseGeometry = new THREE.CylinderGeometry(0.36, 0.5, 0.78, 24);
    noseGeometry.rotateZ(Math.PI / 2);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(2.9, 0.02, 0);
    addPart(nose, airplane);

    const cowlingGeometry = new THREE.CylinderGeometry(0.31, 0.34, 0.36, 24);
    cowlingGeometry.rotateZ(Math.PI / 2);
    const cowling = new THREE.Mesh(cowlingGeometry, bodyMaterial);
    cowling.position.set(3.42, 0.02, 0);
    addPart(cowling, airplane);

    const cabinGeometry = new THREE.BoxGeometry(1.15, 0.68, 0.96);
    const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
    cabin.position.set(0.98, 0.58, 0);
    addPart(cabin, airplane);

    const windshieldGeometry = new THREE.BoxGeometry(0.08, 0.5, 0.8);
    const windshield = new THREE.Mesh(windshieldGeometry, glassMaterial);
    windshield.position.set(1.56, 0.6, 0);
    windshield.rotation.z = -0.16;
    addPart(windshield, airplane);

    const rearWindow = windshield.clone();
    rearWindow.position.x = 0.38;
    rearWindow.rotation.z = 0.08;
    addPart(rearWindow, airplane);

    const sideWindowGeometry = new THREE.BoxGeometry(0.34, 0.34, 0.04);
    const sideWindowXPositions = [0.75, 1.18];

    for (const x of sideWindowXPositions) {
        const leftWindow = new THREE.Mesh(sideWindowGeometry, glassMaterial);
        leftWindow.position.set(x, 0.62, 0.5);
        addPart(leftWindow, airplane);

        const rightWindow = leftWindow.clone();
        rightWindow.position.z = -0.5;
        addPart(rightWindow, airplane);
    }

    const wingGeometry = new THREE.BoxGeometry(1.75, 0.09, 8.8);
    const wing = new THREE.Mesh(wingGeometry, bodyMaterial);
    wing.position.set(0.35, 1.2, 0);
    addPart(wing, airplane);

    const wingLeadingEdgeGeometry = new THREE.CylinderGeometry(
        0.055,
        0.055,
        8.8,
        16
    );
    wingLeadingEdgeGeometry.rotateX(Math.PI / 2);
    const wingLeadingEdge = new THREE.Mesh(
        wingLeadingEdgeGeometry,
        bodyMaterial
    );
    wingLeadingEdge.position.set(1.23, 1.2, 0);
    addPart(wingLeadingEdge, airplane);

    const leftWingTipGeometry = new THREE.BoxGeometry(1.75, 0.1, 0.08);
    const leftWingTip = new THREE.Mesh(leftWingTipGeometry, bodyMaterial);
    leftWingTip.position.set(0.35, 1.19, 4.48);
    addPart(leftWingTip, airplane);

    const rightWingTip = leftWingTip.clone();
    rightWingTip.position.z = -4.48;
    addPart(rightWingTip, airplane);

    const aileronGeometry = new THREE.BoxGeometry(0.36, 0.045, 1.55);
    const leftAileron = new THREE.Mesh(aileronGeometry, blueMaterial);
    leftAileron.name = 'leftAileron';
    leftAileron.position.set(-0.52, 1.235, 3.25);
    addPart(leftAileron, airplane);

    const rightAileron = leftAileron.clone();
    rightAileron.name = 'rightAileron';
    rightAileron.position.z = -3.25;
    addPart(rightAileron, airplane);

    const flapGeometry = new THREE.BoxGeometry(0.34, 0.045, 1.35);
    const leftFlap = new THREE.Mesh(flapGeometry, blueMaterial);
    leftFlap.name = 'leftFlap';
    leftFlap.position.set(-0.53, 1.233, 1.2);
    addPart(leftFlap, airplane);

    const rightFlap = leftFlap.clone();
    rightFlap.name = 'rightFlap';
    rightFlap.position.z = -1.2;
    addPart(rightFlap, airplane);

    const stripeGeometry = new THREE.BoxGeometry(2.9, 0.06, 0.045);
    const leftStripe = new THREE.Mesh(stripeGeometry, blueMaterial);
    leftStripe.position.set(-0.75, 0.08, 0.55);
    addPart(leftStripe, airplane);

    const rightStripe = leftStripe.clone();
    rightStripe.position.z = -0.55;
    addPart(rightStripe, airplane);

    const lowerStripeGeometry = new THREE.BoxGeometry(2.45, 0.045, 0.04);
    const leftLowerStripe = new THREE.Mesh(lowerStripeGeometry, blueMaterial);
    leftLowerStripe.position.set(-0.88, -0.1, 0.56);
    addPart(leftLowerStripe, airplane);

    const rightLowerStripe = leftLowerStripe.clone();
    rightLowerStripe.position.z = -0.56;
    addPart(rightLowerStripe, airplane);

    const strutPoints = [
        [
            new THREE.Vector3(1.15, -0.2, 0.48),
            new THREE.Vector3(0.45, 1.12, 3.1)
        ],
        [
            new THREE.Vector3(1.15, -0.2, -0.48),
            new THREE.Vector3(0.45, 1.12, -3.1)
        ],
        [
            new THREE.Vector3(-0.15, -0.22, 0.48),
            new THREE.Vector3(0.05, 1.12, 2.85)
        ],
        [
            new THREE.Vector3(-0.15, -0.22, -0.48),
            new THREE.Vector3(0.05, 1.12, -2.85)
        ]
    ];

    for (const [start, end] of strutPoints) {
        airplane.add(createStrut(start, end, 0.03, metalMaterial));
    }

    const tailConeGeometry = new THREE.ConeGeometry(0.42, 1.15, 24);
    tailConeGeometry.rotateZ(Math.PI / 2);
    const tailCone = new THREE.Mesh(tailConeGeometry, bodyMaterial);
    tailCone.position.set(-3.12, 0, 0);
    addPart(tailCone, airplane);

    const tailWingGeometry = new THREE.BoxGeometry(1.2, 0.07, 2.45);
    const tailWing = new THREE.Mesh(tailWingGeometry, bodyMaterial);
    tailWing.position.set(-3.55, 0.12, 0);
    addPart(tailWing, airplane);

    const tailTipGeometry = new THREE.BoxGeometry(0.72, 0.08, 0.08);
    const leftTailTip = new THREE.Mesh(tailTipGeometry, bodyMaterial);
    leftTailTip.position.set(-3.55, 0.13, 1.27);
    addPart(leftTailTip, airplane);

    const rightTailTip = leftTailTip.clone();
    rightTailTip.position.z = -1.27;
    addPart(rightTailTip, airplane);

    const elevatorGeometry = new THREE.BoxGeometry(0.34, 0.045, 1.05);
    const leftElevator = new THREE.Mesh(elevatorGeometry, blueMaterial);
    leftElevator.name = 'leftElevator';
    leftElevator.position.set(-4.12, 0.155, 0.72);
    addPart(leftElevator, airplane);

    const rightElevator = leftElevator.clone();
    rightElevator.name = 'rightElevator';
    rightElevator.position.z = -0.72;
    addPart(rightElevator, airplane);

    const verticalTailGeometry = new THREE.BoxGeometry(0.82, 1.35, 0.08);
    const verticalTail = new THREE.Mesh(verticalTailGeometry, bodyMaterial);
    verticalTail.position.set(-3.8, 0.78, 0);
    verticalTail.rotation.z = -0.08;
    addPart(verticalTail, airplane);

    const rudderStripeGeometry = new THREE.BoxGeometry(0.18, 1.1, 0.09);
    const rudder = new THREE.Mesh(rudderStripeGeometry, blueMaterial);
    rudder.name = 'rudder';
    rudder.position.set(-4.05, 0.75, 0.055);
    rudder.rotation.z = -0.08;
    addPart(rudder, airplane);

    const tailCapGeometry = new THREE.BoxGeometry(0.5, 0.18, 0.09);
    const tailCap = new THREE.Mesh(tailCapGeometry, bodyMaterial);
    tailCap.position.set(-3.8, 1.48, 0);
    tailCap.rotation.z = -0.08;
    addPart(tailCap, airplane);

    const beaconGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.08);
    const beacon = new THREE.Mesh(beaconGeometry, redMaterial);
    beacon.position.set(-3.9, 1.66, 0);
    addPart(beacon, airplane);

    const gearLegGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.92, 10);
    const leftGearLeg = new THREE.Mesh(gearLegGeometry, metalMaterial);
    leftGearLeg.position.set(0.65, -0.55, 1.05);
    leftGearLeg.rotation.z = -0.22;
    addPart(leftGearLeg, airplane);

    const rightGearLeg = leftGearLeg.clone();
    rightGearLeg.position.z = -1.05;
    addPart(rightGearLeg, airplane);

    const axleGeometry = new THREE.CylinderGeometry(0.035, 0.035, 2.1, 10);
    axleGeometry.rotateX(Math.PI / 2);
    const axle = new THREE.Mesh(axleGeometry, metalMaterial);
    axle.position.set(0.65, -0.78, 0);
    addPart(axle, airplane);

    const wheelGeometry = new THREE.TorusGeometry(0.28, 0.085, 12, 24);
    const leftWheel = new THREE.Mesh(wheelGeometry, tireMaterial);
    leftWheel.position.set(0.65, -0.8, 1.1);
    addPart(leftWheel, airplane);

    const rightWheel = leftWheel.clone();
    rightWheel.position.z = -1.1;
    addPart(rightWheel, airplane);

    const wheelPantGeometry = new THREE.SphereGeometry(0.34, 18, 12);
    const leftWheelPant = new THREE.Mesh(wheelPantGeometry, blueMaterial);
    leftWheelPant.position.set(0.65, -0.68, 1.1);
    leftWheelPant.scale.set(1.35, 0.48, 0.82);
    addPart(leftWheelPant, airplane);

    const rightWheelPant = leftWheelPant.clone();
    rightWheelPant.position.z = -1.1;
    addPart(rightWheelPant, airplane);

    const tailWheel = new THREE.Mesh(wheelGeometry, tireMaterial);
    tailWheel.scale.set(0.42, 0.42, 0.42);
    tailWheel.position.set(-3.58, -0.77, 0);
    addPart(tailWheel, airplane);

    const tailGearMountGeometry = new THREE.BoxGeometry(0.24, 0.08, 0.16);
    const tailGearMount = new THREE.Mesh(tailGearMountGeometry, metalMaterial);
    tailGearMount.position.set(-3.42, -0.28, 0);
    addPart(tailGearMount, airplane);

    airplane.add(
        createStrut(
            new THREE.Vector3(-3.42, -0.3, 0),
            new THREE.Vector3(-3.58, -0.66, 0),
            0.026,
            metalMaterial
        )
    );

    airplane.add(
        createStrut(
            new THREE.Vector3(-3.55, -0.62, 0.09),
            new THREE.Vector3(-3.58, -0.78, 0.16),
            0.016,
            metalMaterial
        )
    );

    airplane.add(
        createStrut(
            new THREE.Vector3(-3.55, -0.62, -0.09),
            new THREE.Vector3(-3.58, -0.78, -0.16),
            0.016,
            metalMaterial
        )
    );

    const wheelHubGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.07, 18);
    wheelHubGeometry.rotateX(Math.PI / 2);
    for (const wheel of [leftWheel, rightWheel, tailWheel]) {
        const hub = new THREE.Mesh(wheelHubGeometry, metalMaterial);
        hub.position.copy(wheel.position);
        hub.scale.copy(wheel.scale);
        addPart(hub, airplane);
    }

    const spinnerGeometry = new THREE.ConeGeometry(0.17, 0.32, 20);
    spinnerGeometry.rotateZ(-Math.PI / 2);
    const spinner = new THREE.Mesh(spinnerGeometry, bodyMaterial);
    spinner.position.set(3.78, 0.02, 0);
    addPart(spinner, airplane);

    const propeller = new THREE.Group();
    propeller.position.set(3.88, 0.02, 0);
    airplane.add(propeller);

    const bladeGeometry = new THREE.BoxGeometry(0.07, 0.62, 0.035);
    bladeGeometry.translate(0, 0.38, 0);
    for (let index = 0; index < 4; index += 1) {
        const blade = new THREE.Mesh(bladeGeometry, propellerMaterial);
        blade.rotation.x = (index * Math.PI) / 2;
        addPart(blade, propeller);
    }

    const propellerHubGeometry = new THREE.SphereGeometry(0.13, 16, 12);
    const propellerHub = new THREE.Mesh(propellerHubGeometry, metalMaterial);
    propellerHub.position.copy(propeller.position);
    addPart(propellerHub, airplane);

    const cockpitView = new THREE.Group();
    cockpitView.visible = false;

    const glareShieldGeometry = new THREE.BoxGeometry(0.14, 0.1, 0.86);
    const glareShield = new THREE.Mesh(
        glareShieldGeometry,
        cockpitTrimMaterial
    );
    glareShield.position.set(1.68, 0.25, 0);
    cockpitView.add(glareShield);

    const panelGeometry = new THREE.BoxGeometry(0.08, 0.3, 0.82);
    const panel = new THREE.Mesh(panelGeometry, cockpitPanelMaterial);
    panel.position.set(1.76, 0.1, 0);
    cockpitView.add(panel);

    const dialGeometry = new THREE.CylinderGeometry(0.085, 0.085, 0.018, 18);
    dialGeometry.rotateZ(Math.PI / 2);
    const dialPositions = [
        [1.81, 0.17, 0.25],
        [1.81, 0.17, 0],
        [1.81, 0.17, -0.25],
        [1.81, 0.02, 0.16],
        [1.81, 0.02, -0.16]
    ];
    for (const [x, y, z] of dialPositions) {
        const dial = new THREE.Mesh(dialGeometry, cockpitDialMaterial);
        dial.position.set(x, y, z);
        cockpitView.add(dial);
    }

    const windshieldPostGeometry = new THREE.BoxGeometry(0.07, 0.68, 0.055);
    const leftWindshieldPost = new THREE.Mesh(
        windshieldPostGeometry,
        cockpitTrimMaterial
    );
    leftWindshieldPost.position.set(1.5, 0.74, 0.43);
    leftWindshieldPost.rotation.z = -0.14;
    cockpitView.add(leftWindshieldPost);

    const rightWindshieldPost = leftWindshieldPost.clone();
    rightWindshieldPost.position.z = -0.43;
    cockpitView.add(rightWindshieldPost);

    const yokeColumn = createStrut(
        new THREE.Vector3(1.42, 0.08, 0),
        new THREE.Vector3(1.28, 0.32, 0),
        0.025,
        cockpitTrimMaterial
    );
    cockpitView.add(yokeColumn);

    const yokeBarGeometry = new THREE.BoxGeometry(0.05, 0.05, 0.52);
    const yokeBar = new THREE.Mesh(yokeBarGeometry, cockpitTrimMaterial);
    yokeBar.position.set(1.23, 0.35, 0);
    cockpitView.add(yokeBar);

    const yokeGripGeometry = new THREE.TorusGeometry(0.17, 0.018, 8, 18);
    const yokeGrip = new THREE.Mesh(yokeGripGeometry, cockpitTrimMaterial);
    yokeGrip.position.set(1.2, 0.35, 0);
    yokeGrip.rotation.y = Math.PI / 2;
    cockpitView.add(yokeGrip);

    airplane.add(cockpitView);

    airplane.userData.controlSurfaces = {
        leftAileron,
        rightAileron,
        leftFlap,
        rightFlap,
        leftElevator,
        rightElevator,
        rudder
    };
    airplane.userData.cockpitView = cockpitView;

    return { airplane, propeller };
}

/**
 * Shows the simplified cockpit frame only in first-person cockpit mode.
 *
 * @param {object} args
 * @param {THREE.Object3D} args.airplane
 * @param {THREE.Object3D} args.propeller
 * @param {boolean} args.isCockpit
 */
export function updateAirplaneCockpitVisibility({
    airplane,
    propeller,
    isCockpit
}) {
    const cockpitView = airplane.userData.cockpitView;
    if (cockpitView instanceof THREE.Object3D) {
        cockpitView.visible = isCockpit;
    }

    propeller.traverse((part) => {
        if (
            part instanceof THREE.Mesh &&
            part.material instanceof THREE.Material
        ) {
            part.material.transparent = isCockpit;
            part.material.opacity = isCockpit ? 0.18 : 1;
            part.material.depthWrite = !isCockpit;
        }
    });
}

/**
 * Moves the visible control surfaces with the current flight controls.
 *
 * @param {object} args
 * @param {THREE.Object3D} args.airplane
 * @param {KeyboardState} args.keyboard
 * @param {PlaneState} args.planeState
 * @param {number} args.delta
 */
export function updateAirplaneControlSurfaces({
    airplane,
    keyboard,
    planeState,
    delta
}) {
    const surfaces = airplane.userData.controlSurfaces;
    if (!surfaces) return;

    const aileronDeflection = 0.34;
    const elevatorDeflection = 0.3;
    const rudderDeflection = 0.36;
    const flapDeflection = -0.42;

    const rollInput = THREE.MathUtils.clamp(
        (keyboard.arrowRight ? 1 : 0) -
            (keyboard.arrowLeft ? 1 : 0) +
            (keyboard.stickRoll || 0),
        -1,
        1
    );
    const pitchInput = THREE.MathUtils.clamp(
        (keyboard.arrowDown ? 1 : 0) -
            (keyboard.arrowUp ? 1 : 0) +
            (keyboard.stickPitch || 0),
        -1,
        1
    );
    const rudderInput = (keyboard.a ? 1 : 0) - (keyboard.d ? 1 : 0);

    surfaces.leftAileron.rotation.z = dampSurface(
        surfaces.leftAileron.rotation.z,
        rollInput * aileronDeflection,
        delta
    );
    surfaces.rightAileron.rotation.z = dampSurface(
        surfaces.rightAileron.rotation.z,
        -rollInput * aileronDeflection,
        delta
    );

    surfaces.leftElevator.rotation.z = dampSurface(
        surfaces.leftElevator.rotation.z,
        pitchInput * elevatorDeflection,
        delta
    );
    surfaces.rightElevator.rotation.z = dampSurface(
        surfaces.rightElevator.rotation.z,
        pitchInput * elevatorDeflection,
        delta
    );

    surfaces.rudder.rotation.y = dampSurface(
        surfaces.rudder.rotation.y,
        rudderInput * rudderDeflection,
        delta
    );

    surfaces.leftFlap.rotation.z = dampSurface(
        surfaces.leftFlap.rotation.z,
        planeState.flapDeployment * flapDeflection,
        delta
    );
    surfaces.rightFlap.rotation.z = dampSurface(
        surfaces.rightFlap.rotation.z,
        planeState.flapDeployment * flapDeflection,
        delta
    );
}
