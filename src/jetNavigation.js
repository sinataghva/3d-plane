/** Optional departure and navigation circuit in the runway's local frame. */
export function jetWaypoints(
    /** @type {import('./geography.js').Geography} */ world
) {
    const f = [Math.cos(world.spawn.yaw), -Math.sin(world.spawn.yaw)];
    const r = [-f[1], f[0]];
    return [
        [4500, 0],
        [4500, 4500],
        [-3500, 4500],
        [-3500, 0]
    ].map(([along, across], i) => ({
        name: ['Departure', 'Crosswind', 'Downwind', 'Final approach'][i],
        x: world.spawn.x + f[0] * along + r[0] * across,
        z: world.spawn.z + f[1] * along + r[1] * across
    }));
}
