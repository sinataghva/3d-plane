import { isStructuredBridge } from '../scenery/roadStructures.js';
import { structureSurfaceReady } from '../scenery/roadStructureStream.js';
import { paintCloseFeature } from './closeMapStyle.js';
import { LAND_COLORS } from './cartography.js';
import {
    isSurfaceFeature,
    pavedAirfieldSurface
} from '../scenery/surfaceFeatures.js';
import poiData from '../../data/tehran/map-pois.json';

/** @typedef {import('../scenery/geography.js').GeoFeature} Feature */
/** @typedef {{minX:number,minZ:number,width:number,depth:number}} Bounds */
/** @typedef {{name:string,point:number[],priority:number,icon?:string}} DetailLabel */
export const DETAIL_WIDTH = 4096;
export const FINE_DETAIL_WIDTH = 8192;
export const CLOSE_DETAIL_WIDTH = 16384;
export const TEHRAN_MAX_ZOOM = 16;
export const TILE_SIZE = 512;
export const CACHE_LIMIT = 24;
const ORDER = [
    'dry',
    'grass',
    'field',
    'urban',
    'forest',
    'airfield',
    'water',
    'building',
    'road',
    'rail',
    'waterway',
    'taxiway',
    'runway'
];
const ROAD_RANK = [
    'motorway',
    'trunk',
    'primary',
    'secondary',
    'tertiary',
    'residential'
];
/** @param {{data?:{airfield?:string}}} world */
export const hasDetailMap = (world) =>
    Boolean(world.data?.airfield?.includes('OIII'));
/** @param {number} zoom */
export const detailLevel = (zoom) =>
    zoom > 12 + 1e-8 ? 3 : zoom > 8 + 1e-8 ? 2 : zoom > 4 + 1e-8 ? 1 : 0;
/** @param {number} zoom */
export const visiblePois = (zoom) =>
    detailLevel(zoom)
        ? poiData.pois.filter((p) => zoom + 1e-8 >= p.minZoom)
        : [];

/** Fixed spatial grid referencing existing features; no geometry clone.
 * @param {Bounds} world @param {number} [resolution] @param {boolean} [localStreets] */
export function createDetailIndex(
    world,
    resolution = DETAIL_WIDTH,
    localStreets = false
) {
    const span = world.width / (resolution / TILE_SIZE);
    const columns = resolution / TILE_SIZE,
        rows = Math.ceil(world.depth / span);
    /** @type {Feature[][][]} */
    const buckets = Array.from({ length: columns * rows }, () =>
        ORDER.map(() => [])
    );
    /** @type {DetailLabel[][]} */
    const streets = Array.from({ length: columns * rows }, () => []);
    /** @param {number} x @param {number} z */
    const cell = (x, z) => [
        Math.floor((x - world.minX) / span),
        Math.floor((z - world.minZ) / span)
    ];
    return {
        span,
        columns,
        rows,
        buckets,
        streets,
        /** @param {Feature} f */
        add(f) {
            const order = ORDER.indexOf(f.kind);
            if (
                order < 0 ||
                !f.points.length ||
                (!isSurfaceFeature(f) &&
                    !(f.kind === 'road' && f.tunnel === 'yes'))
            )
                return;
            let minX = Infinity,
                minZ = Infinity,
                maxX = -Infinity,
                maxZ = -Infinity;
            for (const [x, z] of f.points) {
                minX = Math.min(minX, x);
                maxX = Math.max(maxX, x);
                minZ = Math.min(minZ, z);
                maxZ = Math.max(maxZ, z);
            }
            const margin = Math.max(30, f.width || 0);
            const [a, b] = cell(minX - margin, minZ - margin),
                [c, d] = cell(maxX + margin, maxZ + margin);
            for (let y = Math.max(0, b); y <= Math.min(rows - 1, d); y++)
                for (let x = Math.max(0, a); x <= Math.min(columns - 1, c); x++)
                    buckets[y * columns + x][order].push(f);
            const rank = ROAD_RANK.indexOf(f.class || '');
            if (
                f.kind !== 'road' ||
                !f.name ||
                rank < 0 ||
                rank > (localStreets ? 5 : 4)
            )
                return;
            let length = 0;
            for (let i = 1; i < f.points.length; i++)
                length += Math.hypot(
                    f.points[i][0] - f.points[i - 1][0],
                    f.points[i][1] - f.points[i - 1][1]
                );
            if (length < (localStreets ? 80 : 160)) return;
            let point = f.points[Math.floor(f.points.length / 2)];
            if (localStreets) {
                let remaining = length / 2;
                for (let i = 1; i < f.points.length; i++) {
                    const a = f.points[i - 1],
                        b = f.points[i];
                    const segment = Math.hypot(b[0] - a[0], b[1] - a[1]);
                    if (remaining <= segment && segment > 0) {
                        point = [
                            a[0] + ((b[0] - a[0]) * remaining) / segment,
                            a[1] + ((b[1] - a[1]) * remaining) / segment
                        ];
                        break;
                    }
                    remaining -= segment;
                }
            }
            const [x, y] = cell(point[0], point[1]);
            if (x >= 0 && y >= 0 && x < columns && y < rows)
                streets[y * columns + x].push({
                    name: f.name,
                    point,
                    priority: 6 + rank
                });
        },
        /** @param {number[]} box */
        tiles(box) {
            const [a, b] = cell(box[0], box[1]),
                [c, d] = cell(box[2], box[3]);
            const ids = [];
            for (let y = Math.max(0, b); y <= Math.min(rows - 1, d); y++)
                for (let x = Math.max(0, a); x <= Math.min(columns - 1, c); x++)
                    ids.push(y * columns + x);
            return ids;
        }
    };
}

/** Label-free surface painter. Ground style matches the existing terrain palette.
 * @param {CanvasRenderingContext2D} ctx @param {Feature} f @param {number} scale @param {number} minX @param {number} minZ @param {boolean} [ground] */
export function paintFeature(ctx, f, scale, minX, minZ, ground = false) {
    if (ground && (f.kind === 'building' || !isSurfaceFeature(f))) return;
    ctx.beginPath();
    for (const ring of [f.points, ...f.holes]) {
        if (ground && f.line && isStructuredBridge(f)) {
            for (let i = 1; i < ring.length; i++) {
                const a = ring[i - 1],
                    b = ring[i],
                    n = Math.max(
                        1,
                        Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 100)
                    );
                for (let j = 0; j < n; j++) {
                    const t = (j + 0.5) / n;
                    if (
                        structureSurfaceReady(
                            f,
                            a[0] + (b[0] - a[0]) * t,
                            a[1] + (b[1] - a[1]) * t
                        )
                    )
                        continue;
                    ctx.moveTo(
                        (a[0] + ((b[0] - a[0]) * j) / n - minX) * scale + 2,
                        (a[1] + ((b[1] - a[1]) * j) / n - minZ) * scale + 2
                    );
                    ctx.lineTo(
                        (a[0] + ((b[0] - a[0]) * (j + 1)) / n - minX) * scale +
                            2,
                        (a[1] + ((b[1] - a[1]) * (j + 1)) / n - minZ) * scale +
                            2
                    );
                }
            }
            continue;
        }
        ring.forEach(([x, z], i) =>
            i
                ? ctx.lineTo((x - minX) * scale + 2, (z - minZ) * scale + 2)
                : ctx.moveTo((x - minX) * scale + 2, (z - minZ) * scale + 2)
        );
        if (!f.line) ctx.closePath();
    }
    if (!f.line) {
        ctx.fillStyle =
            LAND_COLORS[/** @type {keyof typeof LAND_COLORS} */ (f.kind)] ||
            '#899e67';
        ctx.fill('evenodd');
        return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const major = ['motorway', 'trunk', 'primary'].includes(f.class || '');
    ctx.lineWidth = Math.max(
        f.kind === 'road' ? (major ? 1.25 : 0.55) : 0.7,
        (f.width || 4) * scale
    );
    ctx.strokeStyle =
        f.kind === 'runway'
            ? '#647078'
            : f.kind === 'waterway'
              ? '#4b8d9b'
              : f.kind === 'rail'
                ? '#756e63'
                : f.kind === 'taxiway'
                  ? '#b8bd91'
                  : major
                    ? '#f0d9a5'
                    : '#e5ddc9';
    if (ground) {
        ctx.lineWidth = Math.max(0.6, (f.width || 4) * scale);
        ctx.strokeStyle =
            f.kind === 'runway' || f.kind === 'taxiway'
                ? pavedAirfieldSurface(f, true)
                    ? '#647078'
                    : f.kind === 'runway'
                      ? '#bfd098'
                      : '#a2ac79'
                : f.kind === 'waterway'
                  ? '#4b8d9b'
                  : f.kind === 'rail'
                    ? '#756e63'
                    : '#c3baa4';
    }
    if (f.tunnel === 'yes') {
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = '#8b8981';
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (f.kind === 'runway') {
        ctx.strokeStyle = '#f4f3d5';
        ctx.lineWidth = ground ? Math.max(0.8, scale * 1.5) : 0.6;
        ctx.setLineDash([15 * scale, 15 * scale]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

/** Incremental, on-demand local tile generation. Work only advances while the
 * detailed map is visible; abandoned partial tiles are discarded on panning.
 * @param {Bounds & {data:{features:Feature[]}}} world @param {'classic'|'rich'} [style] */
export function createDetailMap(world, style = 'classic') {
    // Lazily build each level's index on first use; all share source geometry.
    const resolutions = [DETAIL_WIDTH, FINE_DETAIL_WIDTH, CLOSE_DETAIL_WIDTH];
    /** @type {(ReturnType<typeof createDetailIndex>|undefined)[]} */
    const indexes = [];
    const cursors = [0, 0, 0];
    const richPasses = ORDER.flatMap((kind, layer) =>
        kind === 'road'
            ? [
                  { layer, pass: 'casing' },
                  { layer, pass: 'surface' },
                  { layer, pass: 'symbols' }
              ]
            : [{ layer, pass: 'surface' }]
    );
    const KEY_STRIDE = 10000;
    /** @type {Map<number,HTMLCanvasElement>} */ const cache = new Map();
    let revision = 0,
        lastWork = -Infinity;
    /** @type {{id:number,canvas:HTMLCanvasElement,ctx:CanvasRenderingContext2D,layer:number,item:number}|null} */
    let pending = null;
    let labelKey = '';
    /** @type {DetailLabel[]} */ let labelCache = [];
    const metrics = {
        ready: false,
        tiles: 0,
        pending: 0,
        generated: 0,
        maxWorkMs: 0,
        revision: 0,
        labels: 0,
        level: 0,
        resolution: 0,
        backingBytes: 0,
        style: 'classic'
    };
    function release() {
        for (const tile of cache.values()) tile.width = tile.height = 0;
        cache.clear();
        if (pending) pending.canvas.width = pending.canvas.height = 0;
        pending = null;
        labelKey = '';
        labelCache = [];
        revision++;
        metrics.tiles = metrics.pending = 0;
        metrics.backingBytes = 0;
        metrics.level = metrics.resolution = 0;
    }
    return {
        metrics,
        release,
        /** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height @param {{left:number,top:number,scale:number}} projection @param {number} zoom */
        draw(ctx, width, height, projection, zoom) {
            const level = Math.max(1, detailLevel(zoom));
            const rich = level === 3 && style === 'rich';
            const resolution = resolutions[level - 1];
            const index = (indexes[level - 1] ||= createDetailIndex(
                world,
                resolution,
                rich
            ));
            const base = (level - 1) * KEY_STRIDE;
            const passes = rich
                ? richPasses
                : ORDER.map((_, layer) => ({ layer, pass: 'surface' }));
            metrics.ready = cursors[level - 1] === world.data.features.length;
            metrics.style = rich ? 'rich' : 'classic';
            metrics.level = level;
            metrics.resolution = resolution;
            const { left, top, scale } = projection;
            const box = [
                world.minX - left / scale,
                world.minZ - top / scale,
                world.minX + (width - left) / scale,
                world.minZ + (height - top) / scale
            ];
            const centerX = (box[0] + box[2]) / 2,
                centerZ = (box[1] + box[3]) / 2;
            const distance = (/** @type {number} */ id) =>
                Math.hypot(
                    world.minX +
                        (((id - base) % index.columns) + 0.5) * index.span -
                        centerX,
                    world.minZ +
                        (Math.floor((id - base) / index.columns) + 0.5) *
                            index.span -
                        centerZ
                );
            // Hard memory bound even for extreme aspect ratios. Peripheral
            // cells retain the overview if more than 24 tiles are visible.
            const ids = index
                .tiles(box)
                .map((id) => id + base)
                .sort((a, b) => distance(a) - distance(b))
                .slice(0, CACHE_LIMIT);
            if (pending && !ids.includes(pending.id)) {
                pending.canvas.width = pending.canvas.height = 0;
                pending = null;
            }
            const start = performance.now();
            // Multiple input events in one frame must not multiply the budget.
            if (start - lastWork >= 12) {
                lastWork = start;
                while (
                    cursors[level - 1] < world.data.features.length &&
                    performance.now() - start < 3
                ) {
                    const feature = world.data.features[cursors[level - 1]++];
                    index.add(feature);
                }
                if (cursors[level - 1] === world.data.features.length) {
                    metrics.ready = true;
                    const missing = ids
                        .filter((id) => !cache.has(id) && id !== pending?.id)
                        .sort((a, b) => distance(a) - distance(b));
                    while (
                        performance.now() - start < 3 &&
                        (pending || missing.length)
                    ) {
                        if (!pending) {
                            const id = missing.shift();
                            if (id === undefined) break;
                            // Include the in-progress canvas in the total memory cap.
                            while (cache.size >= CACHE_LIMIT) {
                                const oldest = [...cache.keys()].find(
                                    (key) => !ids.includes(key)
                                );
                                if (oldest === undefined) break;
                                const tile = cache.get(oldest);
                                if (tile) tile.width = tile.height = 0;
                                cache.delete(oldest);
                            }
                            const canvas = document.createElement('canvas');
                            canvas.width = canvas.height = TILE_SIZE + 4;
                            const context = canvas.getContext('2d');
                            if (!context) break;
                            context.fillStyle = '#b6a482';
                            context.fillRect(0, 0, canvas.width, canvas.height);
                            pending = {
                                id,
                                canvas,
                                ctx: context,
                                layer: 0,
                                item: 0
                            };
                        }
                        const localId = pending.id - base;
                        const layers = index.buckets[localId];
                        const pass = passes[pending.layer];
                        const f = layers[pass.layer]?.[pending.item++];
                        if (f) {
                            const minX =
                                world.minX +
                                (localId % index.columns) * index.span;
                            const minZ =
                                world.minZ +
                                Math.floor(localId / index.columns) *
                                    index.span;
                            if (
                                !rich ||
                                (f.kind !== 'road' && pass.pass === 'surface')
                            )
                                paintFeature(
                                    pending.ctx,
                                    f,
                                    resolution / world.width,
                                    minX,
                                    minZ
                                );
                            if (rich)
                                paintCloseFeature(
                                    pending.ctx,
                                    f,
                                    resolution / world.width,
                                    minX,
                                    minZ,
                                    /** @type {'surface'|'casing'|'symbols'} */ (
                                        pass.pass
                                    )
                                );
                        } else {
                            pending.layer++;
                            pending.item = 0;
                        }
                        if (pending.layer === passes.length) {
                            cache.set(pending.id, pending.canvas);
                            pending = null;
                            revision++;
                            metrics.generated++;
                            while (cache.size > CACHE_LIMIT) {
                                const oldest = [...cache.keys()].find(
                                    (id) => !ids.includes(id)
                                );
                                if (oldest === undefined) break;
                                const tile = cache.get(oldest);
                                if (tile) tile.width = tile.height = 0;
                                cache.delete(oldest);
                            }
                        }
                    }
                }
                metrics.maxWorkMs = Math.max(
                    metrics.maxWorkMs,
                    performance.now() - start
                );
            }
            ctx.save();
            ctx.beginPath();
            ctx.rect(left, top, world.width * scale, world.depth * scale);
            ctx.clip();
            // Cached coarser tiles remain underneath while finer tiles are prepared.
            const drawIds = [
                ...indexes.slice(0, level - 1).flatMap((grid, i) =>
                    grid
                        ? grid
                              .tiles(box)
                              .map((id) => id + i * KEY_STRIDE)
                              .filter((id) => cache.has(id))
                        : []
                ),
                ...ids
            ];
            for (const id of drawIds) {
                const tile = cache.get(id);
                if (!tile) continue;
                cache.delete(id);
                cache.set(id, tile);
                const grid = indexes[Math.floor(id / KEY_STRIDE)];
                if (!grid) continue;
                const local = id % KEY_STRIDE;
                const x = left + (local % grid.columns) * grid.span * scale,
                    y =
                        top +
                        Math.floor(local / grid.columns) * grid.span * scale;
                ctx.drawImage(
                    tile,
                    2,
                    2,
                    TILE_SIZE,
                    TILE_SIZE,
                    x,
                    y,
                    grid.span * scale,
                    grid.span * scale
                );
            }
            ctx.restore();
            metrics.tiles = cache.size;
            metrics.backingBytes =
                (cache.size + (pending ? 1 : 0)) * (TILE_SIZE + 4) ** 2 * 4;
            metrics.pending = ids.filter((id) => !cache.has(id)).length;
            metrics.revision = revision;
            const key = `${box.map((n) => Math.round(n)).join(',')}:${zoom}:${metrics.ready}`;
            if (key !== labelKey) {
                labelKey = key;
                const names = new Set();
                const streets = metrics.ready
                    ? ids
                          .flatMap((id) => index.streets[id - base])
                          .filter(
                              (s) =>
                                  s.point[0] >= box[0] &&
                                  s.point[0] <= box[2] &&
                                  s.point[1] >= box[1] &&
                                  s.point[1] <= box[3]
                          )
                          .sort((a, b) => a.priority - b.priority)
                    : [];
                labelCache = [
                    ...visiblePois(zoom).map((p) => ({
                        name: p.name,
                        point: p.point,
                        priority:
                            p.minZoom > 8 ? 2.6 + (p.minZoom - 8) * 0.05 : 2.5,
                        icon: '◆'
                    })),
                    ...streets
                        .filter((s) => {
                            if (names.has(s.name)) return false;
                            names.add(s.name);
                            return true;
                        })
                        .slice(0, 200)
                ];
            }
            metrics.labels = labelCache.length;
            return labelCache;
        }
    };
}
