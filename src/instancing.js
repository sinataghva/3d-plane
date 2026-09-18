import * as THREE from 'three';

/**
 * Bake static scenery into spatial batches, retaining cell-level frustum culling.
 * Only use with opaque meshes whose geometry/materials are shared.
 * @param {THREE.Object3D} root
 * @param {THREE.Object3D[]} objects
 * @param {number} cellSize
 */
export function instanceStaticScenery(root, objects, cellSize = 400) {
    root.updateMatrixWorld(true);
    const inverse = root.matrixWorld.clone().invert();
    /** @type {Map<string, {source: THREE.Mesh, matrices: THREE.Matrix4[]}>} */
    const batches = new Map();
    const position = new THREE.Vector3();
    for (const object of objects) {
        object.traverse((part) => {
            if (!(part instanceof THREE.Mesh) || Array.isArray(part.material))
                return;
            const matrix = new THREE.Matrix4().multiplyMatrices(
                inverse,
                part.matrixWorld
            );
            position.setFromMatrixPosition(matrix);
            const key = `${Math.floor(position.x / cellSize)},${Math.floor(position.z / cellSize)}:${part.geometry.uuid}:${part.material.uuid}:${part.castShadow}:${part.receiveShadow}`;
            let batch = batches.get(key);
            if (!batch) {
                batch = { source: part, matrices: [] };
                batches.set(key, batch);
            }
            batch.matrices.push(matrix);
        });
        root.remove(object);
    }
    for (const { source, matrices } of batches.values()) {
        const mesh = new THREE.InstancedMesh(
            source.geometry,
            source.material,
            matrices.length
        );
        mesh.name = 'Static scenery batch';
        mesh.castShadow = source.castShadow;
        mesh.receiveShadow = source.receiveShadow;
        matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingBox();
        mesh.computeBoundingSphere();
        mesh.matrixAutoUpdate = false;
        root.add(mesh);
    }
}
