/** Tehran's dense city uses bounded building detail; other regions are unchanged. */
export const TEHRAN_BUILDING_RANGES = Object.freeze({
    low: 3000,
    balanced: 6000,
    high: 10000
});

/** @param {import('three').MeshLambertMaterial} material */
export function addRegionDistanceFade(material) {
    const range = { value: TEHRAN_BUILDING_RANGES.high };
    material.userData.regionDetailRange = range;
    const previous = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.regionDetailRange = range;
        shader.vertexShader =
            'varying float vRegionDistance;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\nvRegionDistance = length(mvPosition.xyz);'
        );
        shader.fragmentShader =
            'uniform float regionDetailRange; varying float vRegionDistance;\n' +
            shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <alphatest_fragment>',
            `#include <alphatest_fragment>
            float coverage = 1.0 - smoothstep(regionDetailRange * 0.75, regionDetailRange, vRegionDistance);
            float stipple = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
            if (coverage <= stipple) discard;`
        );
    };
    material.customProgramCacheKey = () => key + '-region-distance-v1';
}

/** @param {import('three').Group} terrain
 * @param {import('three').Vector3} position @param {string} quality */
export function updateRegionDetail(terrain, position, quality) {
    const range =
        TEHRAN_BUILDING_RANGES[
            /** @type {keyof typeof TEHRAN_BUILDING_RANGES} */ (quality)
        ] || TEHRAN_BUILDING_RANGES.high;
    for (const child of terrain.children) {
        if (child.name !== 'Buildings · spatial batch') continue;
        const mesh =
            /** @type {import('three').Mesh<import('three').BufferGeometry, import('three').MeshLambertMaterial>} */ (
                child
            );
        const uniform = mesh.material.userData.regionDetailRange;
        if (!uniform) continue;
        uniform.value = range;
        const sphere = mesh.geometry.boundingSphere;
        if (!sphere) continue;
        const distance = sphere.center.distanceTo(position) - sphere.radius;
        mesh.visible = distance < range;
        mesh.castShadow = quality !== 'low' && distance < 1500;
    }
}
