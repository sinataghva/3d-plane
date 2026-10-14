import { test, expect, vi } from 'vitest';
import { createGroundAtlas } from './groundAtlas.js';
import { groundUploadChunks } from './closeGroundTexture.js';

test('rolling upload pieces cover negative and wrapped rectangles exactly without crossing texture edges', () => {
    for (const rect of [
        { x: -1550, z: -7, w: 1548, h: 1548 },
        { x: 1530, z: 1539, w: 36, h: 34 },
        { x: -16, z: 1450, w: 16, h: 1548 },
        { x: 3090, z: -3100, w: 1548, h: 16 }
    ]) {
        const pieces = groundUploadChunks(rect);
        expect(pieces.reduce((sum, p) => sum + p.w * p.h, 0)).toBe(
            rect.w * rect.h
        );
        for (const [i, p] of pieces.entries()) {
            expect(p.w).toBeGreaterThan(0);
            expect(p.h).toBeGreaterThan(0);
            expect(p.w).toBeLessThanOrEqual(512);
            expect(p.h).toBeLessThanOrEqual(512);
            expect((((p.x % 1548) + 1548) % 1548) + p.w).toBeLessThanOrEqual(
                1548
            );
            expect((((p.z % 1548) + 1548) % 1548) + p.h).toBeLessThanOrEqual(
                1548
            );
            expect(p.x).toBeGreaterThanOrEqual(rect.x);
            expect(p.z).toBeGreaterThanOrEqual(rect.z);
            expect(p.x + p.w).toBeLessThanOrEqual(rect.x + rect.w);
            expect(p.z + p.h).toBeLessThanOrEqual(rect.z + rect.h);
            for (const other of pieces.slice(i + 1))
                expect(
                    p.x >= other.x + other.w ||
                        other.x >= p.x + p.w ||
                        p.z >= other.z + other.h ||
                        other.z >= p.z + p.h
                ).toBe(true);
        }
    }
});

test('dirty rectangle uploads retain a CPU mirror and recover from context loss without repeated full uploads', () => {
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }) };
    const staging = { width: 20, height: 36 };
    let lost = false;
    const calls = [];
    const renderer = {
        getContext: () => ({ isContextLost: () => lost }),
        initTexture: vi.fn(),
        copyTextureToTexture: (source, target, region, dest) =>
            calls.push({
                source,
                target,
                region: region.clone(),
                dest: dest.clone()
            })
    };
    vi.stubGlobal('document', { createElement: () => canvas });
    try {
        const atlas = createGroundAtlas(1548, staging, renderer);
        expect(atlas.upload(0, 0, 16, 32, 2)).toBe(1548 ** 2 * 4);
        expect(atlas.upload(100, 200, 16, 32, 2)).toBe(16 * 32 * 4);
        expect(renderer.initTexture).toHaveBeenCalledTimes(1);
        expect(calls[0].region.min.toArray()).toEqual([2, 2]);
        expect(calls[0].region.max.toArray()).toEqual([18, 34]);
        expect(calls[0].dest.toArray()).toEqual([100, 1316]);
        expect(drawImage).toHaveBeenLastCalledWith(
            staging,
            2,
            2,
            16,
            32,
            100,
            200,
            16,
            32
        );
        lost = true;
        const version = atlas.texture.version;
        atlas.upload(400, 500, 16, 32, 2);
        expect(atlas.texture.version).toBeGreaterThan(version);
        expect(calls).toHaveLength(1);
        lost = false;
        const restoredVersion = atlas.texture.version;
        atlas.upload(600, 700, 16, 32, 2);
        expect(renderer.initTexture).toHaveBeenCalledTimes(2);
        expect(atlas.texture.version).toBeGreaterThan(restoredVersion);
        atlas.dispose();
        expect(canvas.width).toBe(0);
        expect(canvas.height).toBe(0);
    } finally {
        vi.unstubAllGlobals();
    }
});
