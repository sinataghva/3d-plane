/** Roof distances reuse otherwise unused night-window attributes. No new vertices. */
const ROOF_MARKER = 2000;
const INTERNAL_EDGE = 10000;
export const CLOSE_BUILDING_RANGES = {
    low: [0, 0],
    balanced: [400, 800],
    high: [600, 1200]
};

/** @param {number[][][]} rings */
export function roofBoundaryEdges(rings) {
    const edges = new Set();
    let offset = 0;
    for (const ring of rings) {
        for (let i = 0; i < ring.length; i++) {
            const a = offset + i,
                b = offset + ((i + 1) % ring.length);
            edges.add(`${Math.min(a, b)},${Math.max(a, b)}`);
        }
        offset += ring.length;
    }
    return edges;
}

/** Distances to the three opposite edges, masking internal triangulation edges.
 * Returned in reversed triangle order, matching terrain's roof winding.
 * @param {number[][]} points @param {number[]} triangle @param {Set<string>} edges */
export function roofBoundaryData(points, triangle, edges) {
    const heights = triangle.map((vertex, i) => {
        const a = triangle[(i + 1) % 3],
            b = triangle[(i + 2) % 3];
        if (!edges.has(`${Math.min(a, b)},${Math.max(a, b)}`))
            return INTERNAL_EDGE;
        const p = points[vertex],
            q = points[a],
            r = points[b];
        return (
            Math.abs(
                (r[0] - q[0]) * (p[1] - q[1]) - (r[1] - q[1]) * (p[0] - q[0])
            ) / Math.max(0.001, Math.hypot(r[0] - q[0], r[1] - q[1]))
        );
    });
    return [2, 1, 0].flatMap((vertex) =>
        heights.map((height, edge) => {
            const distance =
                height === INTERNAL_EDGE
                    ? INTERNAL_EDGE
                    : vertex === edge
                      ? height
                      : 0;
            return edge === 2 ? -ROOF_MARKER - distance : distance;
        })
    );
}

/** Negative seeds give unlit facades stable decoration without adding night lights.
 * @param {string} id */
export function unlitFacadeSeed(id) {
    let hash = 2166136261;
    for (const c of id)
        hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
    return -1 - (hash % 997);
}

/** Uses the existing building-window varying and region camera distance.
 * @param {import('three').MeshLambertMaterial} material */
export function addCloseBuildingDetail(material) {
    const range = { value: [600, 1200] };
    material.userData.closeBuildingRange = range;
    const previous = material.onBeforeCompile;
    const key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
        previous.call(material, shader, renderer);
        shader.uniforms.closeBuildingRange = range;
        // Prototype selector: 1 = roof edges, 2 = edges plus decorative facades.
        const variant = 2;
        shader.fragmentShader =
            'uniform vec2 closeBuildingRange;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            float closeBuildingFade = closeBuildingRange.y > 0.0
                ? 1.0 - smoothstep(closeBuildingRange.x, closeBuildingRange.y, vRegionDistance) : 0.0;
            if (closeBuildingFade > 0.001) {
                if (vBuildingWindow.z < -1999.0) {
                    vec3 edges = vec3(vBuildingWindow.xy, -vBuildingWindow.z - 2000.0);
                    float edgeDistance = min(edges.x, min(edges.y, edges.z));
                    float aa = max(fwidth(edgeDistance), 0.05);
                    float boundary = 1.0 - smoothstep(0.25 - aa, 0.25 + aa, edgeDistance);
                    diffuseColor.rgb *= 1.0 - 0.30 * boundary * closeBuildingFade;
                } else if (${variant}.0 > 1.5 && abs(vBuildingWindow.z) > 0.5) {
                    float seed = abs(vBuildingWindow.z);
                    float tint = mix(0.94, 1.06, fract(seed * 0.137));
                    vec2 grid = vBuildingWindow.xy / vec2(3.8, 3.2);
                    vec2 room = fract(grid);
                    vec2 aa = max(fwidth(grid), vec2(0.002));
                    vec2 pane = smoothstep(vec2(0.30,0.36)-aa, vec2(0.30,0.36)+aa, room)
                        * (1.0-smoothstep(vec2(0.70,0.80)-aa, vec2(0.70,0.80)+aa, room));
                    float readable = 1.0 - smoothstep(0.15, 0.5, max(aa.x, aa.y));
                    vec3 facade = diffuseColor.rgb * tint;
                    facade = mix(facade, facade * vec3(0.58, 0.66, 0.71), pane.x * pane.y * readable);
                    diffuseColor.rgb = mix(diffuseColor.rgb, facade, closeBuildingFade);
                }
            }
        `
        );
    };
    material.customProgramCacheKey = () => key + '-close-buildings-v1';
}
