import { test, expect, vi } from 'vitest';
import { Scene, PerspectiveCamera, Vector3 } from 'three';
import { createBombMarker } from './bombMarker.js';

test('crosshair uses biased surface triangles above road paint, retaining occlusion', () => {
    const scene = new Scene();
    const marker = createBombMarker(scene, {
        height: () => 0,
        markerHeight: () => 0
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
    const marker = createBombMarker(scene, { height, markerHeight: height });
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

test('moving marker has a fixed sample budget and stationary views reuse geometry', () => {
    vi.stubGlobal('innerWidth', 1280);
    vi.stubGlobal('innerHeight', 720);
    const scene = new Scene();
    const markerHeight = vi.fn((x, z) => x * 0.1 + z * 0.05);
    const sweep = vi.fn(() => null);
    const marker = createBombMarker(scene, {
        height: () => 0,
        sweep,
        markerHeight
    });
    const camera = new PerspectiveCamera(60, 1280 / 720, 0.1, 10000);
    camera.position.set(-100, 120, 100);
    camera.lookAt(0, 0, 0);
    const point = new Vector3();
    for (let i = 0; i < 20; i++) {
        point.x = i;
        markerHeight.mockClear();
        marker.update(point, camera, false, false, 'building', i * 0.01);
        expect(markerHeight).toHaveBeenCalledTimes(81);
        const positions = scene.children[0].geometry.attributes.position;
        for (let j = 0; j < positions.count; j++) {
            expect(positions.getY(j)).toBeCloseTo(
                positions.getX(j) * 0.1 + positions.getZ(j) * 0.05 + 0.25,
                4
            );
        }
    }
    expect(sweep).not.toHaveBeenCalled();
    markerHeight.mockClear();
    marker.update(point, camera, true, false, 'building', 0.19);
    expect(markerHeight).not.toHaveBeenCalled();
    expect(scene.children[0].material.opacity).toBe(0.4);
    for (const change of [
        () => {
            camera.position.x += 1;
        },
        () => {
            camera.zoom = 2;
            camera.updateProjectionMatrix();
        },
        () => {
            vi.stubGlobal('innerWidth', 1000);
        }
    ]) {
        change();
        markerHeight.mockClear();
        marker.update(point, camera, false, false, 'building', 0.19);
        expect(markerHeight).toHaveBeenCalledTimes(81);
    }
    marker.dispose();
    vi.unstubAllGlobals();
});
