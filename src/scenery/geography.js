import {
    isSurfaceFeature,
    isFlowingWater,
    distanceToLine
} from './surfaceFeatures.js';
import { joinAirportRunways } from './runwayLayout.js';
import {
    tehranLandmarks,
    landmarkContains,
    tabiatApproachHeight
} from './tehranLandmarks.js';
/** @typedef {{id:string,kind:string,name:string,points:number[][],holes:number[][][],line:boolean,width?:number,height?:number,aeroway?:string,icao?:string,surface?:string,lit?:string,buildingType?:string,roofShape?:string,palace?:boolean,ref?:string,class?:string,bridge?:string,tunnel?:string,covered?:string,layer?:string,intermittent?:string,railwayType?:string,waterwayType?:string,waterType?:string,gauge?:number,widthEstimated?:boolean,oneway?:string,junction?:string,lanes?:string}} GeoFeature */
/** @typedef {{airfield?:string,landscape?:'arid',origin:number[],bounds:number[],features:GeoFeature[],places:{id:number,name:string,kind:string,point:number[]}[],timestamp:string}} GeoData */
/** @typedef {{size:number,values:number[]}} ElevationData */
/** @typedef {ReturnType<typeof createGeography>} Geography */
/** @type {Geography|null} */
let active = null;
export const getGeography = () => active;
/** @param {Geography|null} world */
export function setGeography(world) {
    active = world;
}
/** @param {number} x @param {number} z */
export function groundLevel(x, z) {
    return (active?.height(x, z) ?? 0) + 0.5;
}
/** @param {number} x @param {number} z @param {number[][]} ring */
export function inRing(x, z, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const a = ring[i],
            b = ring[j];
        if (
            a[1] > z !== b[1] > z &&
            x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
        )
            inside = !inside;
    }
    return inside;
}
/** @param {number} x @param {number} z @param {GeoFeature} f */
export function inFeature(x, z, f) {
    return inRing(x, z, f.points) && !f.holes.some((h) => inRing(x, z, h));
}
/** @param {number} x @param {number} z @param {number[]} a @param {number[]} b */
export function segmentDistance(x, z, a, b) {
    const dx = b[0] - a[0],
        dz = b[1] - a[1],
        l = dx * dx + dz * dz;
    const t = l
        ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l))
        : 0;
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
/** @param {GeoData} data @param {ElevationData} dem
 * @param {{icao:string,runwayRef:string}} [departure] */
export function createGeography(data, dem, departure) {
    if (departure) data = joinAirportRunways(data, departure.icao);
    const [south, west, north, east] = data.bounds;
    const mx = 111320 * Math.cos((data.origin[0] * Math.PI) / 180);
    const minX = (west - data.origin[1]) * mx,
        maxX = (east - data.origin[1]) * mx;
    const minZ = (data.origin[0] - north) * 111320,
        maxZ = (data.origin[0] - south) * 111320;
    const width = maxX - minX,
        depth = maxZ - minZ;
    /** @param {number} x @param {number} z */
    const sample = (x, z) => {
        const u = Math.max(
            0,
            Math.min(dem.size - 1.001, ((x - minX) / width) * (dem.size - 1))
        );
        const v = Math.max(
            0,
            Math.min(dem.size - 1.001, ((z - minZ) / depth) * (dem.size - 1))
        );
        const i = Math.floor(u),
            j = Math.floor(v),
            a = u - i,
            b = v - j,
            k = j * dem.size + i;
        return (
            (dem.values[k] * (1 - a) + dem.values[k + 1] * a) * (1 - b) +
            (dem.values[k + dem.size] * (1 - a) +
                dem.values[k + dem.size + 1] * a) *
                b
        );
    };
    const runways = data.features.filter((f) => f.kind === 'runway' && f.line);
    if (!runways.length) throw new Error('World data has no mapped runway');
    const airport = departure
        ? data.features.find(
              (f) => f.icao === departure.icao && f.kind === 'airfield'
          )
        : undefined;
    const candidates = departure
        ? runways.filter(
              (f) =>
                  f.ref === departure.runwayRef &&
                  airport &&
                  f.points.some((p) => inFeature(p[0], p[1], airport))
          )
        : runways;
    if (!candidates.length)
        throw new Error(`Missing departure runway: ${departure?.runwayRef}`);
    const runway = candidates.reduce((a, b) => {
        const length = (/** @type {GeoFeature} */ f) =>
            Math.hypot(
                f.points[f.points.length - 1][0] - f.points[0][0],
                f.points[f.points.length - 1][1] - f.points[0][1]
            );
        return length(a) > length(b) ? a : b;
    });
    const ends = [
        runway.points[0],
        runway.points[runway.points.length - 1]
    ].sort((a, b) => a[0] - b[0]);
    const a = ends[0],
        b = ends[1],
        length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const baseElevation = sample((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    // Other Tehran-region airports retain their own elevation instead of being
    // pulled to Mehrabad's altitude. French worlds retain their existing profile.
    const runwayLevels = new Map(
        runways.map((r) => {
            const p = r.points[0],
                q = r.points[r.points.length - 1];
            return [
                r,
                !departure ||
                (airport &&
                    r.points.some((p) => inFeature(p[0], p[1], airport)))
                    ? 0
                    : sample((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) -
                      baseElevation
            ];
        })
    );
    const spawn = {
        x: a[0] + ((b[0] - a[0]) * 60) / length,
        z: a[1] + ((b[1] - a[1]) * 60) / length,
        y: 0.5,
        yaw: Math.atan2(-(b[1] - a[1]), b[0] - a[0])
    };
    /** @type {Map<string,GeoFeature[]>} */
    const cells = new Map();
    const landmarks = tehranLandmarks(data);
    const replacedLandmarks = new Set(landmarks.map((l) => l.source));
    for (const f of data.features.filter(
        (f) =>
            ['building', 'water', 'waterway'].includes(f.kind) &&
            !replacedLandmarks.has(f.id) &&
            isSurfaceFeature(f)
    )) {
        const xs = f.points.map((p) => p[0]),
            zs = f.points.map((p) => p[1]);
        for (
            let ix = Math.floor((Math.min(...xs) - (f.width || 0)) / 250);
            ix <= Math.floor((Math.max(...xs) + (f.width || 0)) / 250);
            ix++
        )
            for (
                let iz = Math.floor((Math.min(...zs) - (f.width || 0)) / 250);
                iz <= Math.floor((Math.max(...zs) + (f.width || 0)) / 250);
                iz++
            ) {
                const key = `${ix},${iz}`;
                const list = cells.get(key) || [];
                list.push(f);
                cells.set(key, list);
            }
    }
    const waterLevels = new Map(
        data.features
            .filter(
                (f) =>
                    f.kind === 'water' &&
                    isSurfaceFeature(f) &&
                    !isFlowingWater(f)
            )
            .map((f) => {
                const samples = f.points
                    .map((p) => sample(p[0], p[1]) - baseElevation)
                    .sort((a, b) => a - b);
                return [f, samples[Math.floor(samples.length / 2)]];
            })
    );
    // A runway must flatten every terrain-grid vertex whose triangle can touch
    // its paved footprint, not just the exact collision centerline. Otherwise
    // the coarse rendered mesh bridges over the flat physics surface.
    const runwayShoulder = departure
        ? Math.hypot(width / 256, depth / 256) + 2
        : 20;
    /** @param {number} x @param {number} z */
    const height = (x, z) => {
        let h = sample(x, z) - baseElevation;
        const beyond = Math.max(minX - x, x - maxX, minZ - z, z - maxZ, 0);
        if (beyond > 0) {
            const blend = Math.min(1, beyond / 3000);
            return h + (-35 - h) * blend * blend * (3 - 2 * blend);
        }
        let nearest = { distance: Infinity, level: 0, blend: 1 };
        for (const r of runways) {
            const d = segmentDistance(
                x,
                z,
                r.points[0],
                r.points[r.points.length - 1]
            );
            const blend = Math.max(
                0,
                Math.min(
                    1,
                    (d - (r.width || 50) / 2 - runwayShoulder) /
                        (departure ? 200 : 100)
                )
            );
            const level = runwayLevels.get(r) ?? 0;
            if (departure) {
                const distance = d - (r.width || 50) / 2;
                if (distance < nearest.distance)
                    nearest = { distance, level, blend };
                continue;
            }
            h = level + (h - level) * blend * blend * (3 - 2 * blend);
        }
        if (departure)
            h =
                nearest.level +
                (h - nearest.level) *
                    nearest.blend ** 2 *
                    (3 - 2 * nearest.blend);
        for (const f of cells.get(
            `${Math.floor(x / 250)},${Math.floor(z / 250)}`
        ) || []) {
            if (waterLevels.has(f) && inFeature(x, z, f))
                return waterLevels.get(f) ?? h;
        }
        return h;
    };
    spawn.y = height(spawn.x, spawn.z) + 0.5;
    /** @param {number} x @param {number} z */
    const onRunway = (x, z) =>
        runways.some(
            (r) =>
                segmentDistance(
                    x,
                    z,
                    r.points[0],
                    r.points[r.points.length - 1]
                ) <=
                (r.width || 50) / 2
        );
    /** @param {number} x @param {number} z @param {number} y */
    const obstacle = (x, z, y) => {
        for (const l of landmarks) {
            if (
                l.id === 'tabiat' &&
                Math.abs(x - l.x) < 300 &&
                Math.abs(z - l.z) < 77
            ) {
                const ground = height(x, z);
                const bank = tabiatApproachHeight(
                    x - l.x,
                    z - l.z,
                    height(l.x, l.z) + 0.1,
                    ground
                );
                if (bank > ground + 0.2 && y <= bank + 0.12) return 'building';
            }
            if (
                Math.abs(x - l.x) < 160 &&
                Math.abs(z - l.z) < 160 &&
                landmarkContains(l.id, x - l.x, y - height(l.x, l.z), z - l.z)
            )
                return 'building';
        }
        if (x < minX || x > maxX || z < minZ || z > maxZ) return '';
        for (const f of cells.get(
            `${Math.floor(x / 250)},${Math.floor(z / 250)}`
        ) || []) {
            if (f.kind === 'waterway') {
                if (
                    f.line &&
                    distanceToLine(x, z, f.points) <=
                        ((f.width || 2) *
                            (f.intermittent === 'yes' ? 0.6 : 1)) /
                            2 &&
                    y <= height(x, z) + 0.7 &&
                    (!f.bridge || f.bridge === 'no')
                )
                    return 'water';
                continue;
            }
            if (!inFeature(x, z, f)) continue;
            if (f.kind === 'water' && y <= height(x, z) + 0.7) return 'water';
            if (f.kind === 'building') {
                const p = f.points[0];
                if (y < height(p[0], p[1]) + (f.height || 8) + 1)
                    return 'building';
            }
        }
        return '';
    };
    return {
        data,
        dem,
        width,
        depth,
        minX,
        maxX,
        minZ,
        maxZ,
        baseElevation,
        spawn,
        runways,
        runway,
        height,
        onRunway,
        obstacle,
        sample
    };
}
