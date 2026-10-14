import * as THREE from 'three';
import {
    createDetailIndex,
    CLOSE_DETAIL_WIDTH,
    paintFeature,
    hasDetailMap
} from '../map/detailMap.js';
import { createReliefCanvas } from '../map/cartography.js';
import { TEHRAN_SOIL } from '../map/tehranGroundStyle.js';
import { createGroundAtlas } from './groundAtlas.js';

// Same pixel allocation as the old nine-slot atlas; pixels now form a rolling
// window with no internal tile seams. World-aligned sampling never swims.
export const CLOSE_GROUND_SIZE = 1548;
export const CLOSE_GROUND_RESOLUTION = CLOSE_DETAIL_WIDTH * 2;
const STEP = 16;
const CHUNK = 512;
/** @typedef {{x:number,z:number,w:number,h:number}} Rect */
/** @param {number} value @param {number} size */
const mod = (value, size) => ((value % size) + size) % size;
/** Split at physical texture wraps as well as the bounded staging size.
 * @param {Rect} rect @param {number} [size] */
export function groundUploadChunks(rect, size = CLOSE_GROUND_SIZE) {
    const result = [];
    for (let z = rect.z; z < rect.z + rect.h; ) {
        const h = Math.min(CHUNK, rect.z + rect.h - z, size - mod(z, size));
        for (let x = rect.x; x < rect.x + rect.w; ) {
            const w = Math.min(CHUNK, rect.x + rect.w - x, size - mod(x, size));
            result.push({ x, z, w, h });
            x += w;
        }
        z += h;
    }
    return result;
}
/** @param {number} altitude @param {string} quality */
export function closeGroundStrength(altitude, quality) {
    return quality === 'low'
        ? 0
        : 1 - THREE.MathUtils.smoothstep(altitude, 250, 500);
}
/** @param {import('./geography.js').Geography} world
 * @param {THREE.MeshLambertMaterial} material @param {HTMLCanvasElement} [baseRelief]
 * @param {THREE.WebGLRenderer} [renderer] */
export function createCloseGroundTexture(
    world,
    material,
    baseRelief,
    renderer
) {
    const enabled = hasDetailMap(world);
    // Reuse the previous coarser index resolution, not a 4x larger fine index.
    const index = enabled ? createDetailIndex(world, CLOSE_DETAIL_WIDTH) : null;
    const order = new WeakMap();
    /** @type {WeakMap<import('./geography.js').GeoFeature,number[]>} */
    const featureBounds = new WeakMap();
    const texel = world.width / CLOSE_GROUND_RESOLUTION;
    const size = CLOSE_GROUND_SIZE;
    const uniforms = {
        closeGroundAtlas: { value: /** @type {THREE.Texture|null} */ (null) },
        closeGroundFlight: { value: new THREE.Vector4(0, 0, 0, 1180) },
        closeGroundBounds: { value: new THREE.Vector4() },
        closeGroundGrid: {
            value: new THREE.Vector3(world.minX, world.minZ, texel * size)
        },
        closeGroundFade: { value: 0 }
    };
    const metrics = {
        groundTextureReady: false,
        groundTextureTiles: 0,
        groundTexturePending: 0,
        groundTextureGenerated: 0,
        groundTextureMaxWorkMs: 0,
        groundTextureBytes: 0,
        groundTextureStrength: 0,
        groundTextureWorkMs: 0,
        groundTextureUploads: 0,
        groundTextureUploadBytes: 0,
        groundTextureCoverage: 0,
        groundTextureResolution: enabled ? CLOSE_GROUND_RESOLUTION : 0
    };
    let cursor = 0,
        disposed = false,
        lastWasDirty = false;
    /** @type {ReturnType<typeof createGroundAtlas>|null} */ let atlas = null;
    /** @type {HTMLCanvasElement|null} */ let staging = null;
    /** @type {HTMLCanvasElement|null} */ let relief = null;
    /** @type {CanvasRenderingContext2D|null} */ let ctx = null;
    /** @type {Rect|null} */ let resident = null;
    /** @type {Rect|null} */ let target = null;
    /** @type {Rect|null} */ let valid = null;
    /** @type {Rect|null} */ let dirty = null;
    /** @type {Rect[]} */ let queue = [];
    /** @type {{rect:Rect,layers:import('./geography.js').GeoFeature[][],layer:number,item:number}|null} */ let pending =
        null;

    if (enabled) {
        const previous = material.onBeforeCompile;
        const key = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, render) => {
            previous.call(material, shader, render);
            Object.assign(shader.uniforms, uniforms);
            shader.fragmentShader =
                `uniform sampler2D closeGroundAtlas;
                uniform vec4 closeGroundFlight, closeGroundBounds;
                uniform vec3 closeGroundGrid; uniform float closeGroundFade;\n` +
                shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '// fine-ground-end',
                `
                float closeBlend = closeGroundFlight.z * (1.0 - smoothstep(
                    closeGroundFlight.w == 800.0 ? 400.0 : 600.0, closeGroundFlight.w,
                    distance(vFineGroundXZ, closeGroundFlight.xy)));
                vec2 closeEdge = min(vFineGroundXZ - closeGroundBounds.xy,
                    closeGroundBounds.zw - vFineGroundXZ);
                closeBlend *= closeGroundFade * smoothstep(0.0, 16.0, min(closeEdge.x, closeEdge.y));
                if (closeBlend > 0.001) {
                    vec2 uv = (vFineGroundXZ - closeGroundGrid.xy) / closeGroundGrid.z;
                    uv.y = 1.0 - uv.y;
                    diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(closeGroundAtlas, uv).rgb, closeBlend);
                }
                // close-ground-end`
            );
        };
        material.customProgramCacheKey = () => key + '-rolling-close-v1';
        material.needsUpdate = true;
    }
    function allocate() {
        if (atlas) return;
        staging = document.createElement('canvas');
        staging.width = staging.height = CHUNK + 4;
        ctx = staging.getContext('2d');
        atlas = createGroundAtlas(size, staging, renderer);
        atlas.texture.wrapS = atlas.texture.wrapT = THREE.RepeatWrapping;
        uniforms.closeGroundAtlas.value = atlas.texture;
        relief = baseRelief || createReliefCanvas(world);
        metrics.groundTextureBytes =
            (size ** 2 * 2 + (CHUNK + 4) ** 2) * 4 +
            relief.width * relief.height * 4;
    }
    function reset() {
        queue = [];
        pending = null;
        resident = target = valid = dirty = null;
        atlas?.dispose();
        atlas = null;
        if (staging) staging.width = staging.height = 0;
        if (relief && !baseRelief) relief.width = relief.height = 0;
        staging = relief = null;
        ctx = null;
        uniforms.closeGroundAtlas.value = null;
        uniforms.closeGroundFlight.value.z = uniforms.closeGroundFade.value = 0;
        uniforms.closeGroundBounds.value.set(0, 0, 0, 0);
        metrics.groundTextureCoverage = 0;
        metrics.groundTextureTiles =
            metrics.groundTexturePending =
            metrics.groundTextureBytes =
            metrics.groundTextureStrength =
                0;
    }
    /** @param {Rect} rect */
    function worldBounds(rect) {
        return [
            world.minX + rect.x * texel,
            world.minZ + rect.z * texel,
            world.minX + (rect.x + rect.w) * texel,
            world.minZ + (rect.z + rect.h) * texel
        ];
    }
    function refreshBounds() {
        uniforms.closeGroundBounds.value.fromArray(
            valid ? worldBounds(valid) : [0, 0, 0, 0]
        );
    }
    /** @param {Rect} next */
    function schedule(next) {
        target = next;
        if (
            !resident ||
            Math.abs(next.x - resident.x) >= size ||
            Math.abs(next.z - resident.z) >= size
        ) {
            valid = null;
            uniforms.closeGroundFade.value = 0;
            queue = groundUploadChunks(next);
        } else {
            const x = Math.max(next.x, resident.x),
                z = Math.max(next.z, resident.z);
            const right = Math.min(next.x + size, resident.x + size);
            const bottom = Math.min(next.z + size, resident.z + size);
            valid = { x, z, w: right - x, h: bottom - z };
            // Disjoint entering strips. Exclude overwritten trailing texels from
            // sampling until every piece is ready, including diagonal movement.
            queue = [];
            if (next.x < x)
                queue.push(
                    ...groundUploadChunks({
                        x: next.x,
                        z: next.z,
                        w: x - next.x,
                        h: size
                    })
                );
            if (right < next.x + size)
                queue.push(
                    ...groundUploadChunks({
                        x: right,
                        z: next.z,
                        w: next.x + size - right,
                        h: size
                    })
                );
            if (next.z < z)
                queue.push(
                    ...groundUploadChunks({
                        x,
                        z: next.z,
                        w: right - x,
                        h: z - next.z
                    })
                );
            if (bottom < next.z + size)
                queue.push(
                    ...groundUploadChunks({
                        x,
                        z: bottom,
                        w: right - x,
                        h: next.z + size - bottom
                    })
                );
        }
        refreshBounds();
    }
    /** @param {Rect} rect */
    function layersFor(rect) {
        if (!index) return [];
        const bounds = worldBounds(rect);
        // Include the painter's filter gutter; preserve global source order when
        // a strip crosses an index cell, so overlapping polygons stay identical.
        const ids = index.tiles([
            bounds[0] - texel * 2,
            bounds[1] - texel * 2,
            bounds[2] + texel * 2,
            bounds[3] + texel * 2
        ]);
        if (!ids.length) return [];
        const touches = (
            /** @type {import('./geography.js').GeoFeature} */ feature
        ) => {
            let box = featureBounds.get(feature);
            if (!box) {
                box = [Infinity, Infinity, -Infinity, -Infinity];
                for (const [x, z] of feature.points) {
                    box[0] = Math.min(box[0], x);
                    box[1] = Math.min(box[1], z);
                    box[2] = Math.max(box[2], x);
                    box[3] = Math.max(box[3], z);
                }
                const margin = Math.max(30, feature.width || 0) + texel * 2;
                box[0] -= margin;
                box[1] -= margin;
                box[2] += margin;
                box[3] += margin;
                featureBounds.set(feature, box);
            }
            return (
                box[0] <= bounds[2] &&
                box[2] >= bounds[0] &&
                box[1] <= bounds[3] &&
                box[3] >= bounds[1]
            );
        };
        if (ids.length === 1)
            return index.buckets[ids[0]].map((layer) => layer.filter(touches));
        return index.buckets[ids[0]].map((_, layer) =>
            [
                ...new Set(
                    ids.flatMap((id) =>
                        index.buckets[id][layer].filter(touches)
                    )
                )
            ].sort((a, b) => order.get(a) - order.get(b))
        );
    }
    return {
        reset,
        stats: () => ({ ...metrics }),
        /** @param {number[][]} [bounds] */
        invalidate(bounds) {
            const area = target || resident;
            if (!area) return;
            for (const b of bounds || [worldBounds(area)]) {
                const x = Math.max(
                    area.x,
                    Math.floor((b[0] - world.minX) / texel) - 2
                );
                const z = Math.max(
                    area.z,
                    Math.floor((b[1] - world.minZ) / texel) - 2
                );
                const right = Math.min(
                    area.x + size,
                    Math.ceil((b[2] - world.minX) / texel) + 2
                );
                const bottom = Math.min(
                    area.z + size,
                    Math.ceil((b[3] - world.minZ) / texel) + 2
                );
                if (right <= x || bottom <= z) continue;
                const x0 = Math.min(x, dirty?.x ?? x),
                    z0 = Math.min(z, dirty?.z ?? z);
                dirty = {
                    x: x0,
                    z: z0,
                    w: Math.max(right, dirty ? dirty.x + dirty.w : right) - x0,
                    h: Math.max(bottom, dirty ? dirty.z + dirty.h : bottom) - z0
                };
            }
        },
        dispose() {
            reset();
            disposed = true;
            if (index) {
                index.buckets.length = 0;
                index.streets.length = 0;
            }
        },
        /** @param {{x:number,y:number,z:number}} position @param {string} quality
         * @param {number} delta @param {{deadline:number,uploaded:boolean}} budget */
        update(position, quality, delta, budget) {
            metrics.groundTextureWorkMs = 0;
            if (!index || disposed) return;
            if (quality === 'low') {
                reset();
                return;
            }
            const dt = THREE.MathUtils.clamp(delta, 0, 0.1);
            const strength = closeGroundStrength(
                position.y - world.height(position.x, position.z),
                quality
            );
            const flight = uniforms.closeGroundFlight.value;
            flight.set(
                position.x,
                position.z,
                THREE.MathUtils.damp(flight.z, strength, 5, dt),
                quality === 'balanced' ? 800 : 1180
            );
            metrics.groundTextureStrength = flight.z;
            if (!strength) {
                metrics.groundTexturePending = 0;
                return;
            }
            const next = {
                x:
                    Math.floor(
                        ((position.x - world.minX) / texel - size / 2) / STEP
                    ) * STEP,
                z:
                    Math.floor(
                        ((position.z - world.minZ) / texel - size / 2) / STEP
                    ) * STEP,
                w: size,
                h: size
            };
            if (
                target &&
                (Math.abs(next.x - target.x) >= size / 2 ||
                    Math.abs(next.z - target.z) >= size / 2)
            ) {
                pending = null;
                queue = [];
                resident = null;
                target = null;
                dirty = null;
            }
            if (!pending && !queue.length) {
                if (target) {
                    resident = target;
                    valid = target;
                    target = null;
                    refreshBounds();
                }
                const moving =
                    !resident || resident.x !== next.x || resident.z !== next.z;
                if (!resident || (moving && (!dirty || lastWasDirty))) {
                    schedule(next);
                    lastWasDirty = false;
                } else if (dirty) {
                    lastWasDirty = true;
                    // Restrict stale work to the resident window after travel.
                    const x = Math.max(dirty.x, resident.x),
                        z = Math.max(dirty.z, resident.z);
                    const w =
                        Math.min(dirty.x + dirty.w, resident.x + size) - x;
                    const h =
                        Math.min(dirty.z + dirty.h, resident.z + size) - z;
                    if (w > 0 && h > 0)
                        queue = groundUploadChunks({ x, z, w, h });
                    dirty = null;
                }
            }
            uniforms.closeGroundFade.value = valid
                ? Math.min(1, uniforms.closeGroundFade.value + dt * 2)
                : 0;
            metrics.groundTextureTiles = valid ? 1 : 0;
            metrics.groundTextureCoverage = valid
                ? Math.max(
                      0,
                      Math.min(
                          position.x - world.minX - valid.x * texel,
                          world.minX + (valid.x + valid.w) * texel - position.x,
                          position.z - world.minZ - valid.z * texel,
                          world.minZ + (valid.z + valid.h) * texel - position.z
                      )
                  )
                : 0;
            metrics.groundTexturePending =
                queue.length + (pending ? 1 : 0) + (dirty ? 1 : 0);
            const start = performance.now();
            if (budget.uploaded || start >= budget.deadline) return;
            while (
                cursor < world.data.features.length &&
                performance.now() < budget.deadline
            ) {
                const feature = world.data.features[cursor];
                if (feature.kind !== 'building') {
                    order.set(feature, cursor);
                    index.add(feature);
                }
                cursor++;
            }
            metrics.groundTextureReady = cursor === world.data.features.length;
            if (metrics.groundTextureReady && (queue.length || pending)) {
                allocate();
                while (
                    performance.now() < budget.deadline &&
                    ctx &&
                    staging &&
                    relief &&
                    atlas
                ) {
                    if (!pending) {
                        const rect = queue.shift();
                        if (!rect) break;
                        // Symmetric gutters keep canvas flipY/cropped upload
                        // coordinates identical for narrow wrapped strips.
                        if (staging.width !== rect.w + 4)
                            staging.width = rect.w + 4;
                        if (staging.height !== rect.h + 4)
                            staging.height = rect.h + 4;
                        ctx.fillStyle = TEHRAN_SOIL;
                        ctx.fillRect(0, 0, CHUNK + 4, CHUNK + 4);
                        pending = {
                            rect,
                            layers: layersFor(rect),
                            layer: 0,
                            item: 0
                        };
                    }
                    const { rect, layers } = pending;
                    const minX = world.minX + rect.x * texel,
                        minZ = world.minZ + rect.z * texel;
                    const feature = layers[pending.layer]?.[pending.item++];
                    if (feature)
                        paintFeature(ctx, feature, 1 / texel, minX, minZ, true);
                    else {
                        pending.layer++;
                        pending.item = 0;
                    }
                    if (pending.layer >= layers.length) {
                        ctx.drawImage(
                            relief,
                            (world.minX - minX) / texel + 2,
                            (world.minZ - minZ) / texel + 2,
                            world.width / texel,
                            world.depth / texel
                        );
                        metrics.groundTextureUploadBytes += atlas.upload(
                            mod(rect.x, size),
                            mod(rect.z, size),
                            rect.w,
                            rect.h,
                            2
                        );
                        metrics.groundTextureUploads++;
                        metrics.groundTextureGenerated++;
                        budget.uploaded = true;
                        pending = null;
                        break;
                    }
                }
            }
            metrics.groundTexturePending =
                queue.length +
                (pending ? 1 : 0) +
                (dirty ? 1 : 0) +
                (target && !queue.length && !pending ? 1 : 0);
            metrics.groundTextureWorkMs = performance.now() - start;
            metrics.groundTextureMaxWorkMs = Math.max(
                metrics.groundTextureMaxWorkMs,
                metrics.groundTextureWorkMs
            );
        }
    };
}
