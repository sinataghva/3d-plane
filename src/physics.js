import * as THREE from 'three';

export function createPlaneState() {
    return {
        position: { x: 0, y: 0.5, z: -120 },
        speed: 0,
        yawAngle: -Math.PI / 2,
        pitchAngle: 0,
        rollAngle: 0,
        lift: 0,
        isAirborne: false,
        propellerRotation: 0
    };
}

export function createPlanePhysics() {
    return {
        acceleration: 0.05,
        maxSpeed: 2,
        friction: 0.01,
        maxPitchAngle: 0.5,
        pitchSpeed: 0.008,
        liftFactor: 0.03,
        gravity: 0.01,
        minTakeoffSpeed: 1.5,
        takeoffThreshold: 0.1,
        rotationSpeed: 0.02,
        maxRollAngle: 0.8,
        rollSpeed: 0.05,
        rollRecoverySpeed: 0.03
    };
}

export function updatePlanePhysics({
    planeState,
    keyboard,
    planePhysics,
    delta
}) {
    const frameScale = Math.min(delta * 60, 3);

    planeState.propellerRotation += 0.2 * frameScale;

    if (keyboard.w) {
        planeState.speed += planePhysics.acceleration * frameScale;
        if (planeState.speed > planePhysics.maxSpeed) {
            planeState.speed = planePhysics.maxSpeed;
        }
        planeState.propellerRotation += planeState.speed * 0.1 * frameScale;
    } else {
        planeState.speed -= planePhysics.friction * frameScale;
        if (planeState.speed < 0) {
            planeState.speed = 0;
        }
    }

    if (keyboard.arrowLeft || keyboard.arrowRight) {
        const targetRoll = keyboard.arrowLeft
            ? -planePhysics.maxRollAngle
            : planePhysics.maxRollAngle;

        if (planeState.rollAngle < targetRoll) {
            planeState.rollAngle += planePhysics.rollSpeed * frameScale;
            if (planeState.rollAngle > targetRoll)
                planeState.rollAngle = targetRoll;
        } else if (planeState.rollAngle > targetRoll) {
            planeState.rollAngle -= planePhysics.rollSpeed * frameScale;
            if (planeState.rollAngle < targetRoll)
                planeState.rollAngle = targetRoll;
        }

        const turnRate =
            planePhysics.rotationSpeed *
            (Math.abs(planeState.rollAngle) / planePhysics.maxRollAngle) *
            frameScale;
        if (keyboard.arrowLeft) {
            planeState.yawAngle += turnRate;
        } else {
            planeState.yawAngle -= turnRate;
        }
    } else {
        if (planeState.rollAngle > 0) {
            planeState.rollAngle -= planePhysics.rollRecoverySpeed * frameScale;
            if (planeState.rollAngle < 0) planeState.rollAngle = 0;
        } else if (planeState.rollAngle < 0) {
            planeState.rollAngle += planePhysics.rollRecoverySpeed * frameScale;
            if (planeState.rollAngle > 0) planeState.rollAngle = 0;
        }
    }

    if (keyboard.a) {
        planeState.yawAngle += planePhysics.rotationSpeed * frameScale;
    }
    if (keyboard.d) {
        planeState.yawAngle -= planePhysics.rotationSpeed * frameScale;
    }

    if (keyboard.arrowUp) {
        planeState.pitchAngle -= planePhysics.pitchSpeed * frameScale;
        if (planeState.pitchAngle < -planePhysics.maxPitchAngle) {
            planeState.pitchAngle = -planePhysics.maxPitchAngle;
        }
    } else if (keyboard.arrowDown) {
        planeState.pitchAngle += planePhysics.pitchSpeed * frameScale;
        if (planeState.pitchAngle > planePhysics.maxPitchAngle) {
            planeState.pitchAngle = planePhysics.maxPitchAngle;
        }
    } else {
        if (planeState.pitchAngle > 0) {
            planeState.pitchAngle -= (planePhysics.pitchSpeed / 2) * frameScale;
            if (planeState.pitchAngle < 0) planeState.pitchAngle = 0;
        } else if (planeState.pitchAngle < 0) {
            planeState.pitchAngle += (planePhysics.pitchSpeed / 2) * frameScale;
            if (planeState.pitchAngle > 0) planeState.pitchAngle = 0;
        }
    }

    const orientation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
            planeState.rollAngle,
            planeState.yawAngle,
            planeState.pitchAngle,
            'YZX'
        )
    );

    if (planeState.speed > 0) {
        const moveVector = new THREE.Vector3(
            planeState.speed * frameScale,
            0,
            0
        );
        moveVector.applyQuaternion(orientation);
        planeState.position.x += moveVector.x;
        planeState.position.y += moveVector.y;
        planeState.position.z += moveVector.z;

        const speedFactor = Math.max(
            0,
            (planeState.speed - 0.5) / planePhysics.minTakeoffSpeed
        );
        const pitchFactor = Math.max(0, planeState.pitchAngle * 10 + 0.5);
        planeState.lift = speedFactor * pitchFactor * planePhysics.liftFactor;

        if (
            planeState.isAirborne ||
            planeState.speed >= planePhysics.minTakeoffSpeed
        ) {
            if (planeState.pitchAngle > 0 && planeState.speed > 0.8) {
                planeState.position.y += planeState.lift * frameScale;

                if (
                    planeState.position.y >
                    0.5 + planePhysics.takeoffThreshold
                ) {
                    planeState.isAirborne = true;
                }
            }

            planeState.position.y -= planePhysics.gravity * frameScale;

            if (planeState.position.y <= 0.5) {
                planeState.position.y = 0.5;
                if (planeState.speed < 0.8 || planeState.pitchAngle < 0) {
                    planeState.isAirborne = false;
                }
            }
        } else {
            planeState.position.y = 0.5;
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
    } else {
        if (planeState.position.y > 0.5) {
            planeState.position.y -= planePhysics.gravity * 2 * frameScale;
            if (planeState.position.y < 0.5) {
                planeState.position.y = 0.5;
                planeState.isAirborne = false;
            }
        } else {
            planeState.position.y = 0.5;
            planeState.isAirborne = false;
        }
    }
}

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
