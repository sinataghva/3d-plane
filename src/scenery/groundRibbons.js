import * as THREE from 'three';
import { offsetLine } from './scenerySurfaces.js';

/** Joined road edges, including the seam of closed loops; repeated nodes are ignored.
 * @param {number[][]} source @param {number} width */
export function roadRibbon(source, width) {
    const points = source.filter(
        (p, i) =>
            !i ||
            Math.hypot(p[0] - source[i - 1][0], p[1] - source[i - 1][1]) > 0.01
    );
    if (points.length < 2) return [];
    const closed =
        points.length > 3 &&
        Math.hypot(
            points[0][0] - points[points.length - 1][0],
            points[0][1] - points[points.length - 1][1]
        ) < 0.01;
    const extended = closed
        ? [points[points.length - 2], ...points, points[1]]
        : points;
    let left = offsetLine(extended, width / 2),
        right = offsetLine(extended, -width / 2);
    if (closed) {
        left = left.slice(1, -1);
        right = right.slice(1, -1);
    }
    return points.slice(1).map((p, i) => ({
        a: points[i],
        b: p,
        corners: [left[i], left[i + 1], right[i + 1], right[i]]
    }));
}

/** @typedef {{points:number[][],width:number,kind:import('./groundDetail.js').SurfaceKind,bridge?:number[]}} Ribbon */
/** @typedef {{ribbon:Ribbon,spans:Uint32Array}} RibbonTile */
/** Index source segment/subdivision ranges only. Joined corners are derived on
 * tile construction, never retained for every road in the city.
 * @param {Ribbon} ribbon @param {number} tileSize
 * @param {(x:number,z:number,tile:RibbonTile)=>void} add */
export function indexRibbon(ribbon, tileSize, add) {
    const points = ribbon.points.filter(
        (p, i) =>
            !i ||
            Math.hypot(
                p[0] - ribbon.points[i - 1][0],
                p[1] - ribbon.points[i - 1][1]
            ) > 0.01
    );
    /** @type {Map<string,{x:number,z:number,spans:number[]}>} */
    const tiles = new Map();
    for (let segment = 0; segment < points.length - 1; segment++) {
        const a = points[segment],
            b = points[segment + 1];
        const count = Math.max(
            1,
            Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20)
        );
        let first = 0;
        /** @type {{x:number,z:number,spans:number[]}|undefined} */ let current;
        for (let i = 0; i < count; i++) {
            const x1 = THREE.MathUtils.lerp(a[0], b[0], i / count),
                z1 = THREE.MathUtils.lerp(a[1], b[1], i / count);
            const x2 = THREE.MathUtils.lerp(a[0], b[0], (i + 1) / count),
                z2 = THREE.MathUtils.lerp(a[1], b[1], (i + 1) / count);
            const x = Math.floor((x1 + x2) / 2 / tileSize),
                z = Math.floor((z1 + z2) / 2 / tileSize);
            if (current && current.x === x && current.z === z) continue;
            if (current) current.spans.push(segment, first, i);
            const key = x + ',' + z;
            if (!tiles.has(key)) tiles.set(key, { x, z, spans: [] });
            current = tiles.get(key);
            first = i;
        }
        current?.spans.push(segment, first, count);
    }
    for (const tile of tiles.values())
        add(tile.x, tile.z, { ribbon, spans: new Uint32Array(tile.spans) });
}
/** Only the currently built tile owns the expanded corner objects. Eviction
 * leaves source references and compact ranges, not a city-wide strip cache.
 * @param {RibbonTile[]} tiles
 * @returns {Generator<import('./groundDetail.js').Strip>} */
export function* ribbonStrips(tiles) {
    for (const { ribbon, spans } of tiles) {
        const segments = roadRibbon(ribbon.points, ribbon.width);
        for (let j = 0; j < spans.length; j += 3) {
            const { a, b, corners } = segments[spans[j]];
            const count = Math.max(
                1,
                Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20)
            );
            for (let i = spans[j + 1]; i < spans[j + 2]; i++) {
                const from = i / count,
                    to = (i + 1) / count;
                yield {
                    ax: THREE.MathUtils.lerp(a[0], b[0], from),
                    az: THREE.MathUtils.lerp(a[1], b[1], from),
                    bx: THREE.MathUtils.lerp(a[0], b[0], to),
                    bz: THREE.MathUtils.lerp(a[1], b[1], to),
                    width: ribbon.width,
                    kind: ribbon.kind,
                    bridge: ribbon.bridge,
                    corners: [
                        corners[0].map((v, k) =>
                            THREE.MathUtils.lerp(v, corners[1][k], from)
                        ),
                        corners[0].map((v, k) =>
                            THREE.MathUtils.lerp(v, corners[1][k], to)
                        ),
                        corners[3].map((v, k) =>
                            THREE.MathUtils.lerp(v, corners[2][k], to)
                        ),
                        corners[3].map((v, k) =>
                            THREE.MathUtils.lerp(v, corners[2][k], from)
                        )
                    ]
                };
            }
        }
    }
}
