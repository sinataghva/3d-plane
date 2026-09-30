/** Map-only cartography for the closest level. Geometry is always source-derived.
 * @typedef {import('../scenery/geography.js').GeoFeature} Feature */

/** @param {Feature} f */
const major = (f) => /^(motorway|trunk|primary)(?:_link)?$/.test(f.class || '');
/** @param {Feature} f */
const path = (f) =>
    /^(footway|path|steps|cycleway|bridleway)$/.test(f.class || '');

/** Each road casing is painted before all road fills, keeping junctions open.
 * @param {CanvasRenderingContext2D} ctx @param {Feature} f
 * @param {number} scale @param {number} minX @param {number} minZ
 * @param {'surface'|'casing'|'symbols'} pass */
export function paintCloseFeature(ctx, f, scale, minX, minZ, pass = 'surface') {
    const x = (/** @type {number} */ value) => (value - minX) * scale + 2;
    const y = (/** @type {number} */ value) => (value - minZ) * scale + 2;
    const width = Math.max(1.2, (f.width || 4) * scale);
    if (pass === 'symbols') {
        // Respect reverse one-way tags. Omit tiny paths and short segments.
        if (
            path(f) ||
            !f.line ||
            !['yes', '-1'].includes(f.oneway || '') ||
            width < 2.5
        )
            return;
        let next = 100;
        ctx.strokeStyle = major(f) ? '#967640' : '#85857c';
        ctx.lineWidth = 0.7;
        for (let i = 1; i < f.points.length; i++) {
            const a = f.points[i - 1],
                b = f.points[i];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (!length) continue;
            while (next <= length) {
                const cx = x(a[0] + ((b[0] - a[0]) * next) / length);
                const cy = y(a[1] + ((b[1] - a[1]) * next) / length);
                const sign = f.oneway === '-1' ? -1 : 1;
                const dx = ((b[0] - a[0]) / length) * sign;
                const dy = ((b[1] - a[1]) / length) * sign;
                const size = Math.min(2.2, width * 0.45);
                ctx.beginPath();
                ctx.moveTo(
                    cx - dx * size - dy * size,
                    cy - dy * size + dx * size
                );
                ctx.lineTo(cx + dx * size, cy + dy * size);
                ctx.lineTo(
                    cx - dx * size + dy * size,
                    cy - dy * size - dx * size
                );
                ctx.stroke();
                next += 220;
            }
            next -= length;
        }
        return;
    }
    ctx.beginPath();
    for (const ring of [f.points, ...f.holes]) {
        ring.forEach(([px, py], i) =>
            i ? ctx.lineTo(x(px), y(py)) : ctx.moveTo(x(px), y(py))
        );
        if (!f.line) ctx.closePath();
    }
    if (!f.line) {
        if (pass !== 'surface') return;
        const colors = {
            building: ['#e5d9c7', '#ac9a84'],
            urban: ['#c4bdb0', '#c4bdb0'],
            water: ['#78a6b0', '#427e8d']
        };
        const pair = colors[/** @type {keyof typeof colors} */ (f.kind)];
        if (!pair) return;
        ctx.fillStyle = pair[0];
        ctx.fill('evenodd');
        ctx.strokeStyle = pair[1];
        ctx.lineWidth = f.kind === 'building' ? 0.65 : 0.8;
        ctx.stroke();
        return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (f.kind === 'road') {
        // Retain the classic solid paths against the original green-space fills.
        if (path(f)) {
            if (pass !== 'surface') return;
            ctx.lineWidth = Math.max(0.55, (f.width || 4) * scale);
            ctx.strokeStyle = '#e5ddc9';
            ctx.stroke();
            return;
        }
        ctx.lineWidth = width + (pass === 'casing' ? 1.1 : 0);
        ctx.strokeStyle =
            pass === 'casing'
                ? major(f)
                    ? '#b49968'
                    : '#9e998d'
                : major(f)
                  ? '#f9dfa5'
                  : '#f3eee2';
        ctx.stroke();
        ctx.setLineDash([]);
    }
}
