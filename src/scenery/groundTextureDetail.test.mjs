import { test, expect, vi } from 'vitest';
import * as THREE from 'three';
import {
    createGroundTextureDetail,
    groundTextureStrength,
    GROUND_TEXTURE_BYTES
} from './groundTextureDetail.js';
import { paintFeature } from '../map/detailMap.js';

test('ground detail is smoothly altitude gated and Low opts out', () => {
    expect(groundTextureStrength(0, 'high')).toBe(1);
    expect(groundTextureStrength(550, 'balanced')).toBe(1);
    expect(groundTextureStrength(750, 'high')).toBeCloseTo(0.5);
    expect(groundTextureStrength(950, 'high')).toBe(0);
    expect(groundTextureStrength(0, 'low')).toBe(0);
});

test('ground style never paints buildings or labels and respects paved/grass airfield surfaces', () => {
    const ctx = {
        beginPath: vi.fn(),
        moveTo() {},
        lineTo() {},
        stroke() {},
        setLineDash() {}
    };
    const feature = {
        kind: 'building',
        points: [
            [0, 0],
            [100, 100]
        ],
        holes: [],
        line: true
    };
    paintFeature(ctx, feature, 1, 0, 0, true);
    expect(ctx.beginPath).not.toHaveBeenCalled();
    paintFeature(ctx, { ...feature, kind: 'taxiway' }, 1, 0, 0, true);
    expect(ctx.strokeStyle).toBe('#647078');
    paintFeature(
        ctx,
        { ...feature, kind: 'taxiway', surface: 'grass' },
        1,
        0,
        0,
        true
    );
    expect(ctx.strokeStyle).toBe('#a2ac79');
});

test('bounded terrain atlas reuses tiles, evicts across travel, falls back at altitude, and releases on reset/Low/dispose', () => {
    const canvases = [];
    const ctx = new Proxy({}, { get: () => () => {} });
    let clock = 0;
    vi.stubGlobal('performance', { now: () => (clock += 0.05) });
    vi.stubGlobal('document', {
        createElement: () => {
            const c = { width: 0, height: 0, getContext: () => ctx };
            canvases.push(c);
            return c;
        }
    });
    const world = {
        minX: 0,
        minZ: 0,
        width: 16000,
        depth: 12000,
        data: { airfield: 'OIII', features: [] },
        dem: { size: 2, values: [0, 0, 0, 0] },
        height: () => 0
    };
    try {
        const material = new THREE.MeshLambertMaterial();
        const detail = createGroundTextureDetail(world, material);
        detail.update({ x: 4000, y: 100, z: 4000 }, 'high', -1);
        expect(detail.stats().groundTextureStrength).toBe(0);
        const shader = {
            uniforms: {},
            vertexShader: '#include <begin_vertex>',
            fragmentShader: '#include <map_fragment>'
        };
        material.onBeforeCompile(shader, {});
        expect(shader.fragmentShader).toContain('fineGroundAtlas');
        expect(shader.fragmentShader).toContain('seam');
        for (const [x, z] of [
            [4000, 4000],
            [7000, 5000],
            [12000, 8000],
            [4000, 4000]
        ]) {
            for (let n = 0; n < 50; n++)
                detail.update({ x, y: 100, z }, 'high', 0.1);
            expect(detail.stats().groundTexturePending).toBe(0);
            expect(detail.stats().groundTextureTiles).toBe(9);
            expect(detail.stats().groundTextureBytes).toBe(
                GROUND_TEXTURE_BYTES + 4
            );
            expect(canvases.filter((c) => c.width > 0)).toHaveLength(3);
            const count = detail.stats().groundTextureGenerated;
            detail.update({ x, y: 100, z }, 'high', 0.1);
            expect(detail.stats().groundTextureGenerated).toBe(count);
        }
        for (let n = 0; n < 30; n++)
            detail.update({ x: 4000, y: 1200, z: 4000 }, 'high', 0.1);
        expect(detail.stats().groundTextureStrength).toBeLessThan(0.001);
        expect(detail.stats().groundTexturePending).toBe(0);
        detail.reset();
        expect(detail.stats().groundTextureBytes).toBe(0);
        expect(canvases.every((c) => !c.width && !c.height)).toBe(true);
        for (let n = 0; n < 50; n++)
            detail.update({ x: 4000, y: 100, z: 4000 }, 'balanced', 0.1);
        expect(detail.stats().groundTextureTiles).toBe(9);
        detail.update({ x: 4000, y: 100, z: 4000 }, 'low', 0.1);
        expect(detail.stats().groundTextureBytes).toBe(0);
        detail.dispose();
        detail.update({ x: 4000, y: 100, z: 4000 }, 'high', 0.1);
        expect(detail.stats().groundTextureTiles).toBe(0);
        for (const airfield of ['LFSX', 'LFPZ']) {
            const other = new THREE.MeshLambertMaterial();
            const original = other.onBeforeCompile;
            const noDetail = createGroundTextureDetail(
                { ...world, data: { ...world.data, airfield } },
                other
            );
            noDetail.update({ x: 4000, y: 100, z: 4000 }, 'high', 0.1);
            expect(other.onBeforeCompile).toBe(original);
            expect(noDetail.stats().groundTextureResolution).toBe(0);
            expect(noDetail.stats().groundTextureBytes).toBe(0);
        }
    } finally {
        vi.unstubAllGlobals();
    }
});
