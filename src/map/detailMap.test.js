import { expect, test, vi } from 'vitest';
import {
    createDetailIndex,
    detailLevel,
    visiblePois,
    hasDetailMap,
    DETAIL_WIDTH,
    FINE_DETAIL_WIDTH,
    TILE_SIZE,
    CACHE_LIMIT
} from './detailMap.js';
import { createDetailMap } from './detailMap.js';
import { createMapViewport } from './mapViewport.js';
const bounds = { minX: 0, minZ: 0, width: 8000, depth: 5100 };
test('only Tehran opts into a 1200% viewport with two detail transitions', () => {
    expect(hasDetailMap({ data: { airfield: 'Mehrabad · OIII' } })).toBe(true);
    expect(hasDetailMap({ data: { airfield: 'Luxeuil · LFSX' } })).toBe(false);
    const view = createMapViewport(1000, 700, bounds, 12);
    view.zoomAt(100, 500, 350);
    expect(view.view.zoom).toBe(12);
    expect(createMapViewport(1000, 700, bounds).maxZoom()).toBe(4);
    expect([1, 4, 4.2, 6, 8, 8.01, 10, 12].map(detailLevel)).toEqual([
        0, 0, 1, 1, 1, 2, 2, 2
    ]);
    view.reset();
    expect(view.view.zoom).toBe(1);
    expect(DETAIL_WIDTH).toBe(4096);
    expect(FINE_DETAIL_WIDTH).toBe(8192);
    expect(TILE_SIZE).toBe(512);
    expect(CACHE_LIMIT).toBe(24);
});
test('POIs progressively reveal civic places, not businesses or the eight models', () => {
    expect(visiblePois(4)).toEqual([]);
    expect(visiblePois(4.2).length).toBeLessThan(visiblePois(6).length);
    expect(visiblePois(6).length).toBeLessThan(visiblePois(8).length);
    expect(visiblePois(8)).toHaveLength(19);
    expect(new Set(visiblePois(8).map((p) => p.id)).size).toBe(19);
    expect(visiblePois(8.01).length).toBeGreaterThan(19);
    expect(visiblePois(10).length).toBeGreaterThan(visiblePois(8.01).length);
    expect(visiblePois(12)).toHaveLength(40);
    expect(new Set(visiblePois(12).map((p) => p.id)).size).toBe(40);
    for (const p of visiblePois(12)) {
        expect([
            'government',
            'park',
            'museum',
            'library',
            'garden',
            'square',
            'university',
            'arts',
            'transport'
        ]).toContain(p.category);
        expect(p.point.every(Number.isFinite)).toBe(true);
        expect(p.nameEn).not.toMatch(
            /Azadi|Milad|Golestan|Tabiat|White palace|Niavaran|University of Tehran/i
        );
    }
});
test('spatial index queries only intersecting cells, includes line-width margins and shares geometry', () => {
    const index = createDetailIndex(bounds);
    const f = {
        id: 'road',
        kind: 'road',
        name: 'خیابان',
        class: 'primary',
        points: [
            [800, 500],
            [990, 500]
        ],
        holes: [],
        line: true,
        width: 20
    };
    index.add(f);
    expect(index.tiles([0, 0, 999, 999])).toEqual([0]);
    expect(index.buckets[0].flat()).toContain(f);
    expect(index.buckets[1].flat()).toContain(f);
    expect(index.buckets[2].flat()).toEqual([]);
    expect(index.streets[0][0].name).toBe('خیابان');
    expect(index.tiles([-3000, -3000, -2000, -2000])).toEqual([]);
    expect(index.tiles([7900, 5000, 9000, 6000])).toEqual([47]);
    const fine = createDetailIndex(bounds, FINE_DETAIL_WIDTH);
    fine.add(f);
    expect(fine.columns).toBe(16);
    expect(fine.span).toBe(index.span / 2);
    expect(fine.buckets[1].flat()).toContain(f);
    index.add({ ...f, id: 'tunnel', tunnel: 'yes' });
    expect(index.buckets[0].flat()).toHaveLength(1);
});

test('tile cache evicts old regions and releases backing canvases', () => {
    /** @type {{width:number,height:number}[]} */
    const canvases = [];
    const ctx = new Proxy({}, { get: () => () => {} });
    let clock = 0;
    vi.stubGlobal('performance', { now: () => (clock += 0.05) });
    vi.stubGlobal('document', {
        createElement: () => {
            const canvas = { width: 0, height: 0, getContext: () => ctx };
            canvases.push(canvas);
            return canvas;
        }
    });
    try {
        const world = { ...bounds, data: { features: [] } };
        const detail = createDetailMap(world);
        for (let id = 0; id < 40; id++) {
            for (let n = 0; n < 10; n++) {
                clock += 20;
                detail.draw(
                    /** @type {CanvasRenderingContext2D} */ (ctx),
                    100,
                    100,
                    {
                        left: -(id % 8) * 1000 - 50,
                        top: -Math.floor(id / 8) * 1000 - 50,
                        scale: 1
                    },
                    8
                );
                if (detail.metrics.pending === 0) break;
            }
            expect(detail.metrics.pending).toBe(0);
            expect(detail.metrics.tiles).toBeLessThanOrEqual(CACHE_LIMIT);
        }
        expect(detail.metrics.generated).toBe(40);
        expect(canvases.filter((c) => c.width > 0)).toHaveLength(CACHE_LIMIT);
        for (const zoom of [8.01, 12, 8, 8.01, 4.2]) {
            for (let n = 0; n < 20; n++) {
                clock += 20;
                detail.draw(
                    /** @type {CanvasRenderingContext2D} */ (ctx),
                    800,
                    600,
                    { left: -200, top: -200, scale: 1 },
                    zoom
                );
                expect(
                    canvases.filter((c) => c.width > 0).length
                ).toBeLessThanOrEqual(CACHE_LIMIT);
                if (!detail.metrics.pending) break;
            }
            expect(detail.metrics.pending).toBe(0);
            expect(detail.metrics.resolution).toBe(zoom > 8 ? 8192 : 4096);
            expect(detail.metrics.backingBytes).toBeLessThanOrEqual(
                CACHE_LIMIT * 516 * 516 * 4
            );
        }
        detail.release();
        expect(detail.metrics.tiles).toBe(0);
        expect(canvases.every((c) => c.width === 0 && c.height === 0)).toBe(
            true
        );
        for (let n = 0; n < 100; n++) {
            clock += 20;
            detail.draw(
                /** @type {CanvasRenderingContext2D} */ (ctx),
                8000,
                5100,
                { left: 0, top: 0, scale: 1 },
                4.2
            );
            if (detail.metrics.pending === 0) break;
        }
        expect(detail.metrics.pending).toBe(0);
        expect(detail.metrics.tiles).toBeLessThanOrEqual(CACHE_LIMIT);
        detail.release();
    } finally {
        vi.unstubAllGlobals();
    }
});
