import { inFeature } from './geography.js';

/** Join connected source ways only at the requested airport. Parallel runways
 * remain separate, and cached source objects are never modified.
 * @param {import('./geography.js').GeoData} data @param {string} icao */
export function joinAirportRunways(data, icao) {
    const boundary = data.features.find(
        (f) => f.kind === 'airfield' && f.icao === icao
    );
    if (!boundary) throw new Error(`Missing airport boundary: ${icao}`);
    const pending = data.features.filter(
        (f) =>
            f.kind === 'runway' &&
            f.line &&
            f.ref &&
            f.points.some((p) => inFeature(p[0], p[1], boundary))
    );
    const original = new Set(pending);
    const joined = [];
    const near = (/** @type {number[]} */ a, /** @type {number[]} */ b) =>
        Math.hypot(a[0] - b[0], a[1] - b[1]) < 2;
    while (pending.length) {
        const first = pending.shift();
        if (!first) break;
        const points = first.points.map((p) => [...p]);
        let found = true;
        while (found) {
            found = false;
            for (let i = 0; i < pending.length; i++) {
                const next = pending[i];
                if (next.ref !== first.ref) continue;
                let chain = next.points;
                if (
                    near(points[points.length - 1], chain[chain.length - 1]) ||
                    near(points[0], chain[0])
                )
                    chain = [...chain].reverse();
                if (near(points[points.length - 1], chain[0]))
                    points.push(...chain.slice(1));
                else if (near(points[0], chain[chain.length - 1]))
                    points.unshift(...chain.slice(0, -1));
                else continue;
                pending.splice(i, 1);
                found = true;
                break;
            }
        }
        joined.push({ ...first, points });
    }
    return {
        ...data,
        features: [...data.features.filter((f) => !original.has(f)), ...joined]
    };
}
