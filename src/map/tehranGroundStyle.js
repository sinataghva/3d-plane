/** Shared 3D-only palette; the navigation map retains its own colours. */
export const TEHRAN_SOIL = '#b3a58c';
const PALETTE = {
    dry: [179, 165, 140],
    grass: [119, 143, 91],
    forest: [69, 99, 64],
    field: [158, 153, 108],
    urban: [166, 160, 145],
    airfield: [151, 155, 111]
};
/** Stable per-polygon variation, identical at every texture resolution.
 * @param {import('../scenery/geography.js').GeoFeature} feature
 * @param {string} fallback */
export function tehranGroundColor(feature, fallback) {
    const rgb = PALETTE[/** @type {keyof typeof PALETTE} */ (feature.kind)];
    if (!rgb) return fallback;
    let hash = 2166136261;
    for (const c of feature.id || JSON.stringify(feature.points[0]))
        hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    const offset = ((hash >>> 0) % 9) - 4;
    return `rgb(${rgb.map((v) => v + offset).join(',')})`;
}
/** Paint a narrow mineral verge beneath the existing road stroke. No new
 * geometry/depth layers, and no invented green medians or elevated shoulders.
 * @param {CanvasRenderingContext2D} ctx
 * @param {import('../scenery/geography.js').GeoFeature} feature
 * @param {number} scale */
export function paintRoadVerge(ctx, feature, scale) {
    if (
        feature.kind !== 'road' ||
        feature.bridge === 'yes' ||
        feature.tunnel === 'yes'
    )
        return;
    const width = feature.width || 4;
    if (width < 6) return;
    ctx.save();
    ctx.strokeStyle = '#a69f88';
    ctx.lineWidth += Math.min(4, width * 0.2) * scale;
    ctx.stroke();
    ctx.restore();
}
