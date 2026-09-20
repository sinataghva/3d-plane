import { jetDrag } from './jetAerodynamics.js';
import { updateJetAttitude } from './jetAttitude.js';
import { groundLevel, getGeography } from '../scenery/geography.js';
const clamp = (
    /** @type {number} */ n,
    /** @type {number} */ a,
    /** @type {number} */ b
) => Math.max(a, Math.min(b, n));
/** Arcade jet in world meters and seconds; state speed remains meters per 60 Hz tick. */
export function jetSettings() {
    return { stallSpeed: 0.92, minTakeoffSpeed: 1.18 };
}
/** @param {import('./physics.js').PlaneState} s */
export function clearAfterburner(s) {
    s.thrust = Math.min(1, s.thrust);
    s.afterburner = false;
}
/** @param {import('./physics.js').PlaneState} s @param {import('./input.js').KeyboardState} k @param {number} dt */
export function updateJetPhysics(s, k, dt) {
    if (s.isCrashed) {
        clearAfterburner(s);
        return;
    }
    if (k.w) s.thrust = Math.min(1, s.thrust + dt * 0.7);
    if (k.s) s.thrust = Math.max(0, s.thrust - dt * 0.7);
    s.afterburner = Boolean((k.w || k.boost) && !k.s && s.thrust >= 1);
    s.thrust = s.afterburner ? 1.1 : Math.min(1, s.thrust);
    s.enginePower =
        (s.enginePower ?? 0) +
        (Math.min(s.thrust, 1) - (s.enginePower ?? 0)) *
            (1 - Math.exp(-dt / 1.5));
    if (k.brake !== undefined || k.s)
        s.airbrake = Boolean(k.brake || (k.s && s.thrust <= 0));
    const brakeTarget = s.airbrake ? 1 : 0;
    s.airbrakeExtension =
        (s.airbrakeExtension ?? 0) +
        Math.sign(brakeTarget - (s.airbrakeExtension ?? 0)) *
            Math.min(
                Math.abs(brakeTarget - (s.airbrakeExtension ?? 0)),
                dt / 0.35
            );
    const speed = s.speed * 60;
    const pitch = clamp(
        (k.arrowDown ? 1 : 0) - (k.arrowUp ? 1 : 0) + k.stickPitch,
        -1,
        1
    );
    const roll = clamp(
        (k.arrowRight ? 1 : 0) - (k.arrowLeft ? 1 : 0) + k.stickRoll,
        -1,
        1
    );
    const rudder = (k.a ? 1 : 0) - (k.d ? 1 : 0) - (k.stickRudder || 0);
    const direction = updateJetAttitude(s, { pitch, roll, rudder }, dt);
    const targetGear = s.gearDown ? 1 : 0;
    const extension = s.gearExtension ?? targetGear;
    s.gearExtension =
        extension +
        Math.sign(targetGear - extension) *
            Math.min(Math.abs(targetGear - extension), dt / 1.6);
    const gear = s.gearExtension;
    const braking = s.airbrake
        ? s.isAirborne
            ? 0.0006 * speed * speed
            : 13
        : 0;
    const drag = jetDrag(speed, {
        gear,
        gForce: s.gForce ?? 1,
        rudder,
        airborne: s.isAirborne
    });
    const acceleration =
        10 * s.enginePower +
        (s.afterburner ? 7 : 0) -
        drag -
        braking -
        (s.isAirborne ? 9.81 * direction.y : 0);
    s.speed = Math.max(0, speed + acceleration * dt) / 60;
    if (!s.isAirborne && s.speed >= 1.18 && pitch > 0 && s.pitchAngle > 0.055)
        s.isAirborne = true;
    s.isStalling = s.isAirborne && s.speed < 0.92;
    s.verticalSpeed = s.isAirborne
        ? direction.y * s.speed - (s.isStalling ? 14 / 60 : 0)
        : 0;
    const old = { ...s.position };
    s.position.x += direction.x * s.speed * 60 * dt;
    s.position.z += direction.z * s.speed * 60 * dt;
    s.position.y += s.verticalSpeed * 60 * dt;
    const ground = groundLevel(s.position.x, s.position.z);
    if (s.position.y <= ground || !s.isAirborne) {
        if (
            s.isAirborne &&
            (s.gearExtension < 0.98 ||
                s.verticalSpeed * 60 < -5 ||
                Math.abs(s.rollAngle) > 0.2 ||
                s.pitchAngle < -0.12 ||
                s.speed > 1.9)
        ) {
            s.isCrashed = true;
            s.crashReason = s.gearExtension < 0.98 ? 'gear' : 'jet-touchdown';
        }
        s.position.y = ground;
        s.isAirborne = false;
        s.verticalSpeed = 0;
        s.isStalling = false;
    }
    // Sweep at <=1 m spacing, including intermediate terrain: fast jets cannot skip narrow obstacles.
    const steps = Math.ceil(
        Math.hypot(
            s.position.x - old.x,
            s.position.y - old.y,
            s.position.z - old.z
        )
    );
    for (let i = 1; i <= steps && !s.isCrashed; i++) {
        const t = i / steps,
            x = old.x + (s.position.x - old.x) * t,
            y = old.y + (s.position.y - old.y) * t,
            z = old.z + (s.position.z - old.z) * t;
        const obstacle = getGeography()?.obstacle(x, z, y);
        if (obstacle || (s.isAirborne && y < groundLevel(x, z) - 0.2)) {
            s.isCrashed = true;
            s.crashReason = obstacle || 'terrain';
            s.position = { x, y, z };
        }
    }
    if (s.isCrashed) {
        s.speed = 0;
        s.thrust = 0;
        s.isAirborne = false;
        clearAfterburner(s);
    }
}
