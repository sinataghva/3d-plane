import * as THREE from 'three';

/**
 * @returns {THREE.Group}
 */
function createCloud() {
    const cloud = new THREE.Group();
    const material = new THREE.MeshPhongMaterial({
        color: 0xf4f4f4,
        shininess: 5,
        flatShading: true
    });
    const puffCount = 5 + Math.floor(Math.random() * 4);

    for (let i = 0; i < puffCount; i++) {
        const puffRadius = 2.5 + Math.random() * 3.5;
        const puff = new THREE.Mesh(
            new THREE.SphereGeometry(puffRadius, 20, 16),
            material
        );

        puff.position.set(
            (Math.random() - 0.5) * 10 + i * 2,
            (Math.random() - 0.5) * 4,
            (Math.random() - 0.5) * 6
        );
        puff.castShadow = false;
        puff.receiveShadow = false;
        cloud.add(puff);
    }

    const scale = 1.5 + Math.random() * 1.5;
    cloud.scale.set(scale, scale, scale);
    cloud.rotation.y = Math.random() * Math.PI * 2;

    return cloud;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [cloudCount]
 */
export function addClouds(scene, cloudCount = 20) {
    for (let i = 0; i < cloudCount; i++) {
        const cloud = createCloud();
        const x = (Math.random() * 2 - 1) * 800;
        const y = 50 + Math.random() * 60;
        const z = (Math.random() * 2 - 1) * 800;
        cloud.position.set(x, y, z);
        scene.add(cloud);
    }
}
