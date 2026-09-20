import { expect, it } from 'vitest';
import * as THREE from 'three';
import { addClouds, createCloudLayout } from './clouds.js';

it('covers every regional quadrant and keeps cloud bases clear of the terrain', () => {
    const { span, puffs } = createCloudLayout();
    for (const east of [-1, 1])
        for (const south of [-1, 1]) {
            const quadrant = puffs.filter(
                (p) => p.x * east > 3000 && p.z * south > 3000
            );
            expect(quadrant.length).toBeGreaterThan(100);
        }
    expect(span / 2).toBeGreaterThan(12500 + 1000);
    expect(puffs.every((p) => p.y - p.height / 2 > 150)).toBe(true);
    expect(puffs.some((p) => p.y > 1200)).toBe(true);
    expect(puffs.some((p) => p.width > 1000)).toBe(true);
    expect(createCloudLayout()).toEqual({ span, puffs });
});

it('moves the regional layer with wind without uploading instance transforms', () => {
    const scene = new THREE.Scene();
    const layer = addClouds(scene, new THREE.Texture());
    expect(scene.children).toHaveLength(1);
    const mesh = scene.children[0];
    if (
        !(mesh instanceof THREE.InstancedMesh) ||
        !(mesh.material instanceof THREE.ShaderMaterial)
    )
        throw new Error('Missing cloud batch');
    expect(mesh.count).toBeGreaterThan(2000);
    const version = mesh.instanceMatrix.version;
    const observer = new THREE.Vector3(6000, 200, -4000);
    for (let i = 0; i < 600; i++) layer.update(1 / 60, observer);
    expect(mesh.material.uniforms.windOffset.value.x).toBeCloseTo(30);
    expect(mesh.material.uniforms.windOffset.value.y).toBeCloseTo(-10);
    layer.update(0, observer);
    expect(mesh.material.uniforms.windOffset.value.x).toBeCloseTo(30);
    expect(mesh.material.uniforms.observer.value.toArray()).toEqual([
        6000, -4000
    ]);
    expect(mesh.instanceMatrix.version).toBe(version);
});
