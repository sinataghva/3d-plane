import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { offsetLine } from './scenerySurfaces.js';
import { createRenderedHeight } from './groundDetail.js';
import { inFeature } from './geography.js';

/** @type {Record<string,number>} */
export const TRAFFIC_LIMITS = { low: 0, balanced: 20, high: 40 };
/** @param {import('./geography.js').GeoFeature} road */
export function suitableTrafficRoad(road) {
    return (
        road.kind === 'road' &&
        road.line &&
        road.points.length > 1 &&
        [
            'residential',
            'living_street',
            'unclassified',
            'tertiary',
            'secondary',
            'primary'
        ].includes(road.class || '') &&
        (!road.tunnel || road.tunnel === 'no') &&
        (!road.bridge || road.bridge === 'no') &&
        (road.width || 5) >= 4
    );
}
/** @param {number[][]} points */
export function trafficPath(points) {
    const clean = points.filter(
        (p, i) =>
            !i ||
            Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.1
    );
    const distances = [0];
    for (let i = 1; i < clean.length; i++)
        distances.push(
            distances[i - 1] +
                Math.hypot(
                    clean[i][0] - clean[i - 1][0],
                    clean[i][1] - clean[i - 1][1]
                )
        );
    return { points: clean, distances, length: distances.at(-1) || 0 };
}
/** @param {ReturnType<typeof trafficPath>} path @param {number} distance */
export function sampleTrafficPath(path, distance) {
    const d = Math.max(0, Math.min(path.length, distance));
    let lo = 0,
        hi = path.distances.length - 1;
    while (lo + 1 < hi) {
        const m = (lo + hi) >> 1;
        if (path.distances[m] <= d) lo = m;
        else hi = m;
    }
    const a = path.points[lo],
        b = path.points[Math.min(lo + 1, path.points.length - 1)];
    const t =
        (d - path.distances[lo]) /
        (path.distances[lo + 1] - path.distances[lo] || 1);
    return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t };
}
function carGeometry() {
    /** @type {THREE.BufferGeometry[]} */
    const parts = [];
    /** @param {[number,number,number]} size @param {[number,number,number]} position @param {number} color */
    const box = (size, position, color) => {
        const original = new THREE.BoxGeometry(...size);
        const g = original.toNonIndexed();
        original.dispose();
        g.translate(...position);
        const c = new THREE.Color(color),
            values = [];
        for (let i = 0; i < g.attributes.position.count; i++)
            values.push(c.r, c.g, c.b);
        g.setAttribute('color', new THREE.Float32BufferAttribute(values, 3));
        parts.push(g);
    };
    box([4, 0.6, 1.65], [0, 0.7, 0], 0xffffff);
    box([2, 0.65, 1.45], [-0.25, 1.3, 0], 0x39545b);
    box([1.7, 0.08, 1.45], [-0.25, 1.66, 0], 0xffffff);
    for (const x of [-1.25, 1.25])
        for (const z of [-0.8, 0.8])
            box([0.55, 0.55, 0.2], [x, 0.3, z], 0x202526);
    const merged = mergeGeometries(parts);
    parts.forEach((g) => g.dispose());
    return merged;
}
/** @typedef {ReturnType<typeof trafficPath>} TrafficPath */
/** @typedef {{path:TrafficPath,start:string,end:string,reverse:number,spacing:number}} TrafficEdge */
/** Shared mapped vertices form junctions; geometric crossings alone do not. Each
 * directed edge is shortened slightly to leave room for a continuous lane turn.
 * @param {import('./geography.js').GeoFeature[]} roads */
export function buildTrafficNetwork(roads) {
    /** @param {number[]} p */
    const key = (p) => `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`;
    /** @type {Map<string,number>} */
    const uses = new Map();
    for (const road of roads)
        for (const p of road.points)
            uses.set(key(p), (uses.get(key(p)) || 0) + 1);
    /** @type {TrafficEdge[]} */
    const edges = [];
    /** @type {Map<string,number[]>} */
    const outgoing = new Map();
    for (const road of roads) {
        let from = 0;
        for (let i = 1; i < road.points.length; i++) {
            if (
                i < road.points.length - 1 &&
                (uses.get(key(road.points[i])) || 0) < 2
            )
                continue;
            const points = road.points.slice(from, i + 1);
            from = i;
            if (trafficPath(points).length < 2) continue;
            const base = edges.length;
            for (const direction of [1, -1]) {
                const source = direction === 1 ? points : [...points].reverse();
                const lane = trafficPath(
                    offsetLine(source, Math.min(1.5, (road.width || 5) * 0.23))
                );
                const trim = Math.min(3, lane.length * 0.2);
                const a = sampleTrafficPath(lane, trim),
                    b = sampleTrafficPath(lane, lane.length - trim);
                const path = trafficPath([
                    [a.x, a.z],
                    ...lane.points.filter(
                        (_, j) =>
                            lane.distances[j] > trim &&
                            lane.distances[j] < lane.length - trim
                    ),
                    [b.x, b.z]
                ]);
                const start = key(source[0]),
                    end = key(source[source.length - 1]);
                if (!outgoing.has(start)) outgoing.set(start, []);
                outgoing.get(start)?.push(edges.length);
                edges.push({
                    path,
                    start,
                    end,
                    reverse: base + (direction === 1 ? 1 : 0),
                    spacing: ['primary', 'secondary'].includes(road.class || '')
                        ? 180
                        : 300
                });
            }
        }
    }
    return { edges, outgoing };
}
/** @param {TrafficPath} incoming @param {TrafficPath} outgoing */
function junctionPath(incoming, outgoing) {
    const a = sampleTrafficPath(incoming, incoming.length),
        a0 = sampleTrafficPath(incoming, incoming.length - 2);
    const b = sampleTrafficPath(outgoing, 0),
        b1 = sampleTrafficPath(outgoing, 2);
    const reach = Math.max(2, Math.hypot(b.x - a.x, b.z - a.z) * 0.55);
    const al = Math.hypot(a.x - a0.x, a.z - a0.z) || 1,
        bl = Math.hypot(b1.x - b.x, b1.z - b.z) || 1;
    const c = {
        x: a.x + ((a.x - a0.x) / al) * reach,
        z: a.z + ((a.z - a0.z) / al) * reach
    };
    const d = {
        x: b.x - ((b1.x - b.x) / bl) * reach,
        z: b.z - ((b1.z - b.z) / bl) * reach
    };
    return trafficPath(
        Array.from({ length: 13 }, (_, i) => {
            const t = i / 12,
                u = 1 - t;
            return [
                u * u * u * a.x +
                    3 * u * u * t * c.x +
                    3 * u * t * t * d.x +
                    t * t * t * b.x,
                u * u * u * a.z +
                    3 * u * u * t * c.z +
                    3 * u * t * t * d.z +
                    t * t * t * b.z
            ];
        })
    );
}
/** @param {number} seed */
function random(seed) {
    let n = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
    n = Math.imul(n ^ (n >>> 16), 0xc2b2ae35);
    return ((n ^ (n >>> 13)) >>> 0) / 4294967296;
}
/** @typedef {{id:number,edge:number,path:TrafficPath,distance:number,speed:number,color:number,turn:number,joining:boolean}} TrafficCar */
/** @param {TrafficCar} car @param {ReturnType<typeof buildTrafficNetwork>} network @param {number} delta */
export function advanceTrafficCar(car, network, delta) {
    car.distance += car.speed * delta;
    while (car.distance > car.path.length) {
        car.distance -= car.path.length;
        if (car.joining) {
            car.path = network.edges[car.edge].path;
            car.joining = false;
        } else {
            const edge = network.edges[car.edge];
            const choices = (network.outgoing.get(edge.end) || []).filter(
                (i) => i !== edge.reverse
            );
            const next = choices.length
                ? choices[
                      Math.floor(
                          random(car.id + ++car.turn * 7919) * choices.length
                      )
                  ]
                : edge.reverse;
            car.path = junctionPath(edge.path, network.edges[next].path);
            car.edge = next;
            car.joining = true;
        }
    }
}
/** Persistent local traffic, with geographic sampling and an invisible retention
 * band. Crossing a spatial cell never replaces cars that are already present.
 * @param {import('./geography.js').Geography} world */
export function createRoadTraffic(world) {
    const height = createRenderedHeight(world);
    const rural = Boolean(world.data.airfield?.includes('LFSX'));
    const boundaries = world.data.features.filter((f) => f.kind === 'airfield');
    const roads = world.data.features.filter(
        (f) =>
            suitableTrafficRoad(f) &&
            !boundaries.some((b) =>
                inFeature(f.points[0][0], f.points[0][1], b)
            )
    );
    const network = buildTrafficNetwork(roads);
    const paths = network.edges.map((e) => e.path);
    /** @type {Map<string, {edge:number,distance:number,x:number,z:number,seed:number}[]>} */
    const cells = new Map();
    network.edges.forEach((edge, index) => {
        const spacing = edge.spacing * (rural ? 1.6 : 1);
        // A short OSM segment no longer gets the same minimum population as a long road.
        for (
            let d = random(index + 1) * spacing;
            d < edge.path.length;
            d += spacing
        ) {
            const p = sampleTrafficPath(edge.path, d),
                key = `${Math.floor(p.x / 400)},${Math.floor(p.z / 400)}`;
            if (!cells.has(key)) cells.set(key, []);
            cells.get(key)?.push({
                edge: index,
                distance: d,
                ...p,
                seed: index * 103 + Math.floor(d)
            });
        }
    });
    for (const bucket of cells.values())
        bucket.sort((a, b) => random(a.seed) - random(b.seed));
    const geometry = carGeometry(),
        material = new THREE.MeshLambertMaterial({
            vertexColors: true,
            alphaHash: true
        });
    const fades = new THREE.InstancedBufferAttribute(new Float32Array(80), 1);
    geometry.setAttribute('trafficFade', fades);
    material.onBeforeCompile = (shader) => {
        shader.vertexShader =
            'attribute float trafficFade; varying float vTrafficFade;\n' +
            shader.vertexShader.replace(
                '#include <begin_vertex>',
                '#include <begin_vertex>\nvTrafficFade = trafficFade;'
            );
        shader.fragmentShader =
            'varying float vTrafficFade;\n' +
            shader.fragmentShader.replace(
                '#include <alphahash_fragment>',
                'diffuseColor.a *= vTrafficFade;\n#include <alphahash_fragment>'
            );
    };
    const mesh = new THREE.InstancedMesh(geometry, material, 80);
    mesh.name = 'Moving civilian road traffic';
    mesh.frustumCulled = false;
    mesh.count = 0;
    const palette = [
        0xe6e3d8, 0x9bafb3, 0xa34739, 0x405e7f, 0x89927b, 0x555963
    ].map((c) => new THREE.Color(c));
    const dummy = new THREE.Object3D();
    /** @type {TrafficCar[]} */
    let cars = [];
    let nextId = 1,
        initialized = false,
        count = 0,
        candidates = 0;
    let lastX = Infinity,
        lastZ = Infinity,
        lastLimit = 0;
    let scanElapsed = 0;
    /** @type {number|null} */
    let override = null;
    return {
        mesh,
        paths,
        preview() {
            const bucket = cells.values().next().value;
            return bucket?.[0] || null;
        },
        reset() {
            cars = [];
            nextId = 1;
            initialized = false;
            lastX = Infinity;
            lastZ = Infinity;
        },
        /** Dev benchmark only. @param {number|null} value */
        setLimit(value) {
            override = value === null ? null : Math.max(0, Math.min(80, value));
        },
        /** Read-only identities and positions for continuity regression checks. */
        snapshot() {
            return cars.map((car) => ({
                id: car.id,
                ...sampleTrafficPath(car.path, car.distance)
            }));
        },
        /** @param {import('three').Vector3|{x:number,y:number,z:number}} position @param {string} quality @param {number} delta */
        update(position, quality, delta) {
            const limit =
                override ??
                Math.round((TRAFFIC_LIMITS[quality] || 0) * (rural ? 0.5 : 1));
            mesh.visible = limit > 0;
            if (!limit) {
                cars = [];
                initialized = false;
                mesh.count = count = 0;
                lastLimit = 0;
                return;
            }
            for (const car of cars)
                advanceTrafficCar(car, network, Math.max(0, delta));
            const distanceTo = (/** @type {{x:number,z:number}} */ p) =>
                Math.hypot(p.x - position.x, p.z - position.z);
            cars = cars.filter(
                (car) =>
                    distanceTo(sampleTrafficPath(car.path, car.distance)) < 1800
            );
            if (cars.length > limit) {
                cars.sort(
                    (a, b) =>
                        distanceTo(sampleTrafficPath(a.path, a.distance)) -
                        distanceTo(sampleTrafficPath(b.path, b.distance))
                );
                cars.length = limit;
            }
            scanElapsed += Math.max(0, delta);
            if (
                !initialized ||
                (scanElapsed >= 2 && cars.length < limit) ||
                limit !== lastLimit ||
                Math.hypot(position.x - lastX, position.z - lastZ) > 100
            ) {
                const initial = !initialized;
                scanElapsed = 0;
                const cx = Math.floor(position.x / 400),
                    cz = Math.floor(position.z / 400);
                const buckets = [];
                for (let x = cx - 5; x <= cx + 5; x++)
                    for (let z = cz - 5; z <= cz + 5; z++) {
                        const bucket = (cells.get(`${x},${z}`) || []).filter(
                            (p) => {
                                const d = distanceTo(p);
                                return d < 1700 && (initial || d > 1500);
                            }
                        );
                        if (bucket.length) buckets.push(bucket);
                    }
                // Interleave geographic cells: no single road or dense block consumes the budget.
                buckets.sort((a, b) => distanceTo(a[0]) - distanceTo(b[0]));
                candidates = buckets.reduce((n, b) => n + b.length, 0);
                const occupied = cars.map((car) =>
                    sampleTrafficPath(car.path, car.distance)
                );
                for (
                    let pass = 0;
                    cars.length < limit && buckets.some((b) => b.length > pass);
                    pass++
                )
                    for (const bucket of buckets) {
                        if (cars.length >= limit) break;
                        const p = bucket[pass];
                        if (!p) continue;
                        if (
                            occupied.some(
                                (q) =>
                                    Math.hypot(p.x - q.x, p.z - q.z) <
                                    (rural ? 100 : 65)
                            )
                        )
                            continue;
                        const edge = network.edges[p.edge];
                        cars.push({
                            id: nextId++,
                            edge: p.edge,
                            path: edge.path,
                            distance: p.distance,
                            speed: 7 + random(p.seed) * 5,
                            color: p.seed % 6,
                            turn: 0,
                            joining: false
                        });
                        occupied.push(p);
                    }
                initialized = true;
                lastX = position.x;
                lastZ = position.z;
                lastLimit = limit;
            }
            count = 0;
            for (const car of cars) {
                const p = sampleTrafficPath(car.path, car.distance),
                    distance = distanceTo(p);
                if (distance >= 1500) continue;
                const q = sampleTrafficPath(
                    car.path,
                    Math.min(car.path.length, car.distance + 0.5)
                );
                const back =
                    Math.hypot(q.x - p.x, q.z - p.z) < 0.001
                        ? sampleTrafficPath(car.path, car.distance - 0.5)
                        : p;
                const y = height(p.x, p.z) + 0.08,
                    y2 = height(q.x, q.z) + 0.08;
                dummy.position.set(p.x, y, p.z);
                dummy.rotation.set(
                    0,
                    -Math.atan2(q.z - back.z, q.x - back.x),
                    Math.atan2(y2 - y, 0.5),
                    'YXZ'
                );
                dummy.updateMatrix();
                mesh.setMatrixAt(count, dummy.matrix);
                mesh.setColorAt(count, palette[car.color]);
                fades.setX(
                    count,
                    Math.max(0, Math.min(1, (1500 - distance) / 300))
                );
                count++;
            }
            mesh.count = count;
            mesh.instanceMatrix.needsUpdate = true;
            fades.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        },
        stats() {
            return {
                trafficCars: count,
                trafficActive: cars.length,
                trafficCandidates: candidates
            };
        },
        dispose() {
            geometry.dispose();
            material.dispose();
        }
    };
}
