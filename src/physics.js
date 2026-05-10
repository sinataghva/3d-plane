import * as THREE from 'three';

/**
 * @typedef {import('./input.js').KeyboardState} KeyboardState
 */

/**
 * @typedef {object} PlanePosition
 * @property {number} x
 * @property {number} y
 * @property {number} z
 */

/**
 * Mutable simulation state for the plane.
 *
 * @typedef {object} PlaneState
 * @property {PlanePosition} position
 * @property {number} speed
 * @property {number} thrust
 * @property {number} yawAngle
 * @property {number} pitchAngle
 * @property {number} rollAngle
 * @property {number} lift
 * @property {number} flapDeployment
 * @property {number} verticalSpeed
 * @property {boolean} isAirborne
 * @property {boolean} isStalling
 * @property {boolean} isCrashed
 * @property {number} crashImpact
 * @property {number} propellerRotation
 */

/**
 * Tunable simulation constants.
 *
 * @typedef {object} PlanePhysics
 * @property {number} acceleration
 * @property {number} maxSpeed
 * @property {number} thrustChangeRate
 * @property {number} minThrust
 * @property {number} maxThrust
 * @property {number} friction
 * @property {number} airDrag
 * @property {number} pitchDrag
 * @property {number} rollDrag
 * @property {number} pitchSpeed
 * @property {number} liftFactor
 * @property {number} neutralLiftFactor
 * @property {number} liftPitchFactor
 * @property {number} flapLiftFactor
 * @property {number} flapDrag
 * @property {number} flapDeploySpeed
 * @property {number} flapApproachAltitude
 * @property {number} flapApproachSpeed
 * @property {number} flapChangeRate
 * @property {number} flapStallReduction
 * @property {number} verticalDamping
 * @property {number} maxClimbRate
 * @property {number} maxSinkRate
 * @property {number} pitchPathFactor
 * @property {number} gravitySpeedFactor
 * @property {number} gravity
 * @property {number} minTakeoffSpeed
 * @property {number} takeoffThreshold
 * @property {number} stallSpeed
 * @property {number} stallPitchAngle
 * @property {number} controlAuthoritySpeed
 * @property {number} rotationSpeed
 * @property {number} rollSpeed
 * @property {number} rollRecoverySpeed
 * @property {number} pitchRecoverySpeed
 * @property {number} crashSinkSpeed
 * @property {number} crashPitchAngle
 * @property {number} crashRollAngle
 */

/**
 * @typedef {object} UpdatePlanePhysicsArgs
 * @property {PlaneState} planeState
 * @property {KeyboardState} keyboard
 * @property {PlanePhysics} planePhysics
 * @property {number} delta
 */

/**
 * @typedef {object} SyncPlaneMeshArgs
 * @property {THREE.Object3D} airplane
 * @property {THREE.Object3D} propeller
 * @property {PlaneState} planeState
 */

/**
 * @returns {PlaneState}
 */
export function createPlaneState() {
    return {
        position: { x: 0, y: 0.5, z: -120 },
        speed: 0,
        thrust: 0,
        yawAngle: -Math.PI / 2,
        pitchAngle: 0,
        rollAngle: 0,
        lift: 0,
        flapDeployment: 0,
        verticalSpeed: 0,
        isAirborne: false,
        isStalling: false,
        isCrashed: false,
        crashImpact: 0,
        propellerRotation: 0
    };
}

/**
 * @param {PlaneState} planeState
 */
export function resetPlaneState(planeState) {
    const nextState = createPlaneState();
    planeState.position.x = nextState.position.x;
    planeState.position.y = nextState.position.y;
    planeState.position.z = nextState.position.z;
    planeState.speed = nextState.speed;
    planeState.thrust = nextState.thrust;
    planeState.yawAngle = nextState.yawAngle;
    planeState.pitchAngle = nextState.pitchAngle;
    planeState.rollAngle = nextState.rollAngle;
    planeState.lift = nextState.lift;
    planeState.flapDeployment = nextState.flapDeployment;
    planeState.verticalSpeed = nextState.verticalSpeed;
    planeState.isAirborne = nextState.isAirborne;
    planeState.isStalling = nextState.isStalling;
    planeState.isCrashed = nextState.isCrashed;
    planeState.crashImpact = nextState.crashImpact;
    planeState.propellerRotation = nextState.propellerRotation;
}

/**
 * @param {number} current
 * @param {number} target
 * @param {number} maximumDelta
 * @returns {number}
 */
function moveTowards(current, target, maximumDelta) {
    const difference = target - current;
    if (Math.abs(difference) <= maximumDelta) {
        return target;
    }

    return current + Math.sign(difference) * maximumDelta;
}

/**
 * @returns {PlanePhysics}
 */
export function createPlanePhysics() {
    return {
        acceleration: 0.05,
        maxSpeed: 2,
        thrustChangeRate: 0.01,
        minThrust: 0,
        maxThrust: 1,
        friction: 0.01,
        airDrag: 0.012,
        pitchDrag: 0.016,
        rollDrag: 0.004,
        pitchSpeed: 0.012,
        liftFactor: 0.014,
        neutralLiftFactor: 0.27,
        liftPitchFactor: 2.2,
        flapLiftFactor: 0.2,
        flapDrag: 0.001,
        flapDeploySpeed: 1.25,
        flapApproachAltitude: 35,
        flapApproachSpeed: 1.35,
        flapChangeRate: 0.035,
        flapStallReduction: 0.18,
        verticalDamping: 0.965,
        maxClimbRate: 0.24,
        maxSinkRate: 0.26,
        pitchPathFactor: 0.22,
        gravitySpeedFactor: 0.095,
        gravity: 0.018,
        minTakeoffSpeed: 1.5,
        takeoffThreshold: 0.1,
        stallSpeed: 0.85,
        stallPitchAngle: 0.44,
        controlAuthoritySpeed: 1.1,
        rotationSpeed: 0.02,
        rollSpeed: 0.05,
        rollRecoverySpeed: 0.018,
        pitchRecoverySpeed: 0.006,
        crashSinkSpeed: 0.18,
        crashPitchAngle: 0.85,
        crashRollAngle: 1.35
    };
}

/**
 * Advances the plane simulation without touching Three.js scene objects.
 *
 * @param {UpdatePlanePhysicsArgs} args
 */
export function updatePlanePhysics({
    planeState,
    keyboard,
    planePhysics,
    delta
}) {
    if (planeState.isCrashed) {
        return;
    }

    const frameScale = Math.min(delta * 60, 3);
    const groundLevel = 0.5;
    const altitude = Math.max(0, planeState.position.y - groundLevel);
    const airspeedAuthority = THREE.MathUtils.clamp(
        planeState.speed / planePhysics.controlAuthoritySpeed,
        0,
        1
    );
    const isRolling = planeState.speed > 0.02;

    planeState.propellerRotation +=
        (0.08 + planeState.speed * 0.18 + planeState.thrust * 0.32) *
        frameScale;

    if (keyboard.w) {
        planeState.thrust += planePhysics.thrustChangeRate * frameScale;
    }
    if (keyboard.s) {
        planeState.thrust -= planePhysics.thrustChangeRate * frameScale;
    }
    planeState.thrust = THREE.MathUtils.clamp(
        planeState.thrust,
        planePhysics.minThrust,
        planePhysics.maxThrust
    );

    const targetFlapDeployment =
        !planeState.isAirborne ||
        (altitude < planePhysics.flapApproachAltitude &&
            planeState.speed < planePhysics.flapApproachSpeed)
            ? planeState.speed < planePhysics.flapDeploySpeed
                ? 1
                : 0
            : 0;
    planeState.flapDeployment = moveTowards(
        planeState.flapDeployment,
        targetFlapDeployment,
        planePhysics.flapChangeRate * frameScale
    );

    const attitudeDrag =
        (Math.abs(planeState.pitchAngle) * planePhysics.pitchDrag +
            Math.abs(planeState.rollAngle) * planePhysics.rollDrag) *
        planeState.speed;
    const airDrag = planePhysics.airDrag * planeState.speed * planeState.speed;
    const flapDrag =
        planePhysics.flapDrag *
        planeState.flapDeployment *
        planeState.speed *
        planeState.speed;
    const rollingDrag = planeState.isAirborne ? 0 : planePhysics.friction;
    const thrustAcceleration = planePhysics.acceleration * planeState.thrust;
    planeState.speed = Math.max(
        0,
        planeState.speed +
            (thrustAcceleration -
                airDrag -
                flapDrag -
                rollingDrag -
                attitudeDrag) *
                frameScale
    );

    const rollInput =
        (keyboard.arrowRight ? 1 : 0) - (keyboard.arrowLeft ? 1 : 0);
    const pitchInput =
        (keyboard.arrowDown ? 1 : 0) - (keyboard.arrowUp ? 1 : 0);
    const rudderInput = (keyboard.a ? 1 : 0) - (keyboard.d ? 1 : 0);

    const rollAuthority = planeState.isAirborne ? airspeedAuthority : 0;
    if (rollInput) {
        planeState.rollAngle +=
            rollInput * planePhysics.rollSpeed * rollAuthority * frameScale;
    } else {
        if (Math.abs(planeState.rollAngle) <= planePhysics.rollRecoverySpeed) {
            planeState.rollAngle = 0;
        } else {
            planeState.rollAngle -=
                Math.sign(planeState.rollAngle) *
                planePhysics.rollRecoverySpeed *
                frameScale;
        }
    }

    const pitchAuthority = planeState.isAirborne
        ? airspeedAuthority
        : THREE.MathUtils.clamp(
              (planeState.speed - planePhysics.minTakeoffSpeed * 0.45) /
                  (planePhysics.minTakeoffSpeed * 0.55),
              0,
              1
          );
    if (pitchInput) {
        planeState.pitchAngle +=
            pitchInput * planePhysics.pitchSpeed * pitchAuthority * frameScale;
    } else if (!planeState.isAirborne) {
        if (
            Math.abs(planeState.pitchAngle) <= planePhysics.pitchRecoverySpeed
        ) {
            planeState.pitchAngle = 0;
        } else {
            planeState.pitchAngle -=
                Math.sign(planeState.pitchAngle) *
                planePhysics.pitchRecoverySpeed *
                frameScale;
        }
    } else if (planeState.speed < planePhysics.stallSpeed) {
        planeState.pitchAngle -=
            Math.sign(planeState.pitchAngle) *
            planePhysics.pitchRecoverySpeed *
            0.35 *
            frameScale;
    }

    const yawAuthority = planeState.isAirborne
        ? airspeedAuthority
        : THREE.MathUtils.clamp(
              planeState.speed / planePhysics.minTakeoffSpeed,
              0,
              1
          );
    const rudderTurnRate =
        rudderInput * planePhysics.rotationSpeed * yawAuthority * frameScale;
    const bankTurnRate =
        -planeState.rollAngle *
        planePhysics.rotationSpeed *
        0.9 *
        airspeedAuthority *
        frameScale;
    planeState.yawAngle += rudderTurnRate + bankTurnRate;

    const orientation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
            planeState.rollAngle,
            planeState.yawAngle,
            planeState.pitchAngle,
            'YZX'
        )
    );
    const forwardVector = new THREE.Vector3(1, 0, 0).applyQuaternion(
        orientation
    );

    if (planeState.isAirborne) {
        planeState.speed = Math.max(
            0,
            planeState.speed -
                forwardVector.y * planePhysics.gravitySpeedFactor * frameScale
        );
    }

    const liftSpeedFactor = planeState.speed * planeState.speed;
    const pitchLiftFactor = Math.max(
        0.08,
        planePhysics.neutralLiftFactor +
            planeState.pitchAngle * planePhysics.liftPitchFactor +
            planeState.flapDeployment * planePhysics.flapLiftFactor
    );
    planeState.lift =
        liftSpeedFactor * planePhysics.liftFactor * pitchLiftFactor;
    const effectiveStallSpeed =
        planePhysics.stallSpeed -
        planeState.flapDeployment * planePhysics.flapStallReduction;
    planeState.isStalling =
        altitude > 0 &&
        (planeState.speed < effectiveStallSpeed ||
            planeState.pitchAngle > planePhysics.stallPitchAngle);

    const isTryingToRotate =
        pitchInput > 0 && planeState.speed >= planePhysics.minTakeoffSpeed;
    if (!planeState.isAirborne && isTryingToRotate) {
        planeState.isAirborne = true;
        planeState.verticalSpeed = Math.max(planeState.verticalSpeed, 0.02);
    }

    if (planeState.isAirborne) {
        const stallPenalty = planeState.isStalling
            ? planePhysics.gravity * 1.6
            : 0;
        planeState.verticalSpeed +=
            (planeState.lift - planePhysics.gravity - stallPenalty) *
            frameScale;
        planeState.verticalSpeed *= planePhysics.verticalDamping;
        planeState.verticalSpeed = THREE.MathUtils.clamp(
            planeState.verticalSpeed,
            -planePhysics.maxSinkRate,
            planePhysics.maxClimbRate
        );
    } else {
        planeState.verticalSpeed = 0;
        planeState.position.y = groundLevel;
        planeState.isStalling = false;
    }

    if (planeState.speed > 0) {
        planeState.position.x +=
            forwardVector.x * planeState.speed * frameScale;
        planeState.position.z +=
            forwardVector.z * planeState.speed * frameScale;
    }

    if (planeState.isAirborne) {
        const pathVerticalSpeed =
            forwardVector.y * planeState.speed * planePhysics.pitchPathFactor;
        const totalVerticalSpeed = planeState.verticalSpeed + pathVerticalSpeed;
        planeState.position.y += totalVerticalSpeed * frameScale;

        if (planeState.position.y <= groundLevel) {
            const impactSpeed = Math.abs(totalVerticalSpeed);
            const hasHardImpact =
                totalVerticalSpeed < -planePhysics.crashSinkSpeed;
            const hasBadAttitude =
                Math.abs(planeState.pitchAngle) >
                    planePhysics.crashPitchAngle ||
                Math.abs(planeState.rollAngle) > planePhysics.crashRollAngle;

            planeState.position.y = groundLevel;
            planeState.verticalSpeed = 0;
            planeState.isAirborne = false;
            planeState.isStalling = false;

            if (hasHardImpact || hasBadAttitude) {
                planeState.speed = 0;
                planeState.thrust = 0;
                planeState.isCrashed = true;
                planeState.crashImpact = impactSpeed;
            } else {
                planeState.rollAngle *= 0.5;
                planeState.crashImpact = 0;
            }
        }
    }

    if (!planeState.isAirborne) {
        const isNearBarrier =
            Math.abs(planeState.position.z - 144.5) < 2 &&
            Math.abs(planeState.position.x) < 10;

        if (isNearBarrier && planeState.position.z >= 144.5) {
            planeState.position.z = 144.5;
            planeState.speed = 0;
        }

        if (planeState.position.z < -145) {
            planeState.position.z = -145;
        }
    }

    if (planeState.speed === 0 && !isRolling && !planeState.isAirborne) {
        planeState.rollAngle = 0;
        planeState.pitchAngle = 0;
    }
}

/**
 * Applies plain simulation state to the rendered Three.js objects.
 *
 * @param {SyncPlaneMeshArgs} args
 */
export function syncPlaneMesh({ airplane, propeller, planeState }) {
    airplane.position.set(
        planeState.position.x,
        planeState.position.y,
        planeState.position.z
    );
    airplane.quaternion.setFromEuler(
        new THREE.Euler(
            planeState.rollAngle,
            planeState.yawAngle,
            planeState.pitchAngle,
            'YZX'
        )
    );
    propeller.rotation.x = planeState.propellerRotation;
}
