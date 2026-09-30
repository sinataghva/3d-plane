import portalJunctions from '../../data/tehran/portal-junctions.json';
import { tehranLandmarks } from './tehranLandmarks.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { subtractConvex, offsetLine } from './scenerySurfaces.js';
import * as THREE from 'three';
import { createRenderedHeight } from './groundDetail.js';
import { distanceToLine } from './surfaceFeatures.js';

/** @typedef {import('./geography.js').GeoFeature} Feature */
/** @typedef {{feature:Feature,distances:number[],length:number,lift:number,start:number,end:number,samples?:number[][]}} Profile */
const caches = new WeakMap();
const elevated = new WeakSet();
/** Only registered Tehran bridges and tunnel approaches are removed from the flat ground representation.
 * @param {Feature} f */
export const isStructuredBridge = (f) => elevated.has(f);
/** @param {string|undefined} tag */
const active = (tag) => Boolean(tag && tag !== 'no');
/** @param {number[]} p */
const nodeKey = (p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
/** @param {Feature} f */
const pedestrian = (f) =>
    ['footway', 'pedestrian', 'path', 'steps', 'cycleway'].includes(
        f.class || ''
    );
/** @param {Feature} f */
export const structureWidth = (f) =>
    Math.max(2, Math.min(28, f.width || (pedestrian(f) ? 3 : 8)));
/** @param {number} t */
const smooth = (t) => {
    const v = Math.max(0, Math.min(1, t));
    return v * v * (3 - 2 * v);
};

/** Shared curved approach coordinates for the floor, walls and terrain cuts.
 * @param {any} portal @param {number} along @param {number} [side] */
export function portalPoint(portal, along, side = 0) {
    const path = portal.path;
    if (!path || along >= 0)
        return [
            portal.point[0] +
                portal.direction[0] * along +
                portal.direction[1] * side,
            portal.point[1] +
                portal.direction[1] * along -
                portal.direction[0] * side
        ];
    const distance = -along;
    for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
            b = path[i];
        if (distance <= b[2] + 1e-6 || i === path.length - 1) {
            const t = Math.max(
                0,
                Math.min(1, (distance - a[2]) / (b[2] - a[2]))
            );
            // Shared mitered cross-sections keep adjacent strips joined on bends.
            return [
                a[0] + (b[0] - a[0]) * t + (a[3] + (b[3] - a[3]) * t) * side,
                a[1] + (b[1] - a[1]) * t + (a[4] + (b[4] - a[4]) * t) * side
            ];
        }
    }
    return portal.point;
}

/** Exact visible portions of a retaining wall outside sibling excavations.
 * @param {number[]} a @param {number[]} b @param {number[][][]} masks */
export function exposedWallIntervals(a, b, masks) {
    const cross = (/** @type {number[]} */ u, /** @type {number[]} */ v) =>
        u[0] * v[1] - u[1] * v[0];
    const direction = [b[0] - a[0], b[1] - a[1]],
        breaks = [0, 1];
    for (const mask of masks)
        for (let i = 0; i < mask.length; i++) {
            const p = mask[i],
                q = mask[(i + 1) % mask.length],
                edge = [q[0] - p[0], q[1] - p[1]],
                den = cross(direction, edge);
            if (Math.abs(den) < 1e-9) continue;
            const offset = [p[0] - a[0], p[1] - a[1]],
                t = cross(offset, edge) / den,
                u = cross(offset, direction) / den;
            if (t > 0 && t < 1 && u >= 0 && u <= 1) breaks.push(t);
        }
    breaks.sort((a, b) => a - b);
    const intervals = [];
    for (let i = 1; i < breaks.length; i++) {
        const t = (breaks[i - 1] + breaks[i]) / 2,
            p = [a[0] + direction[0] * t, a[1] + direction[1] * t];
        const inside = masks.some((mask) => {
            const signs = mask.map((a, i) => {
                const b = mask[(i + 1) % mask.length];
                return cross(
                    [b[0] - a[0], b[1] - a[1]],
                    [p[0] - a[0], p[1] - a[1]]
                );
            });
            return (
                signs.every((s) => s >= -1e-8) || signs.every((s) => s <= 1e-8)
            );
        });
        if (!inside && breaks[i] - breaks[i - 1] > 1e-7)
            intervals.push([breaks[i - 1], breaks[i]]);
    }
    return intervals;
}

/** Cached, deterministic profiles shared by scenery and traffic. No source-file edits.
 * @param {import('./geography.js').Geography} world */
export function getRoadStructures(world) {
    if (caches.has(world)) return caches.get(world);
    if (world.data.airfield?.includes('OIII'))
        for (const f of world.data.features) {
            const points =
                portalJunctions.features[
                    /** @type {keyof typeof portalJunctions.features} */ (f.id)
                ];
            if (points) f.points = points;
        }
    const height = createRenderedHeight(world);
    /** @type {Map<string,Profile>} */
    const profiles = new Map();
    /** @type {Map<string,Feature[]>} */
    const nodes = new Map();
    /** @type {Map<string,Feature[]>} */
    const allNodes = new Map();
    const roads = world.data.features.filter(
        (f) => f.kind === 'road' && f.line && f.points.length > 1
    );
    const tehran = Boolean(world.data.airfield?.includes('OIII'));
    const tabiat = world.data.origin
        ? tehranLandmarks(world.data).find((l) => l.id === 'tabiat')
        : undefined;
    for (const f of roads) {
        for (const p of f.points) {
            const key = nodeKey(p);
            if (!allNodes.has(key)) allNodes.set(key, []);
            allNodes.get(key)?.push(f);
        }
        for (const p of [f.points[0], f.points[f.points.length - 1]]) {
            const key = nodeKey(p);
            if (!nodes.has(key)) nodes.set(key, []);
            nodes.get(key)?.push(f);
        }
        if (
            !tehran ||
            !active(f.bridge) ||
            active(f.tunnel) ||
            active(f.covered) ||
            ['construction', 'proposed'].includes(f.class || '')
        )
            continue;
        if (
            f.id.startsWith('w327418796') ||
            (tabiat &&
                pedestrian(f) &&
                f.points.every(
                    (p) =>
                        Math.abs(p[0] - tabiat.x) < 300 &&
                        Math.abs(p[1] - tabiat.z) < 90
                ))
        ) {
            elevated.add(f);
            continue;
        } // Existing custom Tabiat deck/approach heights.
        const distances = [0];
        for (let i = 1; i < f.points.length; i++)
            distances.push(
                distances[i - 1] +
                    Math.hypot(
                        f.points[i][0] - f.points[i - 1][0],
                        f.points[i][1] - f.points[i - 1][1]
                    )
            );
        if (distances[distances.length - 1] < 3) continue;
        // Estimated vertical bands preserve mapped crossing order, not surveyed heights.
        const band = Math.max(1, Math.min(3, Number(f.layer) || 1));
        profiles.set(f.id, {
            feature: f,
            distances,
            length: distances[distances.length - 1],
            lift: pedestrian(f) ? 6 : 7 * band,
            start: 0,
            end: 0
        });
        elevated.add(f);
    }
    for (const profile of profiles.values()) {
        for (const side of /** @type {const} */ (['start', 'end'])) {
            const p =
                profile.feature.points[
                    side === 'start' ? 0 : profile.feature.points.length - 1
                ];
            const adjacent = (nodes.get(nodeKey(p)) || []).filter(
                (f) => f !== profile.feature && profiles.has(f.id)
            );
            if (adjacent.length)
                profile[side] = Math.max(
                    profile.lift,
                    ...adjacent.map((f) => profiles.get(f.id)?.lift || 0)
                );
        }
    }
    // A smoothstep ramp peaks at 1.5 times its average grade. Limit the
    // added bridge rise to 8% even on short source ways, and carry that
    // constraint through joined bridge fragments so their endpoints agree.
    const rampGrade = 0.08 / 1.5;
    const endpointLifts = new Map();
    for (const p of profiles.values()) {
        endpointLifts.set(nodeKey(p.feature.points[0]), p.start);
        endpointLifts.set(
            nodeKey(p.feature.points[p.feature.points.length - 1]),
            p.end
        );
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (const p of profiles.values()) {
            const a = nodeKey(p.feature.points[0]);
            const b = nodeKey(p.feature.points[p.feature.points.length - 1]);
            const start = endpointLifts.get(a),
                end = endpointLifts.get(b);
            const reach = p.length * rampGrade;
            if (start > end + reach + 1e-9) {
                endpointLifts.set(a, end + reach);
                changed = true;
            }
            if (end > start + reach + 1e-9) {
                endpointLifts.set(b, start + reach);
                changed = true;
            }
        }
    }
    for (const p of profiles.values()) {
        p.start = endpointLifts.get(nodeKey(p.feature.points[0]));
        p.end = endpointLifts.get(
            nodeKey(p.feature.points[p.feature.points.length - 1])
        );
        p.lift = Math.max(
            p.start,
            p.end,
            Math.min(p.lift, (p.start + p.end + p.length * rampGrade) / 2)
        );
    }
    /** @param {Feature} f @param {number} x @param {number} z */
    function elevation(f, x, z) {
        const base = height(x, z),
            p = profiles.get(f.id);
        if (!p) {
            const rampPortals = approaches.get(f.id) || [];
            let depth = 0;
            for (const portal of rampPortals) {
                const path = portal.path;
                if (!path) continue;
                let nearest = Infinity,
                    distance = portal.length;
                for (let i = 1; i < path.length; i++) {
                    const a = path[i - 1],
                        b = path[i],
                        dx = b[0] - a[0],
                        dz = b[1] - a[1];
                    const t = Math.max(
                        0,
                        Math.min(
                            1,
                            ((x - a[0]) * dx + (z - a[1]) * dz) /
                                (dx * dx + dz * dz)
                        )
                    );
                    const error = Math.hypot(
                        x - a[0] - dx * t,
                        z - a[1] - dz * t
                    );
                    if (error < nearest) {
                        nearest = error;
                        distance = a[2] + (b[2] - a[2]) * t;
                    }
                }
                if (nearest <= portal.width / 2 + 1)
                    depth = Math.max(
                        depth,
                        (portal.depth ?? 5.2) *
                            smooth(1 - distance / portal.length)
                    );
            }
            if (f.tunnel === 'yes') {
                // A branch merging into an unsplit surface way meets that road at grade.
                const mouth = surfaceMouths.find(
                    (portal) =>
                        portal.feature === f &&
                        !portal.recessed &&
                        Math.hypot(x - portal.point[0], z - portal.point[1]) <
                            40
                );
                return (
                    base -
                    (mouth
                        ? 5.2 *
                          smooth(
                              Math.hypot(
                                  x - mouth.point[0],
                                  z - mouth.point[1]
                              ) / 40
                          )
                        : 5.2)
                );
            }
            return base - depth;
        }
        if (p.samples) {
            let best = Infinity,
                y = base;
            for (let i = 1; i < p.samples.length; i++) {
                const a = p.samples[i - 1],
                    b = p.samples[i],
                    dx = b[0] - a[0],
                    dz = b[2] - a[2];
                const t = Math.max(
                    0,
                    Math.min(
                        1,
                        ((x - a[0]) * dx + (z - a[2]) * dz) /
                            (dx * dx + dz * dz || 1)
                    )
                );
                const distance =
                    (x - a[0] - dx * t) ** 2 + (z - a[2] - dz * t) ** 2;
                if (distance < best) {
                    best = distance;
                    y = a[1] + (b[1] - a[1]) * t;
                }
            }
            return y;
        }
        let best = Infinity,
            d = 0;
        for (let i = 1; i < f.points.length; i++) {
            const a = f.points[i - 1],
                b = f.points[i],
                dx = b[0] - a[0],
                dz = b[1] - a[1];
            const t = Math.max(
                0,
                Math.min(
                    1,
                    ((x - a[0]) * dx + (z - a[1]) * dz) /
                        (dx * dx + dz * dz || 1)
                )
            );
            const distance =
                (x - a[0] - dx * t) ** 2 + (z - a[1] - dz * t) ** 2;
            if (distance < best) {
                best = distance;
                d =
                    p.distances[i - 1] +
                    t * (p.distances[i] - p.distances[i - 1]);
            }
        }
        const startRamp = Math.max(0.001, (p.lift - p.start) / rampGrade);
        const endRamp = Math.max(0.001, (p.lift - p.end) / rampGrade);
        const lift =
            p.lift +
            (p.start - p.lift) * (1 - smooth(d / startRamp)) +
            (p.end - p.lift) * (1 - smooth((p.length - d) / endRamp));
        return base + Math.max(0, lift);
    }
    for (const profile of profiles.values()) {
        const points = profile.feature.points,
            samples = [];
        const step = Math.max(3, Math.min(60, profile.length / 4));
        for (let i = 1; i < points.length; i++) {
            const a = points[i - 1],
                b = points[i],
                n = Math.max(
                    1,
                    Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)
                );
            for (let j = i === 1 ? 0 : 1; j <= n; j++) {
                const x = a[0] + ((b[0] - a[0]) * j) / n,
                    z = a[1] + ((b[1] - a[1]) * j) / n;
                samples.push([x, elevation(profile.feature, x, z), z]);
            }
        }
        profile.samples = samples;
    }
    /** @type {any[]} */
    const portals = [];
    if (tehran)
        for (const f of roads) {
            if (
                f.tunnel !== 'yes' ||
                pedestrian(f) ||
                ['construction', 'proposed'].includes(f.class || '')
            )
                continue;
            for (const end of [false, true]) {
                const point = end ? f.points[f.points.length - 1] : f.points[0],
                    q = end ? f.points[f.points.length - 2] : f.points[1];
                const adjacent = allNodes.get(nodeKey(point)) || [];
                // A tag/OSM-way split underground is not another entrance.
                if (
                    !adjacent.some(
                        (g) =>
                            g !== f && !active(g.tunnel) && !active(g.covered)
                    )
                )
                    continue;
                const len = Math.hypot(q[0] - point[0], q[1] - point[1]) || 1;
                portals.push({
                    feature: f,
                    recessed: !adjacent.some(
                        (g) =>
                            !active(g.tunnel) &&
                            g.points
                                .slice(1, -1)
                                .some((p) => nodeKey(p) === nodeKey(point))
                    ),
                    point,
                    direction: [
                        (q[0] - point[0]) / len,
                        (q[1] - point[1]) / len
                    ]
                });
            }
        }
    const entrancePaths = portals.flatMap((portal) => {
        const links = portal.recessed
            ? (nodes.get(nodeKey(portal.point)) || [])
                  .filter(
                      (f) =>
                          !active(f.tunnel) &&
                          !active(f.covered) &&
                          !profiles.has(f.id)
                  )
                  .sort((a, b) => structureWidth(b) - structureWidth(a))
            : [];
        portal.approachId = links[0]?.id;
        portal.branches = links.slice(1).map((f) => ({
            ...portal,
            approachId: f.id,
            branch: true,
            branches: []
        }));
        const paths = [portal, ...portal.branches];
        for (const p of paths) p.siblings = paths;
        return paths;
    });
    /** @param {any} portal */
    function prepareApproach(portal) {
        portal.width = structureWidth(portal.feature);
        portal.length = 40;
        if (!portal.recessed) return;
        const candidates = (nodes.get(nodeKey(portal.point)) || [])
            .filter(
                (f) =>
                    !active(f.tunnel) &&
                    !active(f.covered) &&
                    !profiles.has(f.id)
            )
            .map((f) => ({
                f,
                points:
                    nodeKey(f.points[0]) === nodeKey(portal.point)
                        ? f.points
                        : [...f.points].reverse()
            }))
            .sort((a, b) => {
                const score = (
                    /** @type {{points:number[][]}} */ candidate
                ) => {
                    const p = candidate.points[1],
                        dx = p[0] - portal.point[0],
                        dz = p[1] - portal.point[1];
                    return (
                        (dx * portal.direction[0] + dz * portal.direction[1]) /
                        (Math.hypot(dx, dz) || 1)
                    );
                };
                return score(a) - score(b);
            });
        const approach =
            candidates.find((c) => c.f.id === portal.approachId) ||
            candidates[0];
        if (!approach) return;
        portal.width = structureWidth(approach.f);
        const path = [[...portal.point, 0]];
        for (let i = 1; i < approach.points.length; i++) {
            const a = path[path.length - 1],
                b = approach.points[i];
            const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
            if (length < 0.001) continue;
            const remaining = Math.min(length, 40 - a[2]);
            path.push([
                a[0] + ((b[0] - a[0]) * remaining) / length,
                a[1] + ((b[1] - a[1]) * remaining) / length,
                a[2] + remaining
            ]);
            if (path[path.length - 1][2] >= 40) break;
        }
        if (path.length < 2) return;
        portal.length = path[path.length - 1][2];
        portal.direction = [
            (path[0][0] - path[1][0]) / path[1][2],
            (path[0][1] - path[1][1]) / path[1][2]
        ];
        const offset = offsetLine(approach.points, 1);
        for (const vertex of path) {
            let best = Infinity,
                normal = [0, 0];
            for (let i = 1; i < approach.points.length; i++) {
                const a = approach.points[i - 1],
                    b = approach.points[i],
                    dx = b[0] - a[0],
                    dz = b[1] - a[1];
                const t = Math.max(
                    0,
                    Math.min(
                        1,
                        ((vertex[0] - a[0]) * dx + (vertex[1] - a[1]) * dz) /
                            (dx * dx + dz * dz || 1)
                    )
                );
                const error = Math.hypot(
                    vertex[0] - a[0] - dx * t,
                    vertex[1] - a[1] - dz * t
                );
                if (error < best) {
                    best = error;
                    normal = [
                        offset[i - 1][0] -
                            a[0] +
                            (offset[i][0] - b[0] - (offset[i - 1][0] - a[0])) *
                                t,
                        offset[i - 1][1] -
                            a[1] +
                            (offset[i][1] - b[1] - (offset[i - 1][1] - a[1])) *
                                t
                    ];
                }
            }
            vertex.push(...normal);
        }
        portal.path = path;
        portal.stations = [
            ...new Set([
                0,
                portal.length,
                ...path.map((p) => p[2]),
                ...Array.from(
                    { length: Math.floor(portal.length / 5) },
                    (_, i) => (i + 1) * 5
                )
            ])
        ].sort((a, b) => a - b);
    }
    entrancePaths.forEach(prepareApproach);
    for (const parent of portals) {
        if (!parent.path) continue;
        for (const vertex of parent.path.slice(1, -1)) {
            const links = nodes.get(nodeKey(vertex)) || [];
            for (const road of links) {
                if (
                    active(road.tunnel) ||
                    active(road.covered) ||
                    profiles.has(road.id) ||
                    parent.siblings.some(
                        (/** @type {any} */ p) => p.approachId === road.id
                    )
                )
                    continue;
                const branch = {
                    ...parent,
                    point: vertex.slice(0, 2),
                    approachId: road.id,
                    branch: true,
                    branches: [],
                    depth: 5.2 * smooth(1 - vertex[2] / parent.length),
                    ownerPoint: parent.point
                };
                prepareApproach(branch);
                if (!branch.path) continue;
                parent.branches.push(branch);
                parent.siblings.push(branch);
                entrancePaths.push(branch);
            }
        }
    }
    const surfaceMouths = portals.filter((portal) => !portal.recessed);
    /** @type {Map<string,typeof portals>} */
    const approaches = new Map();
    for (const portal of entrancePaths)
        for (const road of allNodes.get(nodeKey(portal.point)) || []) {
            if (
                !portal.recessed ||
                (portal.approachId && portal.approachId !== road.id) ||
                active(road.tunnel) ||
                active(road.covered) ||
                profiles.has(road.id)
            )
                continue;
            if (!approaches.has(road.id)) approaches.set(road.id, []);
            approaches.get(road.id)?.push(portal);
            elevated.add(road);
        }
    const cuts = entrancePaths
        .filter((p) => p.recessed)
        .flatMap((portal) => {
            const stations = [
                ...(portal.branch ? [] : [-5]),
                ...(portal.stations || [0, 40])
            ];
            const half = portal.width / 2 + 0.6;
            portal.cuts = stations
                .slice(1)
                .map((distance, i) => [
                    portalPoint(portal, -distance, -half),
                    portalPoint(portal, -distance, half),
                    portalPoint(portal, -stations[i], half),
                    portalPoint(portal, -stations[i], -half)
                ]);
            portal.ownCuts = portal.cuts;
            return portal.cuts;
        });
    for (const portal of portals)
        portal.cuts = (portal.cuts || []).concat(
            ...portal.branches.map((/** @type {any} */ p) => p.cuts || [])
        );
    const result = {
        profiles,
        bridgeEnds: new Set(
            [...profiles.values()].flatMap((p) => [
                nodeKey(p.feature.points[0]),
                nodeKey(p.feature.points[p.feature.points.length - 1])
            ])
        ),
        portals,
        approaches,
        cuts,
        elevation,
        height,
        roads
    };
    caches.set(world, result);
    return result;
}

/** Batches simple decks, parapets and portal headwalls by 500 m cell.
 * @param {import('./geography.js').Geography} world
 * @param {{key:string,features:Set<string>,portals:any[],roads:Feature[]}} cell @param {any} shared */
export function buildRoadStructureTile(world, cell, shared) {
    const preparation = prepareRoadStructureTile(world, cell, shared);
    let step = preparation.next();
    while (!step.done) step = preparation.next();
    return step.value;
}

/** Prepare one tile in resumable feature-sized steps. The caller publishes only
 * the completed mesh. Cancelling releases the temporary primitive geometry.
 * @param {import('./geography.js').Geography} world
 * @param {{key:string,features:Set<string>,portals:any[],roads:Feature[]}} cell
 * @param {any} shared */
export function* prepareRoadStructureTile(world, cell, shared) {
    const [tileX, tileZ] = cell.key.split(',').map(Number);
    const data = {
            ...shared,
            profiles: new Map(
                [...cell.features]
                    .filter((id) => shared.profiles.has(id))
                    .map((id) => [id, shared.profiles.get(id)])
            ),
            portals: cell.portals,
            roads: cell.roads
        },
        group = new THREE.Group();
    group.name = 'Tehran bridges and tunnel portals';
    /** @type {Map<string,{positions:number[],colors:number[]}>} */
    const chunks = new Map();
    let forcedKey = '';
    const asphalt = new THREE.Color(0x60676a),
        concrete = new THREE.Color(0xaaa89b),
        edgeColor = new THREE.Color(0xc6c1ad),
        dark = new THREE.Color(0x111a1c);
    const cube = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(),
        matrix = new THREE.Matrix4(),
        rotation = new THREE.Quaternion();
    let completed = false;
    /** @type {THREE.MeshLambertMaterial|undefined} */
    let material;
    try {
        /** @param {number[]} center @param {number[]} size @param {number} yaw @param {THREE.Color} color @param {boolean} [openEnds] */
        function box(center, size, yaw, color, openEnds = false) {
            const key =
                forcedKey ||
                `${Math.floor(center[0] / 500)},${Math.floor(center[2] / 500)}`;
            if (key !== cell.key) return;
            if (!chunks.has(key))
                chunks.set(key, { positions: [], colors: [] });
            const chunk = chunks.get(key);
            if (!chunk) return;
            rotation.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
            matrix.compose(
                new THREE.Vector3(...center),
                rotation,
                new THREE.Vector3(...size)
            );
            const p = cube.getAttribute('position'),
                v = new THREE.Vector3();
            for (
                let i = color === dark ? 24 : 0;
                i < (color === dark ? 30 : p.count);
                i++
            ) {
                if (
                    openEnds &&
                    Math.abs(cube.getAttribute('normal').getY(i)) > 0.5
                )
                    continue;
                v.fromBufferAttribute(p, i).applyMatrix4(matrix);
                chunk.positions.push(v.x, v.y, v.z);
                chunk.colors.push(color.r, color.g, color.b);
            }
        }
        /** Slope-following rectangular beam with exact shared end elevations.
         * @param {number[]} a @param {number[]} b @param {number} width @param {number} thickness @param {THREE.Color} color */
        function beam(a, b, width, thickness, color) {
            const key =
                forcedKey ||
                `${Math.floor((a[0] + b[0]) / 1000)},${Math.floor((a[2] + b[2]) / 1000)}`;
            if (key !== cell.key) return;
            if (!chunks.has(key))
                chunks.set(key, { positions: [], colors: [] });
            const chunk = chunks.get(key);
            if (!chunk) return;
            const dx = b[0] - a[0],
                dz = b[2] - a[2],
                len = Math.hypot(dx, dz) || 1,
                nx = ((-dz / len) * width) / 2,
                nz = ((dx / len) * width) / 2;
            const vs = [
                [a[0] + nx, a[1], a[2] + nz],
                [a[0] - nx, a[1], a[2] - nz],
                [b[0] - nx, b[1], b[2] - nz],
                [b[0] + nx, b[1], b[2] + nz]
            ];
            if (color === asphalt)
                for (let i = 0; i < 4; i++) {
                    const center = i < 2 ? a : b,
                        p = vs[i],
                        ground = data.height(center[0], center[2]);
                    p[1] +=
                        (data.height(p[0], p[2]) - ground) *
                        Math.max(0, 1 - (center[1] - ground - 0.12) / 2);
                }
            vs.push(...vs.map((p) => [p[0], p[1] - thickness, p[2]]));
            const faces =
                thickness <= 0.15
                    ? [0, 2, 1, 0, 3, 2]
                    : color === edgeColor
                      ? [1, 5, 6, 1, 6, 2]
                      : [0, 2, 1, 0, 3, 2, 1, 5, 6, 1, 6, 2, 3, 7, 4, 3, 4, 0];
            for (const i of faces) {
                chunk.positions.push(...vs[i]);
                chunk.colors.push(color.r, color.g, color.b);
            }
        }
        // Road index for rejecting supports in any crossing carriageway.
        // Long source ways can span many tiles; visit only this tile's 5 × 5 cells.
        /** @type {Map<string,{f:Feature,points:number[][]}[]>} */
        const roadCells = new Map();
        for (const f of data.profiles.size ? data.roads : [])
            for (let i = 1; i < f.points.length; i++) {
                const a = f.points[i - 1],
                    b = f.points[i];
                for (
                    let x = Math.max(
                        tileX * 5,
                        Math.floor((Math.min(a[0], b[0]) - 25) / 100)
                    );
                    x <=
                    Math.min(
                        tileX * 5 + 4,
                        Math.floor((Math.max(a[0], b[0]) + 25) / 100)
                    );
                    x++
                )
                    for (
                        let z = Math.max(
                            tileZ * 5,
                            Math.floor((Math.min(a[1], b[1]) - 25) / 100)
                        );
                        z <=
                        Math.min(
                            tileZ * 5 + 4,
                            Math.floor((Math.max(a[1], b[1]) + 25) / 100)
                        );
                        z++
                    ) {
                        const key = `${x},${z}`;
                        if (!roadCells.has(key)) roadCells.set(key, []);
                        roadCells.get(key)?.push({ f, points: [a, b] });
                    }
            }
        let bridges = 0,
            supports = 0;
        for (const profile of data.profiles.values()) {
            yield;
            const f = profile.feature;
            if (f.id.startsWith('w327418796')) continue; // Existing Tabiat landmark.
            bridges++;
            const width = structureWidth(f);
            const points = profile.samples.map((/** @type {number[]} */ p) => [
                p[0],
                p[2]
            ]);
            let previousSupport = -100,
                travelled = 0;
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1],
                    b = points[i],
                    length = Math.hypot(b[0] - a[0], b[1] - a[1]),
                    steps = 1;
                for (let j = 0; j < steps; j++) {
                    const at = (/** @type {number} */ t) => {
                        const x = a[0] + (b[0] - a[0]) * t,
                            z = a[1] + (b[1] - a[1]) * t;
                        return [
                            x,
                            profile.samples[i - 1][1] +
                                (profile.samples[i][1] -
                                    profile.samples[i - 1][1]) *
                                    t +
                                0.12,
                            z
                        ];
                    };
                    const p = at(j / steps),
                        q = at((j + 1) / steps);
                    beam(p, q, width, 0.65, asphalt);
                    const dx = q[0] - p[0],
                        dz = q[2] - p[2],
                        l = Math.hypot(dx, dz) || 1;
                    for (const sign of [-1, 1]) {
                        const ox = (-dz / l) * (width / 2 - 0.15) * sign,
                            oz = (dx / l) * (width / 2 - 0.15) * sign;
                        beam(
                            [p[0] + ox, p[1] + 0.8, p[2] + oz],
                            [q[0] + ox, q[1] + 0.8, q[2] + oz],
                            0.3,
                            0.8,
                            edgeColor
                        );
                    }
                    const d = travelled;
                    travelled += length;
                    if (
                        d - previousSupport < 45 ||
                        p[1] - data.height(p[0], p[2]) < 4
                    )
                        continue;
                    const blocked = (
                        roadCells.get(
                            `${Math.floor(p[0] / 100)},${Math.floor(p[2] / 100)}`
                        ) || []
                    ).some(
                        (g) =>
                            g.f !== f &&
                            !active(g.f.tunnel) &&
                            distanceToLine(p[0], p[2], g.points) <
                                structureWidth(g.f) / 2 + 2
                    );
                    if (!blocked) {
                        const h = p[1] - 0.65 - data.height(p[0], p[2]);
                        box(
                            [p[0], p[1] - 0.65 - h / 2, p[2]],
                            [1.3, h, 1.3],
                            0,
                            concrete,
                            true
                        );
                        supports++;
                        previousSupport = d;
                    }
                }
            }
        }
        // One continuous ribbon from the surface road through the descending approach.
        // Identical width, edge coordinates, winding and material on both sides of the join.
        for (const f of data.roads.filter((/** @type {Feature} */ f) =>
            data.approaches.has(f.id)
        )) {
            yield;
            const left = offsetLine(f.points, structureWidth(f) / 2),
                right = offsetLine(f.points, -structureWidth(f) / 2);
            const portals = data.approaches.get(f.id) || [];
            for (let i = 1; i < f.points.length; i++) {
                const a = f.points[i - 1],
                    b = f.points[i];
                const n = Math.max(
                    1,
                    Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3)
                );
                const section = (/** @type {number} */ t) => {
                    const x = a[0] + (b[0] - a[0]) * t,
                        z = a[1] + (b[1] - a[1]) * t;
                    const base = data.height(x, z),
                        y = data.elevation(f, x, z),
                        blend = Math.max(0, Math.min(1, (base - y) / 5.2));
                    const crossfall = 1 - blend;
                    return [left, right].map((edge) => {
                        const px =
                            edge[i - 1][0] + (edge[i][0] - edge[i - 1][0]) * t;
                        const pz =
                            edge[i - 1][1] + (edge[i][1] - edge[i - 1][1]) * t;
                        return [
                            px,
                            y + 0.12 + (data.height(px, pz) - base) * crossfall,
                            pz
                        ];
                    });
                };
                for (let j = 0; j < n; j++) {
                    const t = (j + 0.5) / n,
                        x = a[0] + (b[0] - a[0]) * t,
                        z = a[1] + (b[1] - a[1]) * t;
                    const portal = portals.find(
                        (/** @type {any} */ p) =>
                            p.path && distanceToLine(x, z, p.path) < 0.01
                    );
                    const key = portal
                        ? `${Math.floor((portal.ownerPoint || portal.point)[0] / 500)},${Math.floor((portal.ownerPoint || portal.point)[1] / 500)}`
                        : `${Math.floor(x / 500)},${Math.floor(z / 500)}`;
                    if (key !== cell.key) continue;
                    if (!chunks.has(key))
                        chunks.set(key, { positions: [], colors: [] });
                    const chunk = chunks.get(key);
                    if (!chunk) continue;
                    const aSection = section(j / n),
                        bSection = section((j + 1) / n);
                    const corners = [
                        aSection[0],
                        aSection[1],
                        bSection[1],
                        bSection[0]
                    ];
                    for (const k of [0, 2, 1, 0, 3, 2]) {
                        chunk.positions.push(...corners[k]);
                        chunk.colors.push(asphalt.r, asphalt.g, asphalt.b);
                    }
                }
            }
        }
        // Recessed scenic entrances; short approach cuts, no flyable bore.
        for (const portal of data.portals.flatMap((/** @type {any} */ p) => [
            p,
            ...p.branches
        ])) {
            yield;
            forcedKey = cell.key;
            const { direction: d, feature: f } = portal,
                w = portal.width || structureWidth(f),
                yaw = Math.atan2(d[0], d[1]),
                depth = portal.recessed ? (portal.depth ?? 5.2) : 0;
            const at = (
                /** @type {number} */ side,
                /** @type {number} */ along,
                /** @type {number} */ up
            ) => {
                const point = portalPoint(portal, along, side);
                const center = portalPoint(portal, along);
                return [
                    point[0],
                    data.height(center[0], center[1]) - depth + up,
                    point[1]
                ];
            };
            if (portal.recessed) {
                const stations = portal.stations || [0, 40];
                for (let j = 1; j < stations.length; j++) {
                    const a = -stations[j],
                        b = -stations[j - 1];
                    for (const side of [-1, 1]) {
                        const shoulder = (
                            /** @type {number} */ along,
                            /** @type {number} */ offset
                        ) => {
                            const center = portalPoint(portal, along),
                                p = portalPoint(
                                    portal,
                                    along,
                                    side * (w / 2 + offset)
                                );
                            const blend = smooth(1 + along / portal.length);
                            return [
                                p[0],
                                data.height(center[0], center[1]) -
                                    depth * blend +
                                    0.11 +
                                    (data.height(p[0], p[1]) -
                                        data.height(center[0], center[1])) *
                                        (1 - blend),
                                p[1]
                            ];
                        };
                        const corners = [
                            shoulder(a, 0),
                            shoulder(a, 0.6),
                            shoulder(b, 0.6),
                            shoulder(b, 0)
                        ];
                        if (!chunks.has(cell.key))
                            chunks.set(cell.key, { positions: [], colors: [] });
                        const chunk = chunks.get(cell.key);
                        if (chunk)
                            for (const k of side > 0
                                ? [0, 2, 1, 0, 3, 2]
                                : [0, 1, 2, 0, 2, 3]) {
                                chunk.positions.push(...corners[k]);
                                chunk.colors.push(
                                    asphalt.r,
                                    asphalt.g,
                                    asphalt.b
                                );
                            }
                    }
                    // Walls rise out of the roadside as the road descends. Their foot
                    // follows the ramp instead of a full-height box ending above ground.
                    for (const side of [-1, 1]) {
                        const start = portalPoint(
                                portal,
                                a,
                                side * (w / 2 + 0.6)
                            ),
                            end = portalPoint(portal, b, side * (w / 2 + 0.6));
                        const masks = (portal.siblings || [])
                            .filter((/** @type {any} */ p) => p !== portal)
                            .flatMap((/** @type {any} */ p) => p.ownCuts || []);
                        for (const interval of exposedWallIntervals(
                            start,
                            end,
                            masks
                        )) {
                            const from = a + (b - a) * interval[0],
                                to = a + (b - a) * interval[1];
                            const edge = (
                                /** @type {number} */ along,
                                /** @type {number} */ offset,
                                /** @type {boolean} */ top
                            ) => {
                                const center = portalPoint(portal, along);
                                const p = portalPoint(
                                    portal,
                                    along,
                                    side * (w / 2 + offset)
                                );
                                const blend = smooth(1 + along / portal.length);
                                const y = top
                                    ? data.height(p[0], p[1]) + 0.15 * blend
                                    : data.height(center[0], center[1]) -
                                      depth * blend -
                                      0.1;
                                return [p[0], y, p[1]];
                            };
                            const corners = [
                                edge(from, 0, false),
                                edge(to, 0, false),
                                edge(to, 0, true),
                                edge(from, 0, true),
                                edge(from, 0.6, true),
                                edge(to, 0.6, true)
                            ];
                            if (!chunks.has(cell.key))
                                chunks.set(cell.key, {
                                    positions: [],
                                    colors: []
                                });
                            const chunk = chunks.get(cell.key);
                            if (!chunk) continue;
                            for (const k of [
                                0, 1, 2, 0, 2, 3, 3, 2, 5, 3, 5, 4
                            ]) {
                                chunk.positions.push(...corners[k]);
                                chunk.colors.push(
                                    concrete.r,
                                    concrete.g,
                                    concrete.b
                                );
                            }
                        }
                    }
                }
            }
            if (portal.branch) continue;
            // Close the short mouth floor between the approach and the opaque bore.
            const mouth = [
                at(-w / 2, 0, 0.12),
                at(w / 2, 0, 0.12),
                at(w / 2, 5, 0.12),
                at(-w / 2, 5, 0.12)
            ];
            if (!chunks.has(cell.key))
                chunks.set(cell.key, { positions: [], colors: [] });
            const mouthChunk = chunks.get(cell.key);
            if (mouthChunk)
                for (const k of [0, 2, 1, 0, 3, 2]) {
                    mouthChunk.positions.push(...mouth[k]);
                    mouthChunk.colors.push(asphalt.r, asphalt.g, asphalt.b);
                }
            box(at(0, 4, 2.7), [w, 5.4, 0.2], yaw, dark);
            box(at(0, 2, 5.7), [w + 1.6, 1.0, 5], yaw, concrete);
            for (const side of [-1, 1]) {
                box(
                    at(side * (w / 2 + 0.4), 1, 2.7),
                    [0.8, 5.4, 6],
                    yaw,
                    concrete
                );
            }
        }
        yield;
        material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            side: THREE.DoubleSide
        });
        let bytes = 0,
            triangles = 0;
        for (const c of chunks.values()) {
            let geo = new THREE.BufferGeometry();
            geo.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(c.positions, 3)
            );
            geo.setAttribute(
                'color',
                new THREE.Float32BufferAttribute(c.colors, 3)
            );
            geo.computeVertexNormals();
            const indexed = mergeVertices(geo);
            geo.dispose();
            geo = indexed;
            geo.computeBoundingSphere();
            const mesh = new THREE.Mesh(geo, material);
            mesh.name = 'Road structure batch';
            mesh.receiveShadow = true;
            group.add(mesh);
            triangles += c.positions.length / 9;
            bytes +=
                Object.values(geo.attributes).reduce(
                    (n, a) => n + a.array.byteLength,
                    0
                ) + (geo.index?.array.byteLength || 0);
        }
        // Let the scheduler separate expensive mesh finalization from the
        // terrain-cut/visibility activation. The group is still unpublished.
        yield;
        completed = true;
        return {
            group,
            data,
            stats: () => ({
                structureBridges: bridges,
                structurePortals: data.portals.length,
                structureSupports: supports,
                structureTriangles: triangles,
                structureBytes: bytes,
                structureBatches: group.children.length
            }),
            /** @param {THREE.Vector3} position @param {string} quality */
            update(position, quality) {
                const range =
                    quality === 'low'
                        ? 4000
                        : quality === 'balanced'
                          ? 6000
                          : 10000;
                for (const child of group.children) {
                    const mesh = /** @type {THREE.Mesh} */ (child);
                    if (!mesh.geometry.boundingSphere) continue;
                    const distance =
                        mesh.geometry.boundingSphere.center.distanceTo(
                            position
                        ) - mesh.geometry.boundingSphere.radius;
                    mesh.visible = distance < range;
                    mesh.castShadow = quality !== 'low' && distance < 1500;
                }
            },
            dispose() {
                for (const child of group.children)
                    /** @type {THREE.Mesh} */ (child).geometry.dispose();
                material?.dispose();
            }
        };
    } finally {
        cube.dispose();
        if (!completed) {
            for (const child of group.children)
                /** @type {THREE.Mesh} */ (child).geometry.dispose();
            material?.dispose();
            group.clear();
        }
    }
}

/** Cut only the short entrance approaches out of the coarse rendered terrain.
 * Aircraft/bomb height queries intentionally retain the original terrain.
 * @param {import('./geography.js').Geography} world @param {THREE.BufferGeometry} geometry */
export function cutTunnelApproaches(world, geometry) {
    const { cuts, height } = getRoadStructures(world);
    if (!cuts.length || !geometry.index) return;
    const position = geometry.getAttribute('position'),
        uv = geometry.getAttribute('uv');
    const positions = Array.from(position.array),
        uvs = Array.from(uv.array),
        indices = [];
    const cells = new Map();
    for (const mask of cuts) {
        const xs = mask.map((/** @type {number[]} */ p) => p[0]),
            zs = mask.map((/** @type {number[]} */ p) => p[1]);
        for (
            let x = Math.floor(Math.min(...xs) / 250);
            x <= Math.floor(Math.max(...xs) / 250);
            x++
        )
            for (
                let z = Math.floor(Math.min(...zs) / 250);
                z <= Math.floor(Math.max(...zs) / 250);
                z++
            ) {
                const key = `${x},${z}`;
                if (!cells.has(key)) cells.set(key, new Set());
                cells.get(key).add(mask);
            }
    }
    for (let i = 0; i < geometry.index.count; i += 3) {
        const ids = [
            geometry.index.getX(i),
            geometry.index.getX(i + 1),
            geometry.index.getX(i + 2)
        ];
        const triangle = ids.map((id) => [
            position.getX(id),
            position.getZ(id)
        ]);
        const xs = triangle.map((p) => p[0]),
            zs = triangle.map((p) => p[1]),
            masks = new Set();
        for (
            let x = Math.floor(Math.min(...xs) / 250);
            x <= Math.floor(Math.max(...xs) / 250);
            x++
        )
            for (
                let z = Math.floor(Math.min(...zs) / 250);
                z <= Math.floor(Math.max(...zs) / 250);
                z++
            )
                for (const mask of cells.get(`${x},${z}`) || [])
                    masks.add(mask);
        if (!masks.size) {
            indices.push(...ids);
            continue;
        }
        let pieces = [triangle];
        for (const mask of masks)
            pieces = pieces.flatMap((p) => subtractConvex(p, mask));
        for (const poly of pieces) {
            const base = positions.length / 3;
            for (const [x, z] of poly) {
                positions.push(x, height(x, z), z);
                uvs.push(
                    (x - world.minX) / world.width,
                    1 - (z - world.minZ) / world.depth
                );
            }
            for (let j = 1; j < poly.length - 1; j++)
                indices.push(base, base + j, base + j + 1);
        }
    }
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.deleteAttribute('normal');
    geometry.computeVertexNormals();
}

export { createRoadStructures } from './roadStructureStream.js';
