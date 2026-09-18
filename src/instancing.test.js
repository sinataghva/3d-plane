import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { instanceStaticScenery } from './instancing.js';
import { createAirbase } from './airbase.js';
import { useSeededRandom } from './visualScenarios.js';

describe('static scenery batches', () => {
    it('preserves nested world transforms, shared resources, shadows and bounds', () => {
        const root = new THREE.Group();
        root.position.set(10, -0.5, 15);
        const tree = new THREE.Group();
        tree.position.set(7, 0, 9);
        tree.rotation.y = 0.4;
        tree.scale.setScalar(1.3);
        const original = new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshBasicMaterial()
        );
        original.position.y = 3;
        original.castShadow = true;
        tree.add(original);
        root.add(tree);
        root.updateMatrixWorld(true);
        const expected = original.matrixWorld.clone();
        instanceStaticScenery(root, [tree]);
        const batch = root.children[0];
        expect(batch).toBeInstanceOf(THREE.InstancedMesh);
        if (!(batch instanceof THREE.InstancedMesh))
            throw new Error('Missing batch');
        root.updateMatrixWorld(true);
        const actual = new THREE.Matrix4();
        batch.getMatrixAt(0, actual);
        actual.premultiply(batch.matrixWorld);
        actual.elements.forEach((value, index) =>
            expect(value).toBeCloseTo(expected.elements[index], 5)
        );
        expect(batch.geometry).toBe(original.geometry);
        expect(batch.material).toBe(original.material);
        expect(batch.castShadow).toBe(true);
        expect(batch.boundingSphere?.radius).toBeGreaterThan(0);
        expect(batch.frustumCulled).toBe(true);
    });
    it('keeps distant cells separate for frustum culling', () => {
        const root = new THREE.Group();
        const geometry = new THREE.BoxGeometry();
        const material = new THREE.MeshBasicMaterial();
        const objects = [0, 10, 1000].map((x) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.x = x;
            root.add(mesh);
            return mesh;
        });
        instanceStaticScenery(root, objects, 400);
        expect(root.children).toHaveLength(2);
    });
    it('retains 320 complete trees while sharing only two tree geometries', () => {
        const restore = useSeededRandom(12345);
        try {
            const world = createAirbase();
            const batches = world.children.filter(
                /** @returns {part is THREE.InstancedMesh} */
                (part) =>
                    part instanceof THREE.InstancedMesh &&
                    !(part.geometry instanceof THREE.PlaneGeometry)
            );
            expect(batches.reduce((total, mesh) => total + mesh.count, 0)).toBe(
                640
            );
            expect(new Set(batches.map((mesh) => mesh.geometry)).size).toBe(2);
            expect(batches.length).toBeLessThan(200);
        } finally {
            restore();
        }
    });
});
