import * as THREE from 'three';

// Shared camera-depth bands let soft clouds and long smoke trails interleave.
// Log spacing keeps the bands fine near the camera without thousands of draws.
export const TRANSPARENT_LAYERS = 64;
/** @param {number} depth */
export function transparentLayer(depth) {
    return Math.min(
        TRANSPARENT_LAYERS - 1,
        Math.floor(8 * Math.log2(1 + Math.max(0, depth) / 100))
    );
}
/** @param {number} layer @param {boolean} [smoke] */
export function transparentOrder(layer, smoke = false) {
    // Preserve the atmospheric pass after terrain/water and before UI beacons.
    return (
        2 +
        (TRANSPARENT_LAYERS - 1 - layer + (smoke ? 0.5 : 0)) /
            TRANSPARENT_LAYERS
    );
}

/** Split an indexed ribbon into depth bands while sharing its vertex buffers.
 * @param {THREE.BufferGeometry} source
 * @param {THREE.Material} material
 */
export function createLayeredSmoke(source, material) {
    const group = new THREE.Group();
    const index = source.getIndex();
    if (!index) throw new Error('Smoke requires an indexed ribbon');
    const layers = Array.from({ length: TRANSPARENT_LAYERS }, (_, layer) => {
        const geometry = new THREE.BufferGeometry();
        for (const [name, attribute] of Object.entries(source.attributes))
            geometry.setAttribute(name, attribute);
        geometry.setIndex(
            new THREE.BufferAttribute(new Uint16Array(index.count), 1).setUsage(
                THREE.DynamicDrawUsage
            )
        );
        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        mesh.renderOrder = transparentOrder(layer, true);
        group.add(mesh);
        return mesh;
    });
    const counts = new Uint32Array(TRANSPARENT_LAYERS);
    const matrix = new THREE.Matrix4();
    const point = new THREE.Vector3();
    return {
        group,
        /** @param {THREE.Camera} camera */
        update(camera) {
            camera.updateMatrixWorld();
            group.updateWorldMatrix(true, false);
            matrix.multiplyMatrices(
                camera.matrixWorldInverse,
                group.matrixWorld
            );
            counts.fill(0);
            const position = source.getAttribute('position');
            const end = Math.min(index.count, source.drawRange.count);
            // Keep the two triangles of each ribbon segment together.
            for (let i = 0; i < end; i += 6) {
                const a = index.getX(i),
                    b = index.getX(i + 2);
                point
                    .set(
                        (position.getX(a) + position.getX(b)) / 2,
                        (position.getY(a) + position.getY(b)) / 2,
                        (position.getZ(a) + position.getZ(b)) / 2
                    )
                    .applyMatrix4(matrix);
                const layer = transparentLayer(-point.z);
                const target = layers[layer].geometry.getIndex();
                if (target)
                    for (let j = 0; j < 6; j++)
                        target.setX(counts[layer]++, index.getX(i + j));
            }
            layers.forEach((mesh, layer) => {
                mesh.visible = counts[layer] > 0;
                mesh.geometry.setDrawRange(0, counts[layer]);
                const target = mesh.geometry.getIndex();
                if (target && mesh.visible) {
                    target.clearUpdateRanges();
                    target.addUpdateRange(0, counts[layer]);
                    target.needsUpdate = true;
                }
            });
        }
    };
}
