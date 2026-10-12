import { expect, test } from 'vitest';
import { indexRibbon, ribbonStrips } from './groundRibbons.js';

/** @param {number[][]} points */
function tilesFor(points) {
    /** @type {Map<string,import('./groundRibbons.js').RibbonTile[]>} */
    const tiles = new Map();
    indexRibbon({ points, width: 10, kind: 'road' }, 500, (x, z, tile) => {
        const key = `${x},${z}`;
        if (!tiles.has(key)) tiles.set(key, []);
        tiles.get(key)?.push(tile);
    });
    return tiles;
}

test('a long road retains compact ranges and rebuilds each subdivision once in its original tile', () => {
    const points = [
        [-1000, 0],
        [1000, 0]
    ];
    const tiles = tilesFor(points);
    expect([...tiles.keys()]).toEqual(['-2,0', '-1,0', '0,0', '1,0']);
    const all = [];
    for (const [key, entries] of tiles) {
        expect(entries[0].ribbon.points).toBe(points);
        expect(entries[0].spans.byteLength).toBe(12);
        const strips = [...ribbonStrips(entries)];
        expect(strips).toHaveLength(25);
        for (const strip of strips) {
            expect(`${Math.floor((strip.ax + strip.bx) / 1000)},0`).toBe(key);
            expect(strip.bx - strip.ax).toBeCloseTo(20, 10);
        }
        all.push(...strips);
        // Evict/revisit: reconstruction is deterministic and retains no expanded cache.
        expect([...ribbonStrips(entries)]).toEqual(strips);
    }
    expect(all).toHaveLength(100);
    expect(all[0].corners).toEqual([
        [-1000, 5],
        [-980, 5],
        [-980, -5],
        [-1000, -5]
    ]);
    for (let i = 1; i < all.length; i++) {
        expect(all[i - 1].corners?.[1]).toEqual(all[i].corners?.[0]);
        expect(all[i - 1].corners?.[2]).toEqual(all[i].corners?.[3]);
    }
});

test('mitered turns and closed seams survive lazy reconstruction across tile boundaries', () => {
    const points = [
        [0, 0],
        [0, 0],
        [1000, 0],
        [1000, 1000],
        [0, 1000],
        [0, 0]
    ];
    const strips = [...tilesFor(points).values()].flatMap((entries) => [
        ...ribbonStrips(entries)
    ]);
    expect(strips).toHaveLength(200);
    const incoming = strips.find((s) => s.bx === 1000 && s.bz === 0);
    const outgoing = strips.find((s) => s.ax === 1000 && s.az === 0);
    expect(incoming?.corners?.[1]).toEqual([995, 5]);
    expect(incoming?.corners?.[1]).toEqual(outgoing?.corners?.[0]);
    expect(incoming?.corners?.[2]).toEqual(outgoing?.corners?.[3]);
    const first = strips.find((s) => s.ax === 0 && s.az === 0);
    const last = strips.find((s) => s.bx === 0 && s.bz === 0);
    expect(last?.corners?.[1]).toEqual(first?.corners?.[0]);
    expect(last?.corners?.[2]).toEqual(first?.corners?.[3]);
});

test('empty and duplicate-only ways allocate no tiles; bridge profiles stay shared', () => {
    expect(tilesFor([]).size).toBe(0);
    expect(
        tilesFor([
            [1, 2],
            [1, 2]
        ]).size
    ).toBe(0);
    const bridge = [1, 2, 3];
    indexRibbon(
        {
            points: [
                [0, 0],
                [30, 0]
            ],
            width: 8,
            kind: 'path',
            bridge
        },
        500,
        (_x, _z, tile) => {
            for (const strip of ribbonStrips([tile])) {
                expect(strip.bridge).toBe(bridge);
                expect(strip.kind).toBe('path');
                expect(strip.width).toBe(8);
            }
        }
    );
});
