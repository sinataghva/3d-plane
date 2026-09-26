import * as THREE from 'three';
import {
    createDetailIndex,
    FINE_DETAIL_WIDTH,
    TILE_SIZE,
    hasDetailMap,
    paintFeature
} from '../map/detailMap.js';
import { createReliefCanvas } from '../map/cartography.js';

// Fixed nine-slot atlas, plus one reusable staging canvas. No extra mesh or DEM.
export const GROUND_TEXTURE_SLOTS = 9;
const PADDED = TILE_SIZE + 4;
const ATLAS_SIZE = PADDED * 3;
export const GROUND_TEXTURE_BYTES = (ATLAS_SIZE ** 2 * 2 + PADDED ** 2) * 4;

/** @param {number} altitude @param {string} quality */
export function groundTextureStrength(altitude, quality) {
    return quality === 'low'
        ? 0
        : 1 - THREE.MathUtils.smoothstep(altitude, 550, 950);
}

/** Tehran-only texture refinement on the existing terrain shader. The map's
 * geographic grid and surface painter are reused, but labels never enter it.
 * @param {import('./geography.js').Geography} world
 * @param {THREE.MeshLambertMaterial} material
 * @param {HTMLCanvasElement} [baseRelief] */
export function createGroundTextureDetail(world, material, baseRelief) {
    const enabled = hasDetailMap(world);
    const index = enabled ? createDetailIndex(world, FINE_DETAIL_WIDTH) : null;
    const uniforms = {
        fineGroundAtlas: {
            value: /** @type {THREE.CanvasTexture|null} */ (null)
        },
        fineGroundTiles: {
            value: Array.from(
                { length: 9 },
                () => new THREE.Vector4(0, 0, 0, 0)
            )
        },
        fineGroundFlight: { value: new THREE.Vector4(0, 0, 0, 3000) }
    };
    const metrics = {
        groundTextureReady: false,
        groundTextureTiles: 0,
        groundTexturePending: 0,
        groundTextureGenerated: 0,
        groundTextureMaxWorkMs: 0,
        groundTextureBytes: 0,
        groundTextureStrength: 0,
        groundTextureResolution: enabled ? FINE_DETAIL_WIDTH : 0
    };
    /** @type {HTMLCanvasElement|null} */ let atlas = null;
    /** @type {HTMLCanvasElement|null} */ let staging = null;
    /** @type {HTMLCanvasElement|null} */ let relief = null;
    /** @type {CanvasRenderingContext2D|null} */ let atlasCtx = null;
    /** @type {CanvasRenderingContext2D|null} */ let ctx = null;
    const slots = Array.from({ length: 9 }, () => ({ id: -1, fade: 0 }));
    let cursor = 0,
        disposed = false;
    /** @type {{id:number,layer:number,item:number}|null} */ let pending = null;

    if (enabled) {
        const previous = material.onBeforeCompile;
        const key = material.customProgramCacheKey();
        material.onBeforeCompile = (shader, renderer) => {
            previous.call(material, shader, renderer);
            Object.assign(shader.uniforms, uniforms);
            shader.vertexShader =
                'varying vec2 vFineGroundXZ;\n' + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nvFineGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;'
            );
            shader.fragmentShader =
                `uniform sampler2D fineGroundAtlas;
                uniform vec4 fineGroundTiles[9]; uniform vec4 fineGroundFlight;
                varying vec2 vFineGroundXZ;\n` + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>
                float groundBlend = fineGroundFlight.z * (1.0 - smoothstep(
                    fineGroundFlight.w * 0.5, fineGroundFlight.w,
                    distance(vFineGroundXZ, fineGroundFlight.xy)));
                if (groundBlend > 0.001) {
                    for (int i = 0; i < 9; i++) {
                        vec4 tile = fineGroundTiles[i];
                        vec2 local = (vFineGroundXZ - tile.xy) / max(tile.z, 1.0);
                        if (tile.w > 0.0 && local.x >= 0.0 && local.y >= 0.0 && local.x < 1.0 && local.y < 1.0) {
                            vec2 slot = vec2(mod(float(i), 3.0), floor(float(i) / 3.0));
                            vec2 uv = (slot * ${PADDED}.0 + vec2(2.0) + local * ${TILE_SIZE}.0) / ${ATLAS_SIZE}.0;
                            uv.y = 1.0 - uv.y;
                            // Fade a small edge band to the common base texture even
                            // when the neighboring tile has not finished generating.
                            vec2 edge = min(local, 1.0 - local) * tile.z;
                            float seam = smoothstep(0.0, 55.0, min(edge.x, edge.y));
                            diffuseColor.rgb = mix(diffuseColor.rgb,
                                texture2D(fineGroundAtlas, uv).rgb, groundBlend * tile.w * seam);
                        }
                    }
                }`
            );
        };
        material.customProgramCacheKey = () => key + '-ground-atlas-v1';
        material.needsUpdate = true;
    }

    function allocate() {
        if (atlas) return;
        atlas = document.createElement('canvas');
        atlas.width = atlas.height = ATLAS_SIZE;
        atlasCtx = atlas.getContext('2d');
        staging = document.createElement('canvas');
        staging.width = staging.height = PADDED;
        ctx = staging.getContext('2d');
        relief = baseRelief || createReliefCanvas(world);
        const texture = new THREE.CanvasTexture(atlas);
        texture.colorSpace = THREE.SRGBColorSpace;
        // Gutters support linear filtering; no atlas mipmaps can bleed neighbors.
        texture.generateMipmaps = false;
        texture.minFilter = THREE.LinearFilter;
        texture.anisotropy = 4;
        uniforms.fineGroundAtlas.value = texture;
        metrics.groundTextureBytes =
            GROUND_TEXTURE_BYTES + relief.width * relief.height * 4;
    }
    function reset() {
        pending = null;
        for (let i = 0; i < 9; i++) {
            slots[i].id = -1;
            slots[i].fade = 0;
            uniforms.fineGroundTiles.value[i].set(0, 0, 0, 0);
        }
        uniforms.fineGroundFlight.value.z = 0;
        uniforms.fineGroundAtlas.value?.dispose();
        uniforms.fineGroundAtlas.value = null;
        for (const canvas of [atlas, staging, baseRelief ? null : relief])
            if (canvas) canvas.width = canvas.height = 0;
        atlas = staging = relief = null;
        ctx = atlasCtx = null;
        metrics.groundTextureTiles =
            metrics.groundTexturePending =
            metrics.groundTextureBytes =
            metrics.groundTextureStrength =
                0;
    }
    return {
        reset,
        dispose() {
            reset();
            if (baseRelief) baseRelief.width = baseRelief.height = 0;
            disposed = true;
            if (index) {
                index.buckets.length = 0;
                index.streets.length = 0;
            }
        },
        stats: () => ({ ...metrics }),
        /** @param {{x:number,y:number,z:number}} position @param {string} quality @param {number} delta */
        update(position, quality, delta) {
            if (!index || disposed) return;
            const strength = groundTextureStrength(
                position.y - world.height(position.x, position.z),
                quality
            );
            if (quality === 'low') {
                if (atlas) reset();
                return;
            }
            const flight = uniforms.fineGroundFlight.value;
            flight.set(
                position.x,
                position.z,
                THREE.MathUtils.damp(
                    flight.z,
                    strength,
                    5,
                    THREE.MathUtils.clamp(delta, 0, 0.1)
                ),
                quality === 'balanced' ? 2400 : 3000
            );
            metrics.groundTextureStrength = flight.z;
            if (strength === 0) {
                pending = null;
                metrics.groundTexturePending = 0;
                return;
            }
            const col = Math.floor((position.x - world.minX) / index.span);
            const row = Math.floor((position.z - world.minZ) / index.span);
            // Full neighbor ring prefetches in every direction, including turns.
            const ids = index.tiles([
                world.minX + (col - 1) * index.span + 1,
                world.minZ + (row - 1) * index.span + 1,
                world.minX + (col + 2) * index.span - 1,
                world.minZ + (row + 2) * index.span - 1
            ]);
            ids.sort((a, b) => distance(a) - distance(b));
            function distance(/** @type {number} */ id) {
                if (!index) return Infinity;
                return Math.hypot(
                    world.minX +
                        ((id % index.columns) + 0.5) * index.span -
                        position.x,
                    world.minZ +
                        (Math.floor(id / index.columns) + 0.5) * index.span -
                        position.z
                );
            }
            if (pending && !ids.includes(pending.id)) pending = null;
            for (let i = 0; i < 9; i++) {
                const slot = slots[i];
                slot.fade = Math.min(
                    1,
                    slot.fade + THREE.MathUtils.clamp(delta, 0, 0.1) * 2
                );
                uniforms.fineGroundTiles.value[i].w =
                    slot.id < 0 ? 0 : slot.fade;
            }
            const start = performance.now();
            while (
                cursor < world.data.features.length &&
                performance.now() - start < 2
            ) {
                const feature = world.data.features[cursor++];
                if (feature.kind !== 'building') index.add(feature);
            }
            metrics.groundTextureReady = cursor === world.data.features.length;
            metrics.groundTextureMaxWorkMs = Math.max(
                metrics.groundTextureMaxWorkMs,
                performance.now() - start
            );
            if (!metrics.groundTextureReady) return;
            if (ids.length) allocate();
            if (!ctx || !atlasCtx || !staging || !relief) return;
            while (performance.now() - start < 2) {
                if (!pending) {
                    const id = ids.find(
                        (id) => !slots.some((s) => s.id === id)
                    );
                    if (id === undefined) break;
                    ctx.fillStyle = '#b6a482';
                    ctx.fillRect(0, 0, PADDED, PADDED);
                    pending = { id, layer: 0, item: 0 };
                }
                const { id } = pending;
                const minX = world.minX + (id % index.columns) * index.span;
                const minZ =
                    world.minZ + Math.floor(id / index.columns) * index.span;
                const layers = index.buckets[id];
                const feature = layers[pending.layer]?.[pending.item++];
                if (feature)
                    paintFeature(
                        ctx,
                        feature,
                        FINE_DETAIL_WIDTH / world.width,
                        minX,
                        minZ,
                        true
                    );
                else {
                    pending.layer++;
                    pending.item = 0;
                }
                if (pending.layer === layers.length) {
                    const scale = FINE_DETAIL_WIDTH / world.width;
                    ctx.drawImage(
                        relief,
                        (world.minX - minX) * scale + 2,
                        (world.minZ - minZ) * scale + 2,
                        world.width * scale,
                        world.depth * scale
                    );
                    const slotId = slots.findIndex(
                        (s) => s.id < 0 || !ids.includes(s.id)
                    );
                    if (slotId < 0) break;
                    slots[slotId] = { id, fade: 0 };
                    uniforms.fineGroundTiles.value[slotId].set(
                        minX,
                        minZ,
                        index.span,
                        0
                    );
                    atlasCtx.drawImage(
                        staging,
                        (slotId % 3) * PADDED,
                        Math.floor(slotId / 3) * PADDED
                    );
                    if (uniforms.fineGroundAtlas.value)
                        uniforms.fineGroundAtlas.value.needsUpdate = true;
                    metrics.groundTextureGenerated++;
                    pending = null;
                    // At most one atlas upload per frame.
                    break;
                }
            }
            metrics.groundTextureTiles = slots.filter((s) => s.id >= 0).length;
            metrics.groundTexturePending = ids.filter(
                (id) => !slots.some((s) => s.id === id)
            ).length;
            metrics.groundTextureMaxWorkMs = Math.max(
                metrics.groundTextureMaxWorkMs,
                performance.now() - start
            );
        }
    };
}
