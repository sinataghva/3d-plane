import { test, expect, vi } from 'vitest';
import { Scene, PerspectiveCamera, Vector3 } from 'three';
import { createBombMarker } from './bombMarker.js';

test('crosshair uses biased surface triangles above road paint, retaining occlusion', () => {
    const scene = new Scene();
    const marker = createBombMarker(scene, {
        height: () => 0,
        sweep: () => null
    });
    const mesh = scene.getObjectByName('Terrain-draped bomb crosshair');
    expect(mesh.isMesh).toBe(true);
    expect(mesh.material.polygonOffset).toBe(true);
    expect(mesh.material.polygonOffsetFactor).toBeLessThan(-3);
    expect(mesh.material.polygonOffsetUnits).toBeLessThan(-2);
    expect(mesh.material.depthTest).toBe(true);
    expect(mesh.material.depthWrite).toBe(false);
    expect(mesh.renderOrder).toBeGreaterThan(-1);
    marker.dispose();
    expect(scene.children).toHaveLength(0);
});

test('crosshair rotates with heading while every vertex remains on the terrain', () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);
    const scene = new Scene();
    const height = (x, z) => x * 0.1 + z * 0.05;
    const marker = createBombMarker(scene, { height, sweep: () => null });
    const camera = new PerspectiveCamera(60, 1280 / 720, 0.1, 10000);
    camera.position.set(-100, 120, 100);
    camera.lookAt(0, 0, 0);
    const positions = scene.children[0].geometry.attributes.position;
    const snapshots = [];
    for (const yaw of [0, 0.6, -1.2]) {
        marker.update(new Vector3(), camera, false, false, 'ground', yaw);
        const radius = marker.stats().bombMarkerFootprint / 2;
        const normalized = [];
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i),
                z = positions.getZ(i);
            expect(positions.getY(i)).toBeCloseTo(height(x, z) + 0.25, 4);
            normalized.push([
                (x * Math.cos(yaw) - z * Math.sin(yaw)) / radius,
                (x * Math.sin(yaw) + z * Math.cos(yaw)) / radius
            ]);
        }
        snapshots.push(normalized);
    }
    for (const snapshot of snapshots.slice(1))
        snapshot.forEach((p, i) => {
            expect(p[0]).toBeCloseTo(snapshots[0][i][0], 5);
            expect(p[1]).toBeCloseTo(snapshots[0][i][1], 5);
        });
    marker.dispose();
    vi.unstubAllGlobals();
});
