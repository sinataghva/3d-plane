import * as THREE from 'three';

export const GROUND_DETAIL_PRESETS = {
    low: { radius: 0, tiles: 0, fine: false },
    balanced: { radius: 850, tiles: 20, fine: false },
    high: { radius: 1700, tiles: 48, fine: true }
};
const TILE = 500;
const CACHE_LIMIT = 80;
/** @typedef {'road'|'asphalt'|'grass'|'paint'|'wear'|'number0'|'number1'} SurfaceKind */
/** @typedef {{ax:number,az:number,bx:number,bz:number,width:number,kind:SurfaceKind}} Strip */
/** @typedef {{x:number,z:number,y:number,strips:Strip[],priority:number}} Tile */
/** Interpolate the same triangles as the existing 256×256 terrain mesh. */
/** @param {import('./geography.js').Geography} world */
export function createRenderedHeight(world) {
    const stepX = world.width / 256,
        stepZ = world.depth / 256;
    const heights = new Float32Array(257 * 257);
    for (let z = 0; z <= 256; z++)
        for (let x = 0; x <= 256; x++)
            heights[z * 257 + x] = world.height(
                world.minX + x * stepX,
                world.minZ + z * stepZ
            );
    /** @param {number} x @param {number} z */
    return (x, z) => {
        const gx = THREE.MathUtils.clamp(
                (x - world.minX) / stepX,
                0,
                255.999999
            ),
            gz = THREE.MathUtils.clamp((z - world.minZ) / stepZ, 0, 255.999999);
        const ix = Math.floor(gx),
            iz = Math.floor(gz),
            fx = gx - ix,
            fz = gz - iz,
            i = iz * 257 + ix;
        return fx + fz <= 1
            ? heights[i] +
                  fx * (heights[i + 1] - heights[i]) +
                  fz * (heights[i + 257] - heights[i])
            : heights[i + 258] +
                  (1 - fx) * (heights[i + 257] - heights[i + 258]) +
                  (1 - fz) * (heights[i + 1] - heights[i + 258]);
    };
}
/** @param {number} distance @param {number} radius */
export function detailOpacity(distance, radius) {
    if (radius <= 0) return 0;
    return 1 - THREE.MathUtils.smoothstep(distance, radius * 0.6, radius);
}
/** Clip a ribbon to the terrain mesh's existing triangle grid.
 * @param {number[][]} corners
 * @param {{width:number,depth:number,minX:number,minZ:number}} world
 * @returns {number[][]} */
export function clipToTerrain(corners, world) {
    const sx = world.width / 256,
        sz = world.depth / 256;
    const xs = corners.map((p) => p[0]),
        zs = corners.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor((Math.min(...xs) - world.minX) / sx)),
        x1 = Math.min(255, Math.floor((Math.max(...xs) - world.minX) / sx));
    const z0 = Math.max(0, Math.floor((Math.min(...zs) - world.minZ) / sz)),
        z1 = Math.min(255, Math.floor((Math.max(...zs) - world.minZ) / sz));
    const result = [];
    for (let iz = z0; iz <= z1; iz++)
        for (let ix = x0; ix <= x1; ix++) {
            const x = world.minX + ix * sx,
                z = world.minZ + iz * sz;
            for (const tri of [
                [
                    [x, z],
                    [x + sx, z],
                    [x, z + sz]
                ],
                [
                    [x + sx, z + sz],
                    [x, z + sz],
                    [x + sx, z]
                ]
            ]) {
                let poly = corners;
                for (let edge = 0; edge < 3 && poly.length; edge++) {
                    const a = tri[edge],
                        b = tri[(edge + 1) % 3];
                    const output = [];
                    for (let i = 0; i < poly.length; i++) {
                        const p = poly[i],
                            q = poly[(i + 1) % poly.length];
                        const dp =
                            (b[0] - a[0]) * (p[1] - a[1]) -
                            (b[1] - a[1]) * (p[0] - a[0]);
                        const dq =
                            (b[0] - a[0]) * (q[1] - a[1]) -
                            (b[1] - a[1]) * (q[0] - a[0]);
                        if (dp >= -1e-8) output.push(p);
                        if (dp >= 0 !== dq >= 0) {
                            const t = dp / (dp - dq);
                            output.push([
                                p[0] + (q[0] - p[0]) * t,
                                p[1] + (q[1] - p[1]) * t
                            ]);
                        }
                    }
                    poly = output;
                }
                for (let i = 1; i < poly.length - 1; i++)
                    result.push(poly[0], poly[i], poly[i + 1]);
            }
        }
    return result;
}
/** @param {number} size @param {boolean} grass */
function noiseTexture(size, grass) {
    const data = new Uint8Array(size * size * 4);
    let seed = 23917;
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const noise = seed / 4294967296 - 0.5;
            const v = grass ? 220 + noise * 24 : 175 + noise * 45;
            const i = (y * size + x) * 4;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = 255;
        }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
}
/** @param {string} number */
function numberTexture(number) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Runway marking canvas unavailable');
    ctx.fillStyle = '#eee9cf';
    ctx.font = 'bold 220px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, 128, 256, 230);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
}
/** @param {import('./geography.js').Geography} world */
export function createGroundDetail(world) {
    const group = new THREE.Group();
    group.name = 'nearby-ground-detail';
    const height = createRenderedHeight(world);
    /** @type {Map<string,Tile>} */ const index = new Map();
    /** @param {number} ax @param {number} az @param {number} bx @param {number} bz @param {number} width @param {SurfaceKind} kind */
    function add(ax, az, bx, bz, width, kind) {
        const n = kind.startsWith('number')
            ? 1
            : Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 20));
        for (let i = 0; i < n; i++) {
            const x1 = THREE.MathUtils.lerp(ax, bx, i / n),
                z1 = THREE.MathUtils.lerp(az, bz, i / n),
                x2 = THREE.MathUtils.lerp(ax, bx, (i + 1) / n),
                z2 = THREE.MathUtils.lerp(az, bz, (i + 1) / n);
            const x = Math.floor((x1 + x2) / 2 / TILE),
                z = Math.floor((z1 + z2) / 2 / TILE),
                key = `${x},${z}`;
            let tile = index.get(key);
            if (!tile) {
                tile = {
                    x: (x + 0.5) * TILE,
                    z: (z + 0.5) * TILE,
                    y: height((x + 0.5) * TILE, (z + 0.5) * TILE),
                    strips: [],
                    priority: kind === 'road' ? 1 : 0
                };
                index.set(key, tile);
            }
            tile.priority = Math.min(tile.priority, kind === 'road' ? 1 : 0);
            tile.strips.push({ ax: x1, az: z1, bx: x2, bz: z2, width, kind });
        }
    }
    const jet = Boolean(world.data.airfield?.includes('LFSX'));
    let numbers = ['11', '29'];
    for (const f of world.data.features) {
        if (!f.line || !['road', 'runway', 'taxiway'].includes(f.kind))
            continue;
        // Pedestrian paths remain in the distant base map.
        if (
            f.kind === 'road' &&
            ['footway', 'path', 'steps', 'cycleway'].includes(f.class || '')
        )
            continue;
        const kind =
            f.kind === 'runway'
                ? jet
                    ? 'asphalt'
                    : 'grass'
                : f.kind === 'taxiway'
                  ? jet
                      ? 'asphalt'
                      : 'grass'
                  : 'road';
        const width = f.width || (f.kind === 'road' ? 5 : 20);
        for (let i = 1; i < f.points.length; i++)
            add(
                f.points[i - 1][0],
                f.points[i - 1][1],
                f.points[i][0],
                f.points[i][1],
                width,
                kind
            );
        if (f.kind !== 'runway') continue;
        const a = f.points[0],
            b = f.points[f.points.length - 1],
            length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const dx = (b[0] - a[0]) / length,
            dz = (b[1] - a[1]) / length;
        /** @param {number} from @param {number} to @param {number} offset @param {number} w @param {SurfaceKind} kind */
        const line = (from, to, offset, w, kind) =>
            add(
                a[0] + dx * from - dz * offset,
                a[1] + dz * from + dx * offset,
                a[0] + dx * to - dz * offset,
                a[1] + dz * to + dx * offset,
                w,
                kind
            );
        if (jet) {
            for (let t = 160; t < length - 160; t += 60)
                line(t, Math.min(t + 30, length - 160), 0, 0.9, 'paint');
            line(15, length - 15, -width * 0.46, 0.45, 'paint');
            line(15, length - 15, width * 0.46, 0.45, 'paint');
            for (const side of [-1, 1])
                for (let i = 1; i <= 4; i++) {
                    line(30, 65, side * i * width * 0.08, 1.5, 'paint');
                    line(
                        length - 65,
                        length - 30,
                        side * i * width * 0.08,
                        1.5,
                        'paint'
                    );
                }
            for (const side of [-1, 1])
                for (let j = 0; j < 3; j++) {
                    line(
                        210 + j * 23,
                        350 + j * 37,
                        side * (3 + j * 0.7),
                        0.35,
                        'wear'
                    );
                    line(
                        length - 350 - j * 37,
                        length - 210 - j * 23,
                        side * (3 + j * 0.7),
                        0.35,
                        'wear'
                    );
                }
            const bearing = ((Math.atan2(dx, -dz) * 180) / Math.PI + 360) % 360;
            const first = String(Math.round(bearing / 10) || 36).padStart(
                2,
                '0'
            );
            const refs = (f.ref || '11/29').split('/');
            numbers = refs[0]?.startsWith(first)
                ? refs
                : [refs[1] || '29', refs[0] || '11'];
            line(95, 120, 0, 14, 'number0');
            line(length - 95, length - 120, 0, 14, 'number1');
        } else {
            // Grass strips have sparse boundary indicators, not paved-runway stripes.
            for (let t = 0; t < length; t += 120)
                for (const side of [-1, 1])
                    line(t, t + 4, side * width * 0.47, 1.5, 'paint');
        }
    }
    const grain = noiseTexture(512, false),
        grass = noiseTexture(512, true),
        coarse = noiseTexture(128, false);
    const numberMaps = numbers.map(numberTexture);
    const textures = [grain, grass, coarse, ...numberMaps];
    /** @typedef {{group:THREE.Group,materials:THREE.MeshStandardMaterial[],alpha:number,last:number}} CachedTile */
    /** @type {Map<string,CachedTile>} */ const cache = new Map();
    let scan = 0,
        clock = 0,
        lastQuality = '',
        disposed = false;
    /** @type {{key:string,distance:number}[]} */ let wanted = [];
    /** @param {CachedTile} tile */
    function disposeTile(tile) {
        group.remove(tile.group);
        tile.group.traverse((o) => {
            if (o instanceof THREE.Mesh) o.geometry.dispose();
        });
        tile.materials.forEach((m) => m.dispose());
    }
    /** @param {Tile} tile */
    function build(tile) {
        const root = new THREE.Group();
        const materials = [];
        /** @type {Map<SurfaceKind,{p:number[],uv:number[]}>} */ const buckets =
            new Map();
        for (const strip of tile.strips) {
            let bucket = buckets.get(strip.kind);
            if (!bucket) {
                bucket = { p: [], uv: [] };
                buckets.set(strip.kind, bucket);
            }
            const dx = strip.bx - strip.ax,
                dz = strip.bz - strip.az,
                len = Math.hypot(dx, dz);
            if (len < 0.01) continue;
            const nx = ((-dz / len) * strip.width) / 2,
                nz = ((dx / len) * strip.width) / 2;
            const corners = [
                [strip.ax + nx, strip.az + nz],
                [strip.bx + nx, strip.bz + nz],
                [strip.bx - nx, strip.bz - nz],
                [strip.ax - nx, strip.az - nz]
            ];
            const overlay = ['paint', 'wear', 'number0', 'number1'].includes(
                strip.kind
            );
            // Split every surface at the base terrain's triangle boundaries.
            // Corner-only height sampling lets long/wide strips cut through hills.
            const triangles = clipToTerrain(corners, world);
            for (const [x, z] of triangles) {
                bucket.p.push(x, height(x, z) + (overlay ? 0.08 : 0.04), z);
                if (strip.kind.startsWith('number')) {
                    bucket.uv.push(
                        0.5 -
                            ((x - strip.ax) * (-dz / len) +
                                (z - strip.az) * (dx / len)) /
                                strip.width,
                        ((x - strip.ax) * dx + (z - strip.az) * dz) /
                            (len * len)
                    );
                } else bucket.uv.push(x / 4, z / 4);
            }
        }
        for (const [kind, b] of buckets) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(b.p, 3)
            );
            geometry.setAttribute(
                'uv',
                new THREE.Float32BufferAttribute(b.uv, 2)
            );
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();
            const paint = kind === 'paint' || kind.startsWith('number'),
                wear = kind === 'wear';
            const material = new THREE.MeshStandardMaterial({
                color: paint
                    ? 0xf0edce
                    : wear
                      ? 0x33363a
                      : kind === 'grass'
                        ? 0x94ab70
                        : kind === 'road'
                          ? 0x929798
                          : 0x939ca3,
                roughness: 1,
                metalness: 0,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                side: THREE.FrontSide,
                polygonOffset: true,
                polygonOffsetFactor: paint || wear ? -3 : -2,
                polygonOffsetUnits: -2
            });
            material.userData.kind = kind;
            material.userData.maximum = wear ? 0.23 : 1;
            if (kind.startsWith('number'))
                material.map = numberMaps[kind === 'number0' ? 0 : 1];
            materials.push(material);
            const mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            // Composite terrain overlays before transparent airborne effects
            // (afterburner, canopy, etc.), while retaining surface/paint order.
            mesh.renderOrder = paint || wear ? -1 : -2;
            root.add(mesh);
        }
        group.add(root);
        return { group: root, materials, alpha: 0, last: clock };
    }
    return {
        group,
        /** @param {{x:number,y:number,z:number}} position @param {string} quality @param {number} delta */
        update(position, quality, delta) {
            if (disposed) return;
            clock += delta;
            scan -= delta;
            const settings =
                GROUND_DETAIL_PRESETS[
                    /** @type {keyof typeof GROUND_DETAIL_PRESETS} */ (quality)
                ] ?? GROUND_DETAIL_PRESETS.high;
            if (scan <= 0 || quality !== lastQuality) {
                wanted = [];
                if (settings.radius)
                    for (const [key, tile] of index) {
                        const dx = Math.max(
                                0,
                                Math.abs(position.x - tile.x) - TILE / 2
                            ),
                            dz = Math.max(
                                0,
                                Math.abs(position.z - tile.z) - TILE / 2
                            ),
                            dy = Math.max(
                                0,
                                Math.abs(position.y - tile.y) - 60
                            );
                        const distance = Math.hypot(dx, dz, dy);
                        if (
                            distance < settings.radius ||
                            (cache.has(key) &&
                                distance < settings.radius * 1.15)
                        )
                            wanted.push({ key, distance });
                    }
                wanted.sort((a, b) => a.distance - b.distance);
                wanted = wanted.slice(0, settings.tiles);
                scan = 0.25;
            }
            const distances = new Map(wanted.map((t) => [t.key, t.distance]));
            let built = 0;
            for (const { key } of wanted)
                if (!cache.has(key) && built < 2) {
                    if (cache.size >= CACHE_LIMIT) {
                        const candidate = [...cache]
                            .filter(([k]) => !distances.has(k))
                            .sort((a, b) => a[1].last - b[1].last)[0];
                        if (!candidate) continue;
                        disposeTile(candidate[1]);
                        cache.delete(candidate[0]);
                    }
                    cache.set(key, build(/** @type {Tile} */ (index.get(key))));
                    built++;
                }
            for (const [key, tile] of cache) {
                const distance = distances.get(key),
                    target =
                        distance === undefined
                            ? 0
                            : detailOpacity(distance, settings.radius);
                tile.alpha = THREE.MathUtils.lerp(
                    tile.alpha,
                    target,
                    1 - Math.exp(-delta * 6)
                );
                tile.group.visible = tile.alpha > 0.005;
                if (distance !== undefined) tile.last = clock;
                for (const material of tile.materials) {
                    const kind = material.userData.kind;
                    if (
                        !['paint', 'wear', 'number0', 'number1'].includes(kind)
                    ) {
                        const map =
                            kind === 'grass'
                                ? grass
                                : settings.fine
                                  ? grain
                                  : coarse;
                        const bump = settings.fine ? map : null;
                        if (material.map !== map || material.bumpMap !== bump) {
                            material.map = map;
                            material.bumpMap = bump;
                            material.bumpScale =
                                kind === 'grass' ? 0.006 : 0.008;
                            material.needsUpdate = true;
                        }
                    }
                    material.opacity = tile.alpha * material.userData.maximum;
                    if (kind === 'wear' && !settings.fine) material.opacity = 0;
                }
            }
            lastQuality = quality;
            const unused = [...cache]
                .filter(([key, t]) => !distances.has(key) && t.alpha < 0.005)
                .sort((a, b) => a[1].last - b[1].last);
            for (const [key, tile] of unused)
                if (cache.size > CACHE_LIMIT || clock - tile.last > 15) {
                    disposeTile(tile);
                    cache.delete(key);
                }
        },
        stats() {
            return {
                groundDetailTiles: cache.size,
                groundDetailVisible: [...cache.values()].filter(
                    (t) => t.group.visible
                ).length,
                groundDetailGeometries: [...cache.values()].reduce(
                    (n, t) => n + t.group.children.length,
                    0
                )
            };
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const tile of cache.values()) disposeTile(tile);
            cache.clear();
            textures.forEach((t) => t.dispose());
            index.clear();
        }
    };
}
