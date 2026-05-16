import * as THREE from 'three';

const WORLD_WIDTH = 4200;
const WORLD_LENGTH = 5200;
const RUNWAY_WIDTH = 20;
const RUNWAY_LENGTH = 300;

/**
 * @param {THREE.Object3D} object
 */
function enableShadows(object) {
    object.castShadow = true;
    object.receiveShadow = true;
}

/**
 * @param {THREE.Material} material
 * @param {number} factor
 * @param {number} units
 * @returns {THREE.Material}
 */
function withDepthBias(material, factor, units) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = factor;
    material.polygonOffsetUnits = units;
    return material;
}

/**
 * @param {number} width
 * @param {number} depth
 * @param {THREE.Material} material
 * @param {number} x
 * @param {number} z
 * @param {number} [y]
 * @returns {THREE.Mesh}
 */
function createGroundPatch(width, depth, material, x, z, y = 0.006) {
    const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(width, depth),
        material
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(x, y, z);
    patch.receiveShadow = true;
    return patch;
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {THREE.Material} material
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {THREE.Mesh}
 */
function createPart(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    enableShadows(mesh);
    return mesh;
}

/**
 * @returns {THREE.Group}
 */
function createTree() {
    const tree = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.35, 0.45, 3.5, 10);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8b5a2b });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const foliageGeometry = new THREE.ConeGeometry(2, 4.5, 16);
    const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x2e8b57 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 4.5;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);

    return tree;
}

/**
 * @param {THREE.Material} wallMaterial
 * @param {THREE.Material} roofMaterial
 * @returns {THREE.Group}
 */
function createHangar(wallMaterial, roofMaterial) {
    const hangar = new THREE.Group();

    const body = createPart(
        new THREE.BoxGeometry(34, 13, 28),
        wallMaterial,
        0,
        6.5,
        0
    );
    hangar.add(body);

    const roof = createPart(
        new THREE.BoxGeometry(38, 4, 31),
        roofMaterial,
        0,
        14.5,
        0
    );
    roof.rotation.z = 0.06;
    hangar.add(roof);

    const door = createPart(
        new THREE.BoxGeometry(0.35, 9, 18),
        new THREE.MeshPhongMaterial({ color: 0x1d2a32 }),
        -17.2,
        4.5,
        0
    );
    hangar.add(door);

    return hangar;
}

/**
 * @param {THREE.Material} wallMaterial
 * @param {THREE.Material} glassMaterial
 * @param {THREE.Material} roofMaterial
 * @returns {THREE.Group}
 */
function createControlTower(wallMaterial, glassMaterial, roofMaterial) {
    const tower = new THREE.Group();

    const shaft = createPart(
        new THREE.BoxGeometry(7, 22, 7),
        wallMaterial,
        0,
        11,
        0
    );
    tower.add(shaft);

    const cab = createPart(
        new THREE.BoxGeometry(13, 7, 13),
        glassMaterial,
        0,
        25,
        0
    );
    tower.add(cab);

    const roof = createPart(
        new THREE.BoxGeometry(15, 2, 15),
        roofMaterial,
        0,
        29.5,
        0
    );
    tower.add(roof);

    return tower;
}

/**
 * @param {THREE.Material} metalMaterial
 * @param {THREE.Material} orangeMaterial
 * @returns {THREE.Group}
 */
function createWindSock(metalMaterial, orangeMaterial) {
    const windSock = new THREE.Group();

    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 11, 12),
        metalMaterial
    );
    pole.position.y = 5.5;
    enableShadows(pole);
    windSock.add(pole);

    const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 4, 8),
        metalMaterial
    );
    arm.position.set(1.9, 10.7, 0);
    arm.rotation.z = Math.PI / 2;
    enableShadows(arm);
    windSock.add(arm);

    const sock = new THREE.Mesh(
        new THREE.ConeGeometry(0.75, 4.2, 16, 1, true),
        orangeMaterial
    );
    sock.position.set(4, 10.7, 0);
    sock.rotation.z = -Math.PI / 2;
    enableShadows(sock);
    windSock.add(sock);

    return windSock;
}

/**
 * @returns {THREE.Group}
 */
export function createAirbase() {
    const airbaseGroup = new THREE.Group();

    const grassMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x43aa49,
            specular: 0x111111,
            shininess: 5
        }),
        0,
        0
    );
    const darkerGrassMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x358f45,
            specular: 0x101010,
            shininess: 4
        }),
        -0.4,
        -0.4
    );
    const paleGrassMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x67b85a,
            specular: 0x101010,
            shininess: 4
        }),
        -0.4,
        -0.4
    );
    const dirtMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x8a744f,
            specular: 0x0a0908,
            shininess: 3
        }),
        -1,
        -1
    );
    const concreteMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x8f9597,
            specular: 0x222222,
            shininess: 12
        }),
        -2,
        -2
    );
    const buildingMaterial = new THREE.MeshPhongMaterial({
        color: 0xd6d2c8,
        specular: 0x333333,
        shininess: 18
    });
    const roofMaterial = new THREE.MeshPhongMaterial({
        color: 0x2f5f9f,
        specular: 0x222222,
        shininess: 20
    });
    const glassMaterial = new THREE.MeshPhongMaterial({
        color: 0x2f8f9d,
        emissive: 0x08252c,
        emissiveIntensity: 0.08,
        specular: 0xb9f5ff,
        shininess: 70,
        transparent: true,
        opacity: 0.78
    });
    const metalMaterial = new THREE.MeshPhongMaterial({
        color: 0xb7c0c4,
        specular: 0x444444,
        shininess: 35
    });
    const orangeMaterial = new THREE.MeshPhongMaterial({ color: 0xff7a24 });
    const blueMaterial = new THREE.MeshPhongMaterial({ color: 0x0d4fb7 });

    const grass = createGroundPatch(
        WORLD_WIDTH,
        WORLD_LENGTH,
        grassMaterial,
        0,
        0,
        0
    );
    airbaseGroup.add(grass);

    /** @type {Array<[number, number, number, number, THREE.Material, number]>} */
    const grassPatches = [
        [680, 1250, -660, -320, darkerGrassMaterial, 0.004],
        [920, 820, 720, 520, paleGrassMaterial, 0.005],
        [520, 720, -480, 940, darkerGrassMaterial, 0.004],
        [760, 420, 420, -920, paleGrassMaterial, 0.005],
        [340, 1350, 1060, -260, darkerGrassMaterial, 0.004],
        [450, 980, -1220, 560, paleGrassMaterial, 0.005]
    ];

    for (const [width, depth, x, z, material, y] of grassPatches) {
        const patch = createGroundPatch(width, depth, material, x, z, y);
        patch.rotation.z = (Math.random() - 0.5) * 0.22;
        airbaseGroup.add(patch);
    }

    const serviceRoad = createGroundPatch(
        9,
        650,
        dirtMaterial,
        -70,
        -20,
        0.012
    );
    serviceRoad.rotation.z = 0.14;
    airbaseGroup.add(serviceRoad);

    const runwayGeometry = new THREE.PlaneGeometry(RUNWAY_WIDTH, RUNWAY_LENGTH);
    const runwayMaterial = withDepthBias(
        new THREE.MeshPhongMaterial({
            color: 0x222222,
            specular: 0x333333,
            shininess: 10
        }),
        -1.5,
        -1.5
    );
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.01;
    runway.receiveShadow = true;
    airbaseGroup.add(runway);

    const apron = createGroundPatch(105, 74, concreteMaterial, -86, -48, 0.018);
    airbaseGroup.add(apron);

    const taxiway = createGroundPatch(36, 92, runwayMaterial, -42, -48, 0.019);
    taxiway.rotation.z = -Math.PI / 2;
    airbaseGroup.add(taxiway);

    const taxiLineMaterial = withDepthBias(
        new THREE.MeshBasicMaterial({ color: 0xffd166 }),
        -4,
        -4
    );
    const taxiLine = createGroundPatch(
        0.35,
        90,
        taxiLineMaterial,
        -42,
        -48,
        0.024
    );
    taxiLine.rotation.z = -Math.PI / 2;
    airbaseGroup.add(taxiLine);

    const barrierGeometry = new THREE.BoxGeometry(RUNWAY_WIDTH, 5, 0.5);
    const barrierMaterial = new THREE.MeshPhongMaterial({
        color: 0xcc0000,
        specular: 0x111111,
        shininess: 30
    });
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrier.position.set(0, 0.5, 150);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    airbaseGroup.add(barrier);

    const centerLineGeometry = new THREE.PlaneGeometry(0.5, 290);
    const centerLineMaterial = withDepthBias(
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
        -4,
        -4
    );
    const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    airbaseGroup.add(centerLine);

    for (let i = -140; i <= 140; i += 10) {
        if (i % 20 !== 0) {
            const edgeMarkGeometry = new THREE.PlaneGeometry(0.5, 2);
            const edgeMark = new THREE.Mesh(
                edgeMarkGeometry,
                centerLineMaterial
            );
            edgeMark.rotation.x = -Math.PI / 2;
            edgeMark.position.set(9.5, 0.02, i);
            airbaseGroup.add(edgeMark);

            const edgeMark2 = edgeMark.clone();
            edgeMark2.position.set(-9.5, 0.02, i);
            airbaseGroup.add(edgeMark2);
        }
    }

    const runwayLightGeometry = new THREE.SphereGeometry(0.16, 10, 8);
    const runwayLightMaterial = new THREE.MeshBasicMaterial({
        color: 0xcff6ff
    });
    for (let z = -138; z <= 138; z += 18) {
        for (const x of [-11.2, 11.2]) {
            const light = new THREE.Mesh(
                runwayLightGeometry,
                runwayLightMaterial
            );
            light.position.set(x, 0.16, z);
            airbaseGroup.add(light);
        }
    }

    const approachLightGeometry = new THREE.BoxGeometry(1.2, 0.06, 0.08);
    for (let z = -185; z <= -155; z += 7.5) {
        const approachLight = createPart(
            approachLightGeometry,
            runwayLightMaterial,
            0,
            0.12,
            z
        );
        airbaseGroup.add(approachLight);
    }

    for (let i = -8; i <= 8; i += 2) {
        const thresholdMarkGeometry = new THREE.PlaneGeometry(0.5, 5);
        const thresholdMark = new THREE.Mesh(
            thresholdMarkGeometry,
            centerLineMaterial
        );
        thresholdMark.rotation.x = -Math.PI / 2;
        thresholdMark.position.set(i, 0.02, -147);
        airbaseGroup.add(thresholdMark);

        const thresholdMark2 = thresholdMark.clone();
        thresholdMark2.position.z = 147;
        airbaseGroup.add(thresholdMark2);
    }

    const hangarA = createHangar(buildingMaterial, roofMaterial);
    hangarA.position.set(-112, 0, -70);
    hangarA.rotation.y = Math.PI / 2;
    airbaseGroup.add(hangarA);

    const hangarB = createHangar(buildingMaterial, roofMaterial);
    hangarB.position.set(-112, 0, -18);
    hangarB.rotation.y = Math.PI / 2;
    hangarB.scale.set(0.86, 0.9, 0.86);
    airbaseGroup.add(hangarB);

    const tower = createControlTower(
        buildingMaterial,
        glassMaterial,
        roofMaterial
    );
    tower.position.set(-132, 0, 35);
    airbaseGroup.add(tower);

    const fuelTankGeometry = new THREE.CylinderGeometry(5.5, 5.5, 10, 24);
    for (const z of [48, 64]) {
        const tank = createPart(fuelTankGeometry, metalMaterial, -88, 5, z);
        tank.rotation.z = Math.PI / 2;
        airbaseGroup.add(tank);
    }

    const windSock = createWindSock(metalMaterial, orangeMaterial);
    windSock.position.set(32, 0, -82);
    windSock.rotation.y = -0.25;
    airbaseGroup.add(windSock);

    const radioMast = new THREE.Group();
    const mastPole = createPart(
        new THREE.CylinderGeometry(0.25, 0.35, 44, 8),
        metalMaterial,
        0,
        22,
        0
    );
    radioMast.add(mastPole);
    const mastBeacon = createPart(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshBasicMaterial({ color: 0xe63946 }),
        0,
        44.8,
        0
    );
    radioMast.add(mastBeacon);
    radioMast.position.set(145, 0, -92);
    airbaseGroup.add(radioMast);

    const waterTower = new THREE.Group();
    waterTower.add(
        createPart(
            new THREE.CylinderGeometry(0.28, 0.28, 24, 10),
            metalMaterial,
            0,
            12,
            0
        )
    );
    waterTower.add(
        createPart(
            new THREE.SphereGeometry(6.8, 18, 12),
            blueMaterial,
            0,
            26,
            0
        )
    );
    waterTower.position.set(210, 0, 105);
    airbaseGroup.add(waterTower);

    const hillMaterial = new THREE.MeshPhongMaterial({
        color: 0x6ca66a,
        specular: 0x0b140b,
        shininess: 4
    });
    const hillPositions = [
        [-1350, 1250, 220, 34, 0.8],
        [-940, -1560, 180, 28, 1.2],
        [620, 1670, 260, 42, -0.35],
        [1380, -1180, 210, 32, 0.55],
        [1680, 740, 170, 26, -1.1]
    ];

    for (const [x, z, radius, height, rotation] of hillPositions) {
        const hill = createPart(
            new THREE.SphereGeometry(radius, 28, 12),
            hillMaterial,
            x,
            -height * 0.42,
            z
        );
        hill.scale.set(1.45, height / radius, 0.82);
        hill.rotation.y = rotation;
        airbaseGroup.add(hill);
    }

    const treeCount = 320;
    const gridSize = 10;
    const grassLimitX = WORLD_WIDTH / 2 - 120;
    const grassLimitZ = WORLD_LENGTH / 2 - 140;
    let placed = 0;
    let attempts = 0;

    while (placed < treeCount && attempts < treeCount * 10) {
        const x =
            Math.round(((Math.random() * 2 - 1) * grassLimitX) / gridSize) *
                gridSize +
            (Math.random() - 0.5) * 5;
        const z =
            Math.round(((Math.random() * 2 - 1) * grassLimitZ) / gridSize) *
                gridSize +
            (Math.random() - 0.5) * 5;

        if (
            (Math.abs(x) < 38 && Math.abs(z) < 190) ||
            (x > -170 && x < -45 && z > -110 && z < 90)
        ) {
            attempts++;
            continue;
        }

        const tree = createTree();
        tree.position.set(x, 0, z);
        const scale = 0.72 + Math.random() * 0.65;
        tree.scale.setScalar(scale);
        airbaseGroup.add(tree);
        placed++;
        attempts++;
    }

    return airbaseGroup;
}
