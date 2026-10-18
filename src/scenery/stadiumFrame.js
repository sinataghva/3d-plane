// Bearing estimated from the cached western approach and supplied satellite view.
// Positive Three.js yaw turns the north end west in a north-up plan.
export const STADIUM_YAW = Math.atan2(18.9, 64.9);
const c = Math.cos(STADIUM_YAW),
    s = Math.sin(STADIUM_YAW);
/** @param {number} x @param {number} z */
export const stadiumToLocal = (x, z) => [c * x - s * z, s * x + c * z];
/** @param {number} x @param {number} z */
export const stadiumToWorld = (x, z) => [c * x + s * z, -s * x + c * z];
