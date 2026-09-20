import * as THREE from 'three';

/** Relative decorative wave strength; source order never implies downstream flow.
 * @param {import('../scenery/geography.js').GeoFeature} feature */
export function waterCharacter(feature) {
    const type = feature.waterwayType || feature.waterType;
    const strength = ['river', 'stream'].includes(type || '') ? 1 : 0.55;
    return (
        strength *
        (feature.intermittent === 'yes' ? 0.5 : 1) *
        (feature.line && (feature.width || 2) < 3 ? 0.65 : 1)
    );
}

/** One seamless, deterministic normal texture shared by every water tile. */
function rippleTexture() {
    const size = 128;
    const data = new Uint8Array(size * size * 4);
    // Integer frequencies keep the generated field seamless at repeat boundaries.
    const waves = [
        [3, 1, 0.45],
        [1, -4, 0.24],
        [7, 3, 0.14],
        [-5, 8, 0.09]
    ];
    for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++) {
            let dx = 0,
                dz = 0,
                h = 0;
            for (const [fx, fz, amplitude] of waves) {
                const phase = (2 * Math.PI * (fx * x + fz * y)) / size;
                const length = Math.hypot(fx, fz);
                dx += (Math.cos(phase) * amplitude * fx) / length;
                dz += (Math.cos(phase) * amplitude * fz) / length;
                h += Math.sin(phase) * amplitude;
            }
            const i = (y * size + x) * 4;
            data[i] = (dx * 0.5 + 0.5) * 255;
            data[i + 1] = (dz * 0.5 + 0.5) * 255;
            data[i + 2] = (h * 0.5 + 0.5) * 255;
            data[i + 3] = 255;
        }
    const texture = new THREE.DataTexture(data, size, size);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
}

/** Owns shared uniforms/texture, independently of cache fade time. */
export function createWaterEffects() {
    const texture = rippleTexture();
    const uniforms = {
        waterTime: { value: 0 },
        waterHigh: { value: 1 },
        waterEnabled: { value: 1 },
        waterRipples: { value: texture }
    };
    let disposed = false;
    return {
        uniforms,
        /** @param {number} delta @param {string} quality */
        update(delta, quality) {
            if (disposed) return;
            uniforms.waterTime.value += Math.max(0, Math.min(delta, 0.1));
            uniforms.waterHigh.value = quality === 'high' ? 1 : 0;
            uniforms.waterEnabled.value = quality === 'low' ? 0 : 1;
        },
        reset() {
            uniforms.waterTime.value = 0;
        },
        /** @param {THREE.MeshStandardMaterial} material */
        attach(material) {
            material.roughness = 0.34;
            material.onBeforeCompile = (shader) => {
                Object.assign(shader.uniforms, uniforms);
                shader.vertexShader =
                    `attribute float waterCharacter;
                    varying vec3 vWaterWorld;
                    varying float vWaterCharacter;\n` + shader.vertexShader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                     vWaterWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                     vWaterCharacter = waterCharacter;`
                );
                shader.fragmentShader =
                    `uniform float waterTime;
                    uniform float waterHigh;
                    uniform float waterEnabled;
                    uniform sampler2D waterRipples;
                    varying vec3 vWaterWorld;
                    varying float vWaterCharacter;\n` + shader.fragmentShader;
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <normal_fragment_maps>',
                    `#include <normal_fragment_maps>
                    float waterDistance = length(vViewPosition);
                    float waterFade = (1.0 - smoothstep(80.0, mix(350.0, 700.0, waterHigh), waterDistance)) * waterEnabled;
                    vec2 waterUV = vWaterWorld.xz / 16.0;
                    // Slow east/north drift follows the cloud wind orientation.
                    vec2 waterDrift = vec2(0.025, -0.0083) * waterTime;
                    vec3 ripple = texture2D(waterRipples, waterUV - waterDrift).rgb * 2.0 - 1.0;
                    if (waterHigh > 0.5) {
                        vec2 secondUV = mat2(0.8, -0.6, 0.6, 0.8) * waterUV * 1.73;
                        vec3 second = texture2D(waterRipples, secondUV - waterDrift * 0.7).rgb * 2.0 - 1.0;
                        ripple.xy += mat2(0.8, 0.6, -0.6, 0.8) * second.xy * 0.45;
                        ripple.z = mix(ripple.z, second.z, 0.35);
                    }
                    vec2 slope = ripple.xy * mix(0.10, 0.17, waterHigh) * vWaterCharacter * waterFade;
                    normal = normalize(normal + (viewMatrix * vec4(slope.x, 0.0, slope.y, 0.0)).xyz);
                    diffuseColor.rgb *= 1.0 + ripple.z * 0.035 * waterHigh * waterFade;
                    roughnessFactor = mix(1.0, mix(0.44, 0.34, waterHigh), waterFade);`
                );
            };
            material.customProgramCacheKey = () => 'inland-water-v1';
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            texture.dispose();
        }
    };
}
