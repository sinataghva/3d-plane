import * as THREE from 'three';
const q = new THREE.Quaternion();
const step = new THREE.Quaternion();
const angular = new THREE.Vector3();
const forward = new THREE.Vector3();
const up = new THREE.Vector3();
const right = new THREE.Vector3();
const levelRight = new THREE.Vector3();
const levelUp = new THREE.Vector3();
const initial = new THREE.Euler(0, 0, 0, 'YZX');
const clamp = THREE.MathUtils.clamp;
/** @param {number} a */
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * Lift acts along the aircraft's own up axis. Elevator therefore turns a banked
 * aircraft, rather than just changing its world elevation. Gravity supplies the
 * complementary curvature. Quaternions allow uninterrupted rolls and loops.
 * @param {import('./physics.js').PlaneState} s
 * @param {{pitch:number,roll:number,rudder:number}} input
 * @param {number} dt
 */
export function updateJetAttitude(s, { pitch, roll, rudder }, dt) {
    if (s.attitude)
        q.set(s.attitude.x, s.attitude.y, s.attitude.z, s.attitude.w);
    else
        q.setFromEuler(
            initial.set(s.rollAngle, s.yawAngle, s.pitchAngle, 'YZX')
        );
    const speed = s.speed * 60;
    const authority = clamp(speed / 80, 0, 1);
    if (!s.isAirborne) {
        s.rollAngle = 0;
        s.pitchAngle = clamp(
            s.pitchAngle + pitch * 0.42 * authority * dt,
            -0.08,
            0.23
        );
        if (!pitch) s.pitchAngle *= Math.exp(-2 * dt);
        s.yawAngle += rudder * 0.32 * authority * dt;
        q.setFromEuler(initial.set(0, s.yawAngle, s.pitchAngle, 'YZX'));
        s.gForce = 1;
        s.elevatorManeuver = false;
    } else {
        forward.set(1, 0, 0).applyQuaternion(q);
        up.set(0, 1, 0).applyQuaternion(q);
        right.set(0, 0, 1).applyQuaternion(q);
        const horizontal = Math.hypot(forward.x, forward.z);
        // Preserve bank while elevator is held, including ordinary level turns.
        s.elevatorManeuver = Math.abs(pitch) >= 0.05;
        const leveling = s.elevatorManeuver
            ? 0
            : clamp(horizontal / 0.25, 0, 1);
        const rollRate = roll
            ? roll * 3 * authority
            : clamp(-wrap(s.rollAngle) * 2.5, -2.4, 2.4) * leveling;
        const liftAuthority = clamp((speed - 45) / 95, 0, 1);
        const normalG = clamp(
            (horizontal + pitch * (pitch >= 0 ? 8 : 4) * liftAuthority) *
                Math.min(1, (speed / 55) ** 2),
            -3,
            9
        );
        const pitchRate = ((normalG - up.y) * 9.81) / Math.max(55, speed);
        const rudderRate =
            rudder * 0.18 * authority * Math.min(1, 180 / Math.max(1, speed));
        const yawRate = (right.y * 9.81) / Math.max(55, speed) + rudderRate;
        angular.set(rollRate, yawRate, pitchRate);
        const rate = angular.length();
        if (rate > 0)
            q.multiply(
                step.setFromAxisAngle(
                    angular.multiplyScalar(1 / rate),
                    rate * dt
                )
            ).normalize();
        s.gForce = normalG;
    }
    forward.set(1, 0, 0).applyQuaternion(q);
    up.set(0, 1, 0).applyQuaternion(q);
    const horizontal = Math.hypot(forward.x, forward.z);
    // Heading is undefined at the poles; retain the last useful map bearing.
    if (horizontal > 0.03)
        s.yawAngle += wrap(Math.atan2(-forward.z, forward.x) - s.yawAngle);
    s.pitchAngle = Math.asin(clamp(forward.y, -1, 1));
    levelRight.set(Math.sin(s.yawAngle), 0, Math.cos(s.yawAngle));
    levelUp.crossVectors(levelRight, forward).normalize();
    if (horizontal > 0.03)
        s.rollAngle = Math.atan2(up.dot(levelRight), up.dot(levelUp));
    s.attitude = { x: q.x, y: q.y, z: q.z, w: q.w };
    // Detached vectors prevent one simulated aircraft from modifying another.
    return { x: forward.x, y: forward.y, z: forward.z };
}
