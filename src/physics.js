import * as THREE from 'three';

export function createPlanePhysics() {
    return {
        speed: 0,
        acceleration: 0.05,
        maxSpeed: 2,
        friction: 0.01,
        yawAngle: -Math.PI / 2,
        pitchAngle: 0,
        maxPitchAngle: 0.5,
        pitchSpeed: 0.008,
        lift: 0,
        liftFactor: 0.03,
        gravity: 0.01,
        minTakeoffSpeed: 1.5,
        isAirborne: false,
        takeoffThreshold: 0.1,
        rotationSpeed: 0.02,
        rollAngle: 0,
        maxRollAngle: 0.8,
        rollSpeed: 0.05,
        rollRecoverySpeed: 0.03
    };
}

export function updatePlanePhysics({ airplane, propeller, keyboard, planePhysics }) {
    propeller.rotation.x += 0.2;

    if (keyboard.w) {
        planePhysics.speed += planePhysics.acceleration;
        if (planePhysics.speed > planePhysics.maxSpeed) {
            planePhysics.speed = planePhysics.maxSpeed;
        }
        propeller.rotation.x += planePhysics.speed * 0.1;
    } else {
        planePhysics.speed -= planePhysics.friction;
        if (planePhysics.speed < 0) {
            planePhysics.speed = 0;
        }
    }

    if (keyboard.arrowLeft || keyboard.arrowRight) {
        const targetRoll = keyboard.arrowLeft ? -planePhysics.maxRollAngle : planePhysics.maxRollAngle;

        if (planePhysics.rollAngle < targetRoll) {
            planePhysics.rollAngle += planePhysics.rollSpeed;
            if (planePhysics.rollAngle > targetRoll) planePhysics.rollAngle = targetRoll;
        } else if (planePhysics.rollAngle > targetRoll) {
            planePhysics.rollAngle -= planePhysics.rollSpeed;
            if (planePhysics.rollAngle < targetRoll) planePhysics.rollAngle = targetRoll;
        }

        const turnRate = planePhysics.rotationSpeed * (Math.abs(planePhysics.rollAngle) / planePhysics.maxRollAngle);
        if (keyboard.arrowLeft) {
            planePhysics.yawAngle += turnRate;
        } else {
            planePhysics.yawAngle -= turnRate;
        }
    } else {
        if (planePhysics.rollAngle > 0) {
            planePhysics.rollAngle -= planePhysics.rollRecoverySpeed;
            if (planePhysics.rollAngle < 0) planePhysics.rollAngle = 0;
        } else if (planePhysics.rollAngle < 0) {
            planePhysics.rollAngle += planePhysics.rollRecoverySpeed;
            if (planePhysics.rollAngle > 0) planePhysics.rollAngle = 0;
        }
    }

    if (keyboard.a) {
        planePhysics.yawAngle += planePhysics.rotationSpeed;
    }
    if (keyboard.d) {
        planePhysics.yawAngle -= planePhysics.rotationSpeed;
    }

    if (keyboard.arrowUp) {
        planePhysics.pitchAngle -= planePhysics.pitchSpeed;
        if (planePhysics.pitchAngle < -planePhysics.maxPitchAngle) {
            planePhysics.pitchAngle = -planePhysics.maxPitchAngle;
        }
    } else if (keyboard.arrowDown) {
        planePhysics.pitchAngle += planePhysics.pitchSpeed;
        if (planePhysics.pitchAngle > planePhysics.maxPitchAngle) {
            planePhysics.pitchAngle = planePhysics.maxPitchAngle;
        }
    } else {
        if (planePhysics.pitchAngle > 0) {
            planePhysics.pitchAngle -= planePhysics.pitchSpeed / 2;
            if (planePhysics.pitchAngle < 0) planePhysics.pitchAngle = 0;
        } else if (planePhysics.pitchAngle < 0) {
            planePhysics.pitchAngle += planePhysics.pitchSpeed / 2;
            if (planePhysics.pitchAngle > 0) planePhysics.pitchAngle = 0;
        }
    }

    airplane.quaternion.setFromEuler(
        new THREE.Euler(
            planePhysics.rollAngle,
            planePhysics.yawAngle,
            planePhysics.pitchAngle,
            'YZX'
        )
    );

    if (planePhysics.speed > 0) {
        const moveVector = new THREE.Vector3(planePhysics.speed, 0, 0);
        moveVector.applyQuaternion(airplane.quaternion);
        airplane.position.add(moveVector);

        const speedFactor = Math.max(0, (planePhysics.speed - 0.5) / planePhysics.minTakeoffSpeed);
        const pitchFactor = Math.max(0, planePhysics.pitchAngle * 10 + 0.5);
        planePhysics.lift = speedFactor * pitchFactor * planePhysics.liftFactor;

        if (planePhysics.isAirborne || planePhysics.speed >= planePhysics.minTakeoffSpeed) {
            if (planePhysics.pitchAngle > 0 && planePhysics.speed > 0.8) {
                airplane.position.y += planePhysics.lift;

                if (airplane.position.y > 0.5 + planePhysics.takeoffThreshold) {
                    planePhysics.isAirborne = true;
                }
            }

            airplane.position.y -= planePhysics.gravity;

            if (airplane.position.y <= 0.5) {
                airplane.position.y = 0.5;
                if (planePhysics.speed < 0.8 || planePhysics.pitchAngle < 0) {
                    planePhysics.isAirborne = false;
                }
            }
        } else {
            airplane.position.y = 0.5;
        }

        if (!planePhysics.isAirborne) {
            const isNearBarrier = Math.abs(airplane.position.z - 144.5) < 2 && Math.abs(airplane.position.x) < 10;

            if (isNearBarrier && airplane.position.z >= 144.5) {
                airplane.position.z = 144.5;
                planePhysics.speed = 0;
            }

            if (airplane.position.z < -145) {
                airplane.position.z = -145;
            }
        }
    } else {
        if (airplane.position.y > 0.5) {
            airplane.position.y -= planePhysics.gravity * 2;
            if (airplane.position.y < 0.5) {
                airplane.position.y = 0.5;
                planePhysics.isAirborne = false;
            }
        } else {
            airplane.position.y = 0.5;
            planePhysics.isAirborne = false;
        }
    }
}
