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
    zoom > 8 + 1e-8 ? 2 : zoom > 4 + 1e-8 ? 1 : 0;
/** @param {number} zoom */
export const visiblePois = (zoom) =>
    detailLevel(zoom)
        ? poiData.pois.filter((p) => zoom + 1e-8 >= p.minZoom)
        : [];

/** Fixed spatial grid referencing existing features; no geometry clone.
 * @param {Bounds} world @param {number} [resolution] */
export function createDetailIndex(world, resolution = DETAIL_WIDTH) {
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
            if (order < 0 || !f.points.length || !isSurfaceFeature(f)) return;
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
            if (f.kind !== 'road' || !f.name || rank < 0 || rank > 4) return;
            let length = 0;
            for (let i = 1; i < f.points.length; i++)
                length += Math.hypot(
                    f.points[i][0] - f.points[i - 1][0],
                    f.points[i][1] - f.points[i - 1][1]
                );
            if (length < 160) return;
            const point = f.points[Math.floor(f.points.length / 2)];
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
    if (ground && f.kind === 'building') return;
    ctx.beginPath();
    for (const ring of [f.points, ...f.holes]) {
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
    ctx.stroke();
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
 * @param {Bounds & {data:{features:Feature[]}}} world */
export function createDetailMap(world) {
    // Both grids reference the same geometry; labels stay separate from surfaces.
    const indexes = [
        createDetailIndex(world),
        createDetailIndex(world, FINE_DETAIL_WIDTH)
    ];
    const KEY_STRIDE = 10000;
    /** @type {Map<number,HTMLCanvasElement>} */ const cache = new Map();
    let cursor = 0,
        revision = 0,
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
        backingBytes: 0
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
            const index = indexes[level - 1];
            const base = (level - 1) * KEY_STRIDE;
            const resolution = level === 2 ? FINE_DETAIL_WIDTH : DETAIL_WIDTH;
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
                    cursor < world.data.features.length &&
                    performance.now() - start < 3
                ) {
                    const feature = world.data.features[cursor++];
                    for (const grid of indexes) grid.add(feature);
                }
                if (cursor === world.data.features.length) {
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
                        const f = layers[pending.layer]?.[pending.item++];
                        if (f)
                            paintFeature(
                                pending.ctx,
                                f,
                                resolution / world.width,
                                world.minX +
                                    (localId % index.columns) * index.span,
                                world.minZ +
                                    Math.floor(localId / index.columns) *
                                        index.span
                            );
                        else {
                            pending.layer++;
                            pending.item = 0;
                        }
                        if (pending.layer === ORDER.length) {
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
            const drawIds =
                level === 2
                    ? [
                          ...indexes[0]
                              .tiles(box)
                              .filter((id) => cache.has(id)),
                          ...ids
                      ]
                    : ids;
            for (const id of drawIds) {
                const tile = cache.get(id);
                if (!tile) continue;
                cache.delete(id);
                cache.set(id, tile);
                const grid = indexes[Math.floor(id / KEY_STRIDE)];
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
