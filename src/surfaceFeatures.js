/** @param {import('./geography.js').GeoFeature} feature */
export function isSurfaceFeature(feature) {
    return !(
        (feature.tunnel && feature.tunnel !== 'no') ||
        (feature.covered && feature.covered !== 'no') ||
        (feature.kind === 'rail' &&
            feature.railwayType &&
            feature.railwayType !== 'rail') ||
        (feature.kind === 'waterway' && feature.waterwayType === 'weir')
    );
}
/** @param {import('./geography.js').GeoFeature} f */
export function isFlowingWater(f) {
    return (
        f.kind === 'waterway' ||
        f.waterType === 'river' ||
        f.waterType === 'stream'
    );
}
/** @param {number} x @param {number} z @param {number[][]} points */
export function distanceToLine(x, z, points) {
    let distance = Infinity;
    for (let i = 1; i < points.length; i++) {
        const [ax, az] = points[i - 1],
            [bx, bz] = points[i];
        const dx = bx - ax,
            dz = bz - az;
        const t = Math.max(
            0,
            Math.min(
                1,
                ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)
            )
        );
        distance = Math.min(
            distance,
            Math.hypot(x - ax - t * dx, z - az - t * dz)
        );
    }
    return distance;
}

/** Approximate a mapped bridge deck from its terrain endpoints, not OSM layer numbers.
 * @param {import('./geography.js').GeoFeature} f @param {(x:number,z:number)=>number} height
 * @returns {number[] | undefined} */
export function bridgeProfile(f, height) {
    if (!f.bridge || f.bridge === 'no' || f.points.length < 2) return undefined;
    const a = f.points[0],
        b = f.points[f.points.length - 1];
    return [a[0], a[1], b[0], b[1], height(a[0], a[1]), height(b[0], b[1])];
}
/** @param {number[] | undefined} profile @param {number} x @param {number} z @param {number} terrain */
export function surfaceElevation(profile, x, z, terrain) {
    if (!profile) return terrain;
    const [ax, az, bx, bz, ay, by] = profile;
    const t = Math.max(
        0,
        Math.min(
            1,
            ((x - ax) * (bx - ax) + (z - az) * (bz - az)) /
                ((bx - ax) ** 2 + (bz - az) ** 2 || 1)
        )
    );
    return Math.max(terrain, ay + (by - ay) * t);
}
