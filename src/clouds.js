import * as THREE from 'three';

/**
 * @returns {THREE.Group}
 */
function createCloud() {
    const cloud = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xb8d7f0,
        emissiveIntensity: 0.08,
        roughness: 1,
        metalness: 0,
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
 * @returns {THREE.Mesh}
 */
function createHighCloudStreak() {
    const geometry = new THREE.PlaneGeometry(140, 3.5);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const streak = new THREE.Mesh(geometry, material);
    streak.rotation.x = -Math.PI / 2;
    streak.rotation.z = -0.35 + Math.random() * 0.7;
    return streak;
}

/**
 * @param {THREE.Scene} scene
 * @param {number} [cloudCount]
 */
export function addClouds(scene, cloudCount = 26) {
    for (let i = 0; i < cloudCount; i++) {
        const cloud = createCloud();
        const x = (Math.random() * 2 - 1) * 760;
        const y = 62 + Math.random() * 70;
        const z = (Math.random() * 2 - 1) * 760;
        cloud.position.set(x, y, z);
        scene.add(cloud);
    }

    for (let i = 0; i < 6; i++) {
        const streak = createHighCloudStreak();
        streak.position.set(
            (Math.random() * 2 - 1) * 950,
            150 + Math.random() * 70,
            (Math.random() * 2 - 1) * 950
        );
        scene.add(streak);
    }
}
