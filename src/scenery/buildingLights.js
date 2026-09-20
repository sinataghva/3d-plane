/** Stable decorative occupancy; unknown OSM building types can be houses.
 * @param {string} id @param {string} [type] */
export function buildingLightSeed(id, type = '') {
    if (
        [
            'hangar',
            'shed',
            'garage',
            'garages',
            'industrial',
            'warehouse',
            'farm_auxiliary',
            'church',
            'roof'
        ].includes(type)
    )
        return 0;
    let hash = 2166136261;
    for (const c of id)
        hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    return hash % 100 < 32 ? 1 + (hash % 997) : 0;
}

/** Windows are emissive patches on existing walls: no meshes or point lights.
 * @param {import('three').MeshLambertMaterial} material */
export function addBuildingWindowShader(material) {
    const intensity = { value: 0 };
    material.userData.townNightIntensity = intensity;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.townNightIntensity = intensity;
        shader.vertexShader =
            'attribute vec3 buildingWindow; varying vec3 vBuildingWindow;\n' +
            shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\n vBuildingWindow = buildingWindow;'
        );
        shader.fragmentShader =
            'uniform float townNightIntensity; varying vec3 vBuildingWindow;\n' +
            shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            if (townNightIntensity > 0.0 && vBuildingWindow.z > 0.5) {
                float seed = floor(vBuildingWindow.z + 0.5);
                vec2 grid = vBuildingWindow.xy / vec2(3.8, 3.2);
                vec2 cell = floor(grid);
                vec2 room = fract(grid);
                float occupied = fract(sin(dot(cell, vec2(12.9898,78.233)) + seed) * 43758.5453);
                vec2 aa = max(fwidth(grid), vec2(0.002));
                vec2 mask = smoothstep(vec2(0.30,0.36)-aa, vec2(0.30,0.36)+aa, room)
                    * (1.0-smoothstep(vec2(0.70,0.80)-aa, vec2(0.70,0.80)+aa, room));
                float distanceFade = 1.0-smoothstep(0.25,0.75,max(aa.x,aa.y));
                vec3 warmth = mix(vec3(1.0,0.42,0.12),vec3(1.0,0.74,0.36),fract(seed*0.137));
                totalEmissiveRadiance += warmth * mask.x * mask.y * step(0.35,occupied)
                    * distanceFade * townNightIntensity;
            }`
        );
    };
    material.customProgramCacheKey = () => 'civilian-window-lights-v1';
}
