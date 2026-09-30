/** Estimated clearance above mapped vehicle roads. All units are metres. */
export const BRIDGE_CLEARANCE = 4.5;
const DECK_ALLOWANCE = 0.7;
const APPROACH_GRADE = 0.06;
const CELL = 500;
const vehicle = (/** @type {any} */ f) =>
    [
        'motorway',
        'motorway_link',
        'trunk',
        'trunk_link',
        'primary',
        'primary_link',
        'secondary',
        'secondary_link',
        'tertiary',
        'tertiary_link',
        'residential',
        'unclassified',
        'living_street',
        'service'
    ].includes(f.class);
const active = (/** @type {string|undefined} */ tag) => tag && tag !== 'no';
const key = (/** @type {number[]} */ p) =>
    `${p[0].toFixed(1)},${p[1].toFixed(1)}`;

/** Raise decks at mapped road crossings, continuing gradual approaches through
 * connected source geometry rather than squeezing ramps into the bridge tag.
 * @param {any[]} roads @param {Map<string,any>} profiles
 * @param {Map<string,any[]>} nodes @param {(x:number,z:number)=>number} height
 * @param {(f:any)=>number} width
 */
export function applyBridgeClearance(roads, profiles, nodes, height, width) {
    const originals = new Map(profiles);
    /** @type {Map<string,{f:any,distances:number[],length:number,seeds:Map<number,number>}>} */
    const info = new Map();
    const get = (/** @type {any} */ f) => {
        if (!info.has(f.id)) {
            const distances = [0];
            for (let i = 1; i < f.points.length; i++)
                distances.push(
                    distances[i - 1] +
                        Math.hypot(
                            f.points[i][0] - f.points[i - 1][0],
                            f.points[i][1] - f.points[i - 1][1]
                        )
                );
            info.set(f.id, {
                f,
                distances,
                length: distances[distances.length - 1],
                seeds: new Map()
            });
        }
        return /** @type {{f:any,distances:number[],length:number,seeds:Map<number,number>}} */ (
            info.get(f.id)
        );
    };
    const at = (
        /** @type {ReturnType<typeof get>} */ r,
        /** @type {number} */ distance
    ) => {
        for (let i = 1; i < r.distances.length; i++)
            if (distance <= r.distances[i] || i === r.distances.length - 1) {
                const t = Math.max(
                    0,
                    Math.min(
                        1,
                        (distance - r.distances[i - 1]) /
                            (r.distances[i] - r.distances[i - 1] || 1)
                    )
                );
                return r.f.points[i - 1].map(
                    (/** @type {number} */ v, /** @type {number} */ j) =>
                        v + (r.f.points[i][j] - v) * t
                );
            }
        return r.f.points[0];
    };
    const lift = (
        /** @type {ReturnType<typeof get>} */ r,
        /** @type {number} */ d
    ) => {
        let result = 0;
        for (const [position, value] of r.seeds)
            result = Math.max(
                result,
                value - APPROACH_GRADE * Math.abs(d - position)
            );
        return result;
    };
    const base = (/** @type {any} */ f, /** @type {number} */ d) => {
        const r = get(f),
            point = at(r, d),
            p = originals.get(f.id);
        if (!p) return height(point[0], point[1]);
        let travelled = 0;
        for (let i = 1; i < p.samples.length; i++) {
            const a = p.samples[i - 1],
                b = p.samples[i],
                length = Math.hypot(b[0] - a[0], b[2] - a[2]);
            if (d <= travelled + length || i === p.samples.length - 1)
                return (
                    a[1] +
                    (b[1] - a[1]) *
                        Math.max(
                            0,
                            Math.min(1, (d - travelled) / (length || 1))
                        )
                );
            travelled += length;
        }
        return height(point[0], point[1]);
    };
    const elevation = (/** @type {any} */ f, /** @type {number} */ d) => {
        const r = get(f),
            p = at(r, d);
        return Math.max(base(f, d), height(p[0], p[1]) + lift(r, d));
    };
    /** @type {{r:ReturnType<typeof get>,d:number,h:number}[]} */ const queue =
        [];
    const seed = (
        /** @type {any} */ f,
        /** @type {number} */ d,
        /** @type {number} */ h
    ) => {
        const r = get(f);
        if (h <= lift(r, d) + 1e-6) return;
        r.seeds.set(d, h);
        queue.push({ r, d, h });
    };
    const propagate = () => {
        for (let cursor = 0; cursor < queue.length; cursor++) {
            const { r, d, h } = queue[cursor];
            for (let i = 0; i < r.f.points.length; i++) {
                const remaining =
                    h - APPROACH_GRADE * Math.abs(r.distances[i] - d);
                if (remaining <= 0) continue;
                for (const f of nodes.get(key(r.f.points[i])) || []) {
                    if (
                        f === r.f ||
                        active(f.tunnel) ||
                        active(f.covered) ||
                        ['construction', 'proposed'].includes(f.class) ||
                        (active(f.bridge) && !originals.has(f.id))
                    )
                        continue;
                    const other = get(f);
                    for (let j = 0; j < f.points.length; j++) {
                        if (key(f.points[j]) !== key(r.f.points[i])) continue;
                        // Geometric crossings of different levels are not joins.
                        const internal =
                            active(r.f.bridge) &&
                            i > 0 &&
                            i < r.f.points.length - 1;
                        const otherInternal =
                            active(f.bridge) &&
                            j > 0 &&
                            j < f.points.length - 1;
                        if (
                            (internal || otherInternal) &&
                            Number(r.f.layer || 0) !== Number(f.layer || 0)
                        )
                            continue;
                        seed(f, other.distances[j], remaining);
                    }
                }
            }
        }
        queue.length = 0;
    };
    /** @type {Map<string,any[]>} */ const grid = new Map();
    const visit = (
        /** @type {number[]} */ a,
        /** @type {number[]} */ b,
        /** @type {(k:string)=>void} */ fn
    ) => {
        for (
            let x = Math.floor(Math.min(a[0], b[0]) / CELL);
            x <= Math.floor(Math.max(a[0], b[0]) / CELL);
            x++
        )
            for (
                let z = Math.floor(Math.min(a[1], b[1]) / CELL);
                z <= Math.floor(Math.max(a[1], b[1]) / CELL);
                z++
            )
                fn(`${x},${z}`);
    };
    for (const f of roads) {
        if (!vehicle(f) || active(f.tunnel) || active(f.covered)) continue;
        for (let i = 1; i < f.points.length; i++) {
            const segment = { f, i, a: f.points[i - 1], b: f.points[i] };
            visit(segment.a, segment.b, (k) => {
                if (!grid.has(k)) grid.set(k, []);
                grid.get(k)?.push(segment);
            });
        }
    }
    let crossings = 0;
    for (const band of [1, 2, 3]) {
        for (const profile of originals.values()) {
            const f = profile.feature;
            if (Math.max(1, Math.min(3, Number(f.layer) || 1)) !== band)
                continue;
            const r = get(f);
            for (let i = 1; i < f.points.length; i++) {
                const a = f.points[i - 1],
                    b = f.points[i],
                    dx = b[0] - a[0],
                    dz = b[1] - a[1],
                    length = Math.hypot(dx, dz);
                const candidates = new Set();
                visit(a, b, (k) => {
                    for (const segment of grid.get(k) || [])
                        candidates.add(segment);
                });
                for (const { f: lower, i: j, a: c, b: e } of candidates) {
                    if (
                        lower === f ||
                        (active(lower.bridge) &&
                            Math.max(1, Number(lower.layer) || 1) >= band)
                    )
                        continue;
                    const ux = e[0] - c[0],
                        uz = e[1] - c[1],
                        otherLength = Math.hypot(ux, uz),
                        det = dx * uz - dz * ux;
                    if (Math.abs(det) < 1e-6) continue;
                    const t = ((c[0] - a[0]) * uz - (c[1] - a[1]) * ux) / det;
                    const u = ((c[0] - a[0]) * dz - (c[1] - a[1]) * dx) / det;
                    if (t < 0 || t > 1 || u < 0 || u > 1) continue;
                    const d = r.distances[i - 1] + t * length;
                    if (d < 0.01 || d > r.length - 0.01) continue;
                    const lowerInfo = get(lower),
                        lowerD = lowerInfo.distances[j - 1] + u * otherLength;
                    const sine = Math.abs(det) / (length * otherLength),
                        cosine =
                            Math.abs(dx * ux + dz * uz) /
                            (length * otherLength);
                    const span = Math.min(
                        r.length,
                        (width(lower) / 2 + (width(f) / 2) * cosine + 2) / sine
                    );
                    // Keep the footprint on these finite segments. Extending it
                    // around subsequent bends can sample unrelated hillside terrain.
                    const lowerSpan =
                        (width(f) / 2 + (width(lower) / 2) * cosine + 2) / sine;
                    let lowerY = -Infinity;
                    for (const q of [-lowerSpan, 0, lowerSpan]) {
                        const position = Math.max(
                                lowerInfo.distances[j - 1],
                                Math.min(lowerInfo.distances[j], lowerD + q)
                            ),
                            p = at(lowerInfo, position);
                        for (const side of [-1, 1])
                            lowerY = Math.max(
                                lowerY,
                                elevation(lower, position) +
                                    Math.max(
                                        0,
                                        height(
                                            p[0] -
                                                (((uz / otherLength) *
                                                    width(lower)) /
                                                    2) *
                                                    side,
                                            p[1] +
                                                (((ux / otherLength) *
                                                    width(lower)) /
                                                    2) *
                                                    side
                                        ) - height(p[0], p[1])
                                    )
                            );
                    }
                    const target = lowerY + BRIDGE_CLEARANCE + DECK_ALLOWANCE;
                    const positions = [
                        Math.max(r.distances[i - 1], d - span),
                        d,
                        Math.min(r.distances[i], d + span)
                    ];
                    if (
                        positions.every(
                            (position) => elevation(f, position) >= target
                        )
                    )
                        continue;
                    crossings++;
                    for (const position of positions) {
                        const p = at(r, position);
                        seed(f, position, target - height(p[0], p[1]));
                    }
                }
            }
        }
        propagate();
    }
    let adjusted = 0;
    for (const r of info.values()) {
        if (!r.seeds.size) continue;
        const p = originals.get(r.f.id);
        const stations = new Set(r.distances);
        // Surface approaches can be long, sparsely mapped ways. Follow local
        // terrain between source vertices instead of cutting through a hill.
        if (!p)
            for (let i = 1; i < r.distances.length; i++) {
                const start = r.distances[i - 1],
                    end = r.distances[i];
                const steps = Math.ceil((end - start) / 30);
                for (let j = 1; j < steps; j++)
                    stations.add(start + ((end - start) * j) / steps);
            }
        let distance = 0;
        if (p)
            for (let i = 0; i < p.samples.length; i++) {
                if (i)
                    distance += Math.hypot(
                        p.samples[i][0] - p.samples[i - 1][0],
                        p.samples[i][2] - p.samples[i - 1][2]
                    );
                stations.add(Math.min(r.length, distance));
            }
        for (const [d, h] of r.seeds) {
            stations.add(d);
            stations.add(Math.max(0, d - h / APPROACH_GRADE));
            stations.add(Math.min(r.length, d + h / APPROACH_GRADE));
        }
        const samples = [...stations]
            .sort((a, b) => a - b)
            .map((d) => {
                const point = at(r, d);
                return [point[0], elevation(r.f, d), point[1]];
            });
        profiles.set(r.f.id, {
            ...(p || {
                feature: r.f,
                distances: r.distances,
                length: r.length,
                lift: 0,
                start: 0,
                end: 0
            }),
            samples
        });
        adjusted++;
    }
    return { crossings, adjusted };
}
