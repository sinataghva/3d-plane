/** @type {Record<string, {pixelRatio: number, shadows: boolean, shadowSize: number}>} */
const PRESETS = {
    low: { pixelRatio: 1, shadows: false, shadowSize: 512 },
    balanced: { pixelRatio: 1.5, shadows: true, shadowSize: 1024 },
    high: { pixelRatio: 2, shadows: true, shadowSize: 2048 }
};

/** @param {string} quality @param {number} devicePixelRatio */
export function getRenderQuality(quality, devicePixelRatio) {
    const preset = PRESETS[quality] ?? PRESETS.high;
    return {
        ...preset,
        pixelRatio: Math.min(
            Math.max(devicePixelRatio || 1, 1),
            preset.pixelRatio
        )
    };
}
