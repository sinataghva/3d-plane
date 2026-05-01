import * as THREE from 'three';

function createTree() {
    const tree = new THREE.Group();

    const trunkGeometry = new THREE.CylinderGeometry(0.35, 0.45, 3.5, 10);
    const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8B5A2B });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = 1.75;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    tree.add(trunk);

    const foliageGeometry = new THREE.ConeGeometry(2, 4.5, 16);
    const foliageMaterial = new THREE.MeshPhongMaterial({ color: 0x2E8B57 });
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = 4.5;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    tree.add(foliage);

    return tree;
}

export function createAirbase() {
    const airbaseGroup = new THREE.Group();

    const runwayGeometry = new THREE.PlaneGeometry(20, 300);
    const runwayMaterial = new THREE.MeshPhongMaterial({
        color: 0x222222,
        specular: 0x333333,
        shininess: 10
    });
    const runway = new THREE.Mesh(runwayGeometry, runwayMaterial);
    runway.rotation.x = -Math.PI / 2;
    runway.position.y = 0.01;
    runway.receiveShadow = true;
    airbaseGroup.add(runway);

    const barrierGeometry = new THREE.BoxGeometry(20, 5, 0.5);
    const barrierMaterial = new THREE.MeshPhongMaterial({
        color: 0xCC0000,
        specular: 0x111111,
        shininess: 30
    });
    const barrier = new THREE.Mesh(barrierGeometry, barrierMaterial);
    barrier.position.set(0, 0.5, 150);
    barrier.castShadow = true;
    barrier.receiveShadow = true;
    airbaseGroup.add(barrier);

    const centerLineGeometry = new THREE.PlaneGeometry(0.5, 290);
    const centerLineMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const centerLine = new THREE.Mesh(centerLineGeometry, centerLineMaterial);
    centerLine.rotation.x = -Math.PI / 2;
    centerLine.position.y = 0.02;
    airbaseGroup.add(centerLine);

    for (let i = -140; i <= 140; i += 10) {
        if (i % 20 !== 0) {
            const edgeMarkGeometry = new THREE.PlaneGeometry(0.5, 2);
            const edgeMark = new THREE.Mesh(edgeMarkGeometry, centerLineMaterial);
            edgeMark.rotation.x = -Math.PI / 2;
            edgeMark.position.set(9.5, 0.02, i);
            airbaseGroup.add(edgeMark);

            const edgeMark2 = edgeMark.clone();
            edgeMark2.position.set(-9.5, 0.02, i);
            airbaseGroup.add(edgeMark2);
        }
    }

    for (let i = -8; i <= 8; i += 2) {
        const thresholdMarkGeometry = new THREE.PlaneGeometry(0.5, 5);
        const thresholdMark = new THREE.Mesh(thresholdMarkGeometry, centerLineMaterial);
        thresholdMark.rotation.x = -Math.PI / 2;
        thresholdMark.position.set(i, 0.02, -147);
        airbaseGroup.add(thresholdMark);

        const thresholdMark2 = thresholdMark.clone();
        thresholdMark2.position.z = 147;
        airbaseGroup.add(thresholdMark2);
    }

    const grassGeometry = new THREE.PlaneGeometry(2000, 2000);
    const grassMaterial = new THREE.MeshPhongMaterial({
        color: 0x4CAF50,
        specular: 0x111111,
        shininess: 5
    });
    const grass = new THREE.Mesh(grassGeometry, grassMaterial);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = 0;
    grass.receiveShadow = true;
    airbaseGroup.add(grass);

    const treeCount = 200;
    const gridSize = 10;
    const grassLimit = 900;
    let placed = 0;
    let attempts = 0;

    while (placed < treeCount && attempts < treeCount * 10) {
        const x = Math.round((Math.random() * 2 - 1) * grassLimit / gridSize) * gridSize + (Math.random() - 0.5) * 5;
        const z = Math.round((Math.random() * 2 - 1) * grassLimit / gridSize) * gridSize + (Math.random() - 0.5) * 5;

        if (Math.abs(x) < 30 && Math.abs(z) < 170) {
            attempts++;
            continue;
        }

        const tree = createTree();
        tree.position.set(x, 0, z);
        airbaseGroup.add(tree);
        placed++;
        attempts++;
    }

    return airbaseGroup;
}
