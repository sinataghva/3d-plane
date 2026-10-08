import * as THREE from 'three';

export const DISPLAY_DURATION = 240;
export const DISPLAY_PHASES = [
    { time: 0, label: 'Formation arrival' },
    { time: 40, label: 'Coordinated turn' },
    { time: 66, label: 'Solo looping break' },
    { time: 74, label: 'Opposed rolls / solo loops' },
    { time: 90, label: 'Solo outward pull-out' },
    { time: 102, label: 'Inverted paired pass' },
    { time: 130, label: 'Rejoin' },
    { time: 151, label: 'Gear-down presentation' },
    { time: 177, label: 'Departure and return' }
];
// Metres in a runway-relative display frame; time in seconds. The closing
// Hermite segment shares its tangent with the opening: no reset/teleport.
const knots = [
    [0, -2800, 380, 0],
    [24, 0, 380, 0],
    [40, 1800, 400, 0],
    [58, 2300, 500, -1600],
    [76, 0, 600, -2300],
    [96, -2400, 420, -1600],
    [112, -1800, 340, 0],
    [138, 300, 340, 0],
    [160, 2200, 380, 0],
    [178, 3000, 650, 1800],
    [210, -3000, 650, 1800]
];
export const DISPLAY_SLOTS = [
    [0, 0, 0],
    [-26, 0, -24],
    [-26, 0, 24],
    [-52, 0, 0],
    [-52, 0, -48],
    [-52, 0, 48]
];
/** @param {number} t */
export const wrapTime = (t) =>
    ((t % DISPLAY_DURATION) + DISPLAY_DURATION) % DISPLAY_DURATION;
/** @param {number} t @param {number} a @param {number} b */
function ramp(t, a, b) {
    const u = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
    return u * u * u * (10 + u * (-15 + 6 * u));
}
/** @param {number} i */
function velocity(i) {
    const n = knots.length;
    const prev = knots[(i + n - 1) % n],
        next = knots[(i + 1) % n];
    const dt = next[0] - prev[0] + (next[0] <= prev[0] ? DISPLAY_DURATION : 0);
    return new THREE.Vector3(
        next[1] - prev[1],
        next[2] - prev[2],
        next[3] - prev[3]
    ).divideScalar(dt);
}
/** @param {number} time */
export function displayCenter(time) {
    const t = wrapTime(time);
    const i = knots.reduce((last, k, index) => (k[0] <= t ? index : last), 0);
    const a = knots[i],
        b = knots[(i + 1) % knots.length];
    const dt = (b[0] || DISPLAY_DURATION) - a[0],
        u = (t - a[0]) / dt;
    const p = new THREE.Vector3(a[1], a[2], a[3]).multiplyScalar(
        2 * u ** 3 - 3 * u ** 2 + 1
    );
    p.addScaledVector(velocity(i), (u ** 3 - 2 * u ** 2 + u) * dt);
    p.addScaledVector(
        new THREE.Vector3(b[1], b[2], b[3]),
        -2 * u ** 3 + 3 * u ** 2
    );
    return p.addScaledVector(
        velocity((i + 1) % knots.length),
        (u ** 3 - u ** 2) * dt
    );
}
/** @param {number} t */
function coreCenter(t) {
    const split = ramp(t, 66, 86) * (1 - ramp(t, 130, 151));
    const center = displayCenter(t - 7 * split);
    center.y += 250 * split;
    const start = displayCenter(72 - 7 * ramp(72, 66, 86));
    const end = displayCenter(85);
    const line = start.lerp(end, (t - 72) / 20).setY(850);
    return center.lerp(line, ramp(t, 66, 74) * (1 - ramp(t, 88, 102)));
}
/** @param {number} time @param {number} aircraft */
export function displayPosition(time, aircraft) {
    const t = wrapTime(time);
    const split = ramp(t, 66, 86) * (1 - ramp(t, 130, 151));
    const path = aircraft < 4 ? coreCenter : displayCenter;
    const center = path(t);
    const forward = path(t + 0.05).sub(path(t - 0.05)).normalize();
    const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const slot = DISPLAY_SLOTS[aircraft];
    center.addScaledVector(forward, slot[0]).addScaledVector(lateral, slot[2]);
    if (aircraft >= 4) {
        const side = aircraft === 4 ? -1 : 1;
        // Solos split symmetrically, then settle into two parallel presentation
        // lanes. They remain separated even while one aircraft is inverted.
        const fan = ramp(t, 62, 88) * (1 - ramp(t, 96, 110));
        const loop = ramp(t, 66, 98);
        const angle = loop * Math.PI * 2;
        // Fixed axes keep the two smoke hooks mirrored as the main circuit turns.
        const heading = displayCenter(66.1).sub(displayCenter(65.9)).setY(0).normalize();
        const outward = new THREE.Vector3(-heading.z, 0, heading.x);
        center.addScaledVector(outward, side * 600 * fan);
        center.addScaledVector(heading, 470 * Math.sin(angle));
        center.y += 420 * (1 - Math.cos(angle)) + (aircraft === 4 ? 36 : 0) * split;
    }
    return center;
}
/** Pure deterministic sample, also used to rebuild smoke when scrubbing.
 * @param {number} time @param {number} aircraft */
export function sampleDisplay(time, aircraft) {
    const t = wrapTime(time),
        position = displayPosition(t, aircraft);
    const before = displayPosition(t - 0.1, aircraft),
        after = displayPosition(t + 0.1, aircraft);
    const velocity = after.clone().sub(before).divideScalar(0.2);
    const forward = velocity.clone().normalize();
    const lateral = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const up = lateral.clone().cross(forward).normalize();
    const acceleration = displayPosition(t + 2, aircraft)
        .add(displayPosition(t - 2, aircraft))
        .addScaledVector(position, -2)
        .divideScalar(4);
    // With +X forward, positive roll tilts local +Y toward +Z (lateral).
    // Lift must lean toward the turn acceleration, not away from it.
    const bank = THREE.MathUtils.clamp(
        Math.atan2(acceleration.dot(lateral), 9.81),
        -0.95,
        0.95
    );
    const coreRoll = (aircraft === 1 ? -1 : aircraft === 2 ? 1 : 0)
        * Math.PI * 2 * ramp(t, 74, 86);
    const roll = coreRoll + (
        aircraft === 4
            ? Math.PI * ramp(t, 98, 104) * (1 - ramp(t, 119, 126))
            : 0);
    const quaternion = new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(forward, up, lateral)
    );
    quaternion.multiply(
        new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(1, 0, 0),
            bank + roll
        )
    );
    const gear = ramp(t, 145, 151) * (1 - ramp(t, 173, 179));
    return {
        position,
        quaternion,
        speed: velocity.length(),
        gear,
        smoke: t < 177 || t > 234,
        phase: DISPLAY_PHASES.reduce(
            (last, p) => (t >= p.time ? p : last),
            DISPLAY_PHASES[0]
        ).label
    };
}
