import * as THREE from 'three';
import { createPlaneState } from '../flight/physics.js';
import { updateJetAttitude } from '../flight/jetAttitude.js';
import { DISPLAY_SLOTS, sampleDisplay, wrapTime } from './goldenCrownFlight.js';

const X = new THREE.Vector3(1, 0, 0);
const clamp = THREE.MathUtils.clamp;
const smooth = (/** @type {number} */ t) => {
    const u = clamp(t, 0, 1);
    return u ** 3 * (10 + u * (-15 + 6 * u));
};
/** @param {number} time @param {number} i */
function sampled(time, i) {
    const s = sampleDisplay(time, i);
    return {
        ...s,
        velocity: sampleDisplay(time + 0.01, i)
            .position.sub(sampleDisplay(time - 0.01, i).position)
            .divideScalar(0.02)
    };
}
/** @param {THREE.Vector3} v @param {THREE.Quaternion} previous */
function attitude(v, previous) {
    const forward = v.clone().normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    if (right.lengthSq() < 0.001) return previous.clone();
    right.normalize();
    return new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(
            forward,
            right.clone().cross(forward),
            right
        )
    );
}
/** Persistent six-aircraft simulation in the display's local frame.
 * @param {{height:(p:THREE.Vector3)=>number, obstacle?:(p:THREE.Vector3)=>boolean}} environment local ground height */
export function createGoldenCrownPilot(environment) {
    let mode = 'script';
    let time = 8;
    let elapsed = 0;
    let soloStart = -1;
    let inherited = false;
    let inheritedTime = 0;
    let rolls = 0;
    let rollElapsed = 0;
    let completedRolls = 0;
    let rollHeight = 0;
    let rollVerticalSpeed = 0;
    let settled = 0;
    let blend = -1;
    let approach = false;
    let feedback = '';
    const states = Array.from({ length: 6 }, (_, i) => sampled(time, i));
    const soloOrigins = [new THREE.Vector3(), new THREE.Vector3()];
    let soloRotation = new THREE.Quaternion();
    let inheritedRollEnd = 0;
    const starts = states.map((s) => ({
        position: s.position.clone(),
        velocity: s.velocity.clone(),
        quaternion: s.quaternion.clone()
    }));
    const flight = createPlaneState('golden-crown');
    const returnTarget = sampleDisplay(12, 0).position;
    const returnVelocity = sampled(12, 0).velocity;
    let speedTarget = 120;

    function syncFlight() {
        const lead = states[0];
        flight.position = {
            x: lead.position.x,
            y: lead.position.y,
            z: lead.position.z
        };
        flight.speed = lead.velocity.length() / 60;
        flight.attitude = {
            x: lead.quaternion.x,
            y: lead.quaternion.y,
            z: lead.quaternion.z,
            w: lead.quaternion.w
        };
        const e = new THREE.Euler().setFromQuaternion(lead.quaternion, 'YZX');
        flight.rollAngle = e.x;
        flight.yawAngle = e.y;
        flight.pitchAngle = e.z;
        flight.verticalSpeed = lead.velocity.y / 60;
        flight.gearExtension = lead.gear;
        flight.gearDown = lead.gear > 0.5;
        flight.isAirborne = true;
    }
    /** @param {number} t */
    function script(t) {
        time = wrapTime(t);
        states.forEach((s, i) => Object.assign(s, sampled(time, i)));
    }
    function takeControl() {
        if (mode === 'player') return;
        if (mode === 'script') {
            inherited = time >= 62 && time < 145;
            inheritedTime = time;
            inheritedRollEnd = time >= 74 && time < 86 ? 86 - time : 0;
            soloStart = inherited ? elapsed : -1;
            rolls = 0;
            rollElapsed = 0;
            rollHeight = rollVerticalSpeed = 0;
        }
        blend = -1;
        mode = 'player';
        settled = 0;
        feedback = '';
        syncFlight();
        speedTarget = states[0].velocity.length();
        flight.isCrashed = false;
        flight.thrust = 0.55;
    }
    function release() {
        if (mode !== 'player') return;
        mode = 'return';
        approach = false;
        // Finish an active rotation, but do not execute commands not yet started.
        rolls = rollElapsed > 0 ? 1 : 0;
        blend = -1;
        feedback = '';
        settled = 0;
    }
    function solosOut() {
        return (
            soloStart >= 0 &&
            (inherited
                ? inheritedTime + elapsed - soloStart < 130
                : elapsed - soloStart < 34)
        );
    }
    function formationError() {
        return Math.max(
            ...states.slice(1).map((s, j) => s.position.distanceTo(slot(j + 1)))
        );
    }
    /** @param {number} i */
    function slot(i) {
        const lead = states[0];
        // Keep slots upright through an axial roll; a whole formation must not
        // rotate rigidly around the leader's fuselage.
        const basis = attitude(lead.velocity, lead.quaternion);
        return new THREE.Vector3(...DISPLAY_SLOTS[i])
            .applyQuaternion(basis)
            .add(lead.position);
    }
    function entryProblem() {
        if (flight.isCrashed) return 'F-5 down — return to F-4';
        if (states[0].position.y - environment.height(states[0].position) < 260)
            return 'Gain altitude';
        if (
            Math.abs(flight.rollAngle) > 0.5 ||
            Math.abs(flight.pitchAngle) > 0.3
        )
            return 'Hold level';
        if (speedTarget < 80 || speedTarget > 170) return 'Hold 288–612 km/h';
        return '';
    }
    function label() {
        if (mode === 'return') return 'Returning to show';
        if (mode !== 'player') return 'Fly Golden Crown';
        if (flight.isCrashed) return 'F-5 down — return to F-4';
        if (solosOut()) {
            if (elapsed - soloStart < 2 && !inherited) return 'Solos detaching';
            if (inheritedRollEnd > 0)
                return 'Rolling — completing current maneuver';
            if (entryProblem()) return entryProblem();
            if (rolls) return `Queue another roll (${rolls} remaining)`;
            return entryProblem() || 'Opposed rolls';
        }
        if (soloStart >= 0)
            return speedTarget > 180
                ? 'Solos rejoining — slow down and hold heading'
                : 'Solos rejoining — hold speed and heading';
        return (
            entryProblem() ||
            (settled < 1
                ? 'Regrouping — hold speed and heading'
                : 'Release solos')
        );
    }
    function command() {
        if (mode !== 'player' || entryProblem()) {
            feedback = entryProblem() || label();
            return false;
        }
        if (solosOut()) {
            if (
                (!inherited && elapsed - soloStart < 2) ||
                inheritedRollEnd > 0
            ) {
                feedback = label();
                return false;
            }
            rolls++;
            return true;
        }
        if (soloStart >= 0 || settled < 1) {
            feedback = label();
            return false;
        }
        inherited = false;
        soloStart = elapsed;
        soloRotation = attitude(
            states[0].velocity,
            states[0].quaternion
        ).multiply(
            attitude(sampled(66, 0).velocity, new THREE.Quaternion()).invert()
        );
        for (let j = 0; j < 2; j++) soloOrigins[j].copy(states[j + 4].position);
        return true;
    }
    /** Bounded velocity pursuit with short-range separation; never set position to a slot.
     * @param {number} i @param {THREE.Vector3} target @param {THREE.Vector3} velocity @param {number} dt */
    function follow(i, target, velocity, dt) {
        const s = states[i];
        const desired = target
            .clone()
            .sub(s.position)
            .multiplyScalar(0.65)
            .add(velocity);
        const floor = environment.height(s.position) + 90;
        if (s.position.y < floor) desired.y += (floor - s.position.y) * 1.5;
        states.forEach((other, j) => {
            if (j === i) return;
            const away = s.position.clone().sub(other.position);
            const distance = away.length();
            if (distance < 22 && distance > 0.01)
                desired.addScaledVector(away, ((22 - distance) * 8) / distance);
        });
        desired.clampLength(0, 220);
        const acceleration = desired
            .sub(s.velocity)
            .multiplyScalar(2)
            .clampLength(0, 32);
        s.velocity.addScaledVector(acceleration, dt);
        s.position.addScaledVector(s.velocity, dt);
        const q = attitude(s.velocity, s.quaternion);
        const right = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        q.multiply(
            new THREE.Quaternion().setFromAxisAngle(
                X,
                clamp(Math.atan2(acceleration.dot(right), 9.81), -0.9, 0.9)
            )
        );
        s.quaternion.rotateTowards(q, dt * 1.3);
        s.gear = Math.max(0, s.gear - dt / 1.6);
    }
    /** @param {number} dt @param {import('../flight/input.js').KeyboardState} k */
    function update(dt, k) {
        elapsed += dt;
        if (mode === 'script') {
            script(time + dt);
            return;
        }
        const lead = states[0];
        if (mode === 'player' && !flight.isCrashed) {
            // Display-speed envelope tuned for this aerobatic F-5: throttle sets
            // airspeed, while the shared quaternion jet attitude supplies banked lift.
            speedTarget = clamp(
                speedTarget +
                    ((k.w || k.boost ? 1 : 0) - (k.s || k.brake ? 1 : 0)) *
                        22 *
                        dt,
                55,
                240
            );
            flight.speed +=
                (speedTarget / 60 - flight.speed) * (1 - Math.exp(-dt));
            const direction = updateJetAttitude(
                flight,
                {
                    pitch: clamp(
                        (k.arrowDown ? 1 : 0) -
                            (k.arrowUp ? 1 : 0) +
                            k.stickPitch,
                        -1,
                        1
                    ),
                    roll: clamp(
                        (k.arrowRight ? 1 : 0) -
                            (k.arrowLeft ? 1 : 0) +
                            k.stickRoll,
                        -1,
                        1
                    ),
                    rudder: (k.a ? 1 : 0) - (k.d ? 1 : 0) - (k.stickRudder || 0)
                },
                dt
            );
            const targetVelocity = new THREE.Vector3(
                direction.x,
                direction.y,
                direction.z
            ).multiplyScalar(flight.speed * 60);
            // Preserve the sampled velocity at takeover, then converge without a jump.
            lead.velocity.lerp(targetVelocity, 1 - Math.exp(-dt * 4));
            const travel = lead.velocity.length() * dt;
            const steps = Math.max(1, Math.ceil(travel / 2));
            for (let step = 0; step < steps; step++) {
                lead.position.addScaledVector(lead.velocity, dt / steps);
                if (
                    lead.position.y < environment.height(lead.position) + 3 ||
                    environment.obstacle?.(lead.position)
                ) {
                    flight.isCrashed = true;
                    lead.velocity.set(0, 0, 0);
                    rolls = 0;
                    rollElapsed = 0;
                    rollHeight = rollVerticalSpeed = 0;
                    break;
                }
            }
            if (flight.attitude) lead.quaternion.copy(flight.attitude);
            lead.gear = Math.max(0, lead.gear - dt / 1.6);
        } else if (mode === 'return') {
            if (blend < 0) {
                // Fly a staging leg behind the entry, then align with the show.
                // Constant forward flight avoids stopping at a fixed rendezvous.
                const staging = returnTarget
                    .clone()
                    .addScaledVector(returnVelocity.clone().normalize(), -2800);
                if (
                    !approach &&
                    lead.position.distanceTo(staging) < 1000 &&
                    !solosOut() &&
                    !rolls
                )
                    approach = true;
                const goal = approach ? returnTarget : staging;
                const speed = THREE.MathUtils.damp(
                    lead.velocity.length(),
                    120,
                    0.5,
                    dt
                );
                const heading = lead.velocity.clone().setY(0).normalize();
                if (heading.lengthSq() < 0.01) heading.copy(X);
                const toward = goal
                    .clone()
                    .sub(lead.position)
                    .setY(0)
                    .normalize();
                const yaw = Math.atan2(-heading.z, heading.x);
                const desiredYaw = Math.atan2(-toward.z, toward.x);
                const error = Math.atan2(
                    Math.sin(desiredYaw - yaw),
                    Math.cos(desiredYaw - yaw)
                );
                const change = clamp(error, -0.16 * dt, 0.16 * dt);
                heading.applyAxisAngle(new THREE.Vector3(0, 1, 0), change);
                lead.velocity.copy(heading).multiplyScalar(speed);
                const safeHeight = Math.max(
                    goal.y,
                    environment.height(lead.position) + 120
                );
                lead.velocity.y = clamp(
                    (safeHeight - lead.position.y) * 0.2,
                    -12,
                    12
                );
                lead.position.addScaledVector(lead.velocity, dt);
                const banked = attitude(
                    lead.velocity,
                    lead.quaternion
                ).multiply(
                    new THREE.Quaternion().setFromAxisAngle(
                        X,
                        clamp(((-change / dt) * speed) / 20, -0.85, 0.85)
                    )
                );
                lead.quaternion.rotateTowards(banked, dt);
                if (
                    approach &&
                    (lead.position.distanceTo(returnTarget) > 3800 ||
                        lead.position
                            .clone()
                            .sub(returnTarget)
                            .dot(returnVelocity.clone().normalize()) > 350)
                )
                    approach = false;
                if (
                    approach &&
                    lead.position.distanceTo(returnTarget) < 260 &&
                    heading.dot(returnVelocity.clone().normalize()) > 0.8 &&
                    !solosOut() &&
                    !rolls &&
                    formationError() < 100
                ) {
                    blend = 0;
                    states.forEach((s, i) => {
                        starts[i].position.copy(s.position);
                        starts[i].velocity.copy(s.velocity);
                        starts[i].quaternion.copy(s.quaternion);
                    });
                }
            } else {
                blend += dt;
                const u = clamp(blend / 12, 0, 1);
                states.forEach((s, i) => {
                    const target = sampled(24, i);
                    s.position
                        .copy(starts[i].position)
                        .multiplyScalar(2 * u ** 3 - 3 * u ** 2 + 1)
                        .addScaledVector(
                            starts[i].velocity,
                            (u ** 3 - 2 * u ** 2 + u) * 12
                        )
                        .addScaledVector(
                            target.position,
                            -2 * u ** 3 + 3 * u ** 2
                        )
                        .addScaledVector(
                            target.velocity,
                            (u ** 3 - u ** 2) * 12
                        );
                    s.velocity
                        .copy(starts[i].position)
                        .multiplyScalar((6 * u ** 2 - 6 * u) / 12)
                        .addScaledVector(
                            starts[i].velocity,
                            3 * u ** 2 - 4 * u + 1
                        )
                        .addScaledVector(
                            target.position,
                            (-6 * u ** 2 + 6 * u) / 12
                        )
                        .addScaledVector(target.velocity, 3 * u ** 2 - 2 * u);
                    s.quaternion
                        .copy(starts[i].quaternion)
                        .slerp(target.quaternion, smooth(u));
                    s.gear = 0;
                });
                if (blend >= 12) {
                    mode = 'script';
                    script(24);
                    soloStart = -1;
                }
                return;
            }
        }
        const out = solosOut();
        // Remove the preceding frame's authored arc before ordinary pursuit.
        // This keeps the roll's vertical motion from feeding back into slot following.
        for (const i of [1, 2]) {
            states[i].position.y -= rollHeight;
            states[i].velocity.y -= rollVerticalSpeed;
        }
        if (rolls > 0) rollElapsed += dt;
        const rollProgress = clamp(rollElapsed / 2.5, 0, 1);
        rollHeight = rolls > 0 ? 16 * Math.sin(Math.PI * rollProgress) ** 2 : 0;
        rollVerticalSpeed =
            rolls > 0
                ? ((16 * Math.PI) / 2.5) * Math.sin(2 * Math.PI * rollProgress)
                : 0;
        for (let i = 1; i < 6; i++) {
            if (i >= 4 && out) {
                const t = inherited
                    ? inheritedTime + elapsed - soloStart
                    : 66 + elapsed - soloStart;
                const target = sampled(t, i);
                if (!inherited) {
                    target.position
                        .sub(sampleDisplay(66, i).position)
                        .applyQuaternion(soloRotation)
                        .add(soloOrigins[i - 4]);
                    target.velocity.applyQuaternion(soloRotation);
                }
                follow(i, target.position, target.velocity, dt);
                if (inherited) states[i].quaternion.copy(target.quaternion);
            } else {
                const target = slot(i);
                // Outer lanes first; close only after speed/heading are matched.
                if (
                    i >= 4 &&
                    (states[i].position.distanceTo(target) > 200 || rolls > 0)
                ) {
                    target.add(
                        new THREE.Vector3(
                            -110,
                            25,
                            i === 4 ? -75 : 75
                        ).applyQuaternion(
                            attitude(lead.velocity, lead.quaternion)
                        )
                    );
                }
                follow(i, target, lead.velocity, dt);
            }
        }
        for (const i of [1, 2]) {
            states[i].position.y += rollHeight;
            states[i].velocity.y += rollVerticalSpeed;
        }
        if (inheritedRollEnd > 0) {
            inheritedRollEnd = Math.max(0, inheritedRollEnd - dt);
            const t = 86 - inheritedRollEnd;
            for (const i of [1, 2])
                states[i].quaternion.copy(sampleDisplay(t, i).quaternion);
        }
        if (rolls > 0 && rollElapsed >= 0) {
            const angle = 2 * Math.PI * smooth(rollElapsed / 2.5);
            for (const i of [1, 2])
                states[i].quaternion
                    .copy(attitude(states[i].velocity, states[i].quaternion))
                    .multiply(
                        new THREE.Quaternion().setFromAxisAngle(
                            X,
                            (i === 1 ? -1 : 1) * angle
                        )
                    );
            if (rollElapsed >= 2.5 - 1e-8) {
                rollElapsed = 0;
                rolls--;
                completedRolls++;
            }
        }
        if (!out && !rolls && formationError() < 14) settled += dt;
        else settled = 0;
        if (settled > 1) soloStart = -1;
        states.forEach((s) => {
            s.smoke = true;
        });
        if (mode === 'player') {
            syncFlight();
            flight.thrust = clamp((speedTarget - 55) / 185, 0, 1);
            flight.enginePower = flight.thrust;
            feedback = label();
        }
    }
    return {
        states,
        flight,
        takeControl,
        release,
        command,
        update,
        script,
        /** @param {number} value */
        setThrottle(value) {
            speedTarget = 55 + clamp(value, 0, 1) * 185;
        },
        get mode() {
            return mode;
        },
        get time() {
            return time;
        },
        get status() {
            return feedback || label();
        },
        get diagnostics() {
            return {
                mode,
                time,
                rolls,
                rollElapsed,
                completedRolls,
                soloOut: solosOut(),
                settled,
                formationError: formationError(),
                blend,
                approach,
                speedTarget
            };
        }
    };
}
