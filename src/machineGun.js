import * as THREE from 'three';

/**
 * @typedef {import('./input.js').KeyboardState} KeyboardState
 * @typedef {import('./physics.js').PlaneState} PlaneState
 */

export const MACHINE_GUN_RANGE = 380;
export const MACHINE_GUN_TRACER_SPEED = 130;
export const MACHINE_GUN_FIRE_INTERVAL = 0.08;

const TRACER_LENGTH = 5.6;
const MUZZLE_LOCAL_POSITIONS = [
    new THREE.Vector3(3.48, -0.02, 0.22),
    new THREE.Vector3(3.48, -0.02, -0.22)
];
const LOCAL_FORWARD = new THREE.Vector3(1, 0, 0);
const CYLINDER_UP = new THREE.Vector3(0, 1, 0);

/**
 * @typedef {object} Tracer
 * @property {THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>} mesh
 * @property {THREE.Vector3} velocity
 * @property {number} distance
 */

/**
 * @param {PlaneState} planeState
 * @returns {THREE.Quaternion}
 */
function getPlaneQuaternion(planeState) {
    return new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
            planeState.rollAngle,
            planeState.yawAngle,
            planeState.pitchAngle,
            'YZX'
        )
    );
}

/**
 * @param {PlaneState} planeState
 * @returns {THREE.Vector3}
 */
function getForwardVector(planeState) {
    return LOCAL_FORWARD.clone().applyQuaternion(getPlaneQuaternion(planeState));
}

/**
 * @param {PlaneState} planeState
 * @returns {THREE.Vector3[]}
 */
function getMuzzlePositions(planeState) {
    const quaternion = getPlaneQuaternion(planeState);
    const planePosition = new THREE.Vector3(
        planeState.position.x,
        planeState.position.y,
        planeState.position.z
    );

    return MUZZLE_LOCAL_POSITIONS.map((localPosition) =>
        localPosition.clone().applyQuaternion(quaternion).add(planePosition)
    );
}

/**
 * @param {THREE.Scene} scene
 */
export function createMachineGun(scene) {
    const tracerGeometry = new THREE.CylinderGeometry(
        0.045,
        0.03,
        TRACER_LENGTH,
        8
    );
    const tracerMaterial = new THREE.MeshBasicMaterial({
        color: 0xff7a18,
        transparent: true,
        opacity: 1
    });
    /** @type {Tracer[]} */
    const tracers = [];
    let fireCooldown = 0;

    /**
     * @param {PlaneState} planeState
     */
    function fireBurst(planeState) {
        const forwardVector = getForwardVector(planeState).normalize();
        const tracerQuaternion = new THREE.Quaternion().setFromUnitVectors(
            CYLINDER_UP,
            forwardVector
        );

        for (const muzzlePosition of getMuzzlePositions(planeState)) {
            const material = tracerMaterial.clone();
            const mesh = new THREE.Mesh(tracerGeometry, material);
            mesh.quaternion.copy(tracerQuaternion);
            mesh.position
                .copy(muzzlePosition)
                .addScaledVector(forwardVector, TRACER_LENGTH * 0.5);
            scene.add(mesh);

            tracers.push({
                mesh,
                velocity: forwardVector
                    .clone()
                    .multiplyScalar(MACHINE_GUN_TRACER_SPEED + planeState.speed),
                distance: 0
            });
        }
    }

    return {
        tracers,

        /**
         * @param {object} args
         * @param {PlaneState} args.planeState
         * @param {KeyboardState} args.keyboard
         * @param {number} args.delta
         */
        update({ planeState, keyboard, delta }) {
            fireCooldown = Math.max(0, fireCooldown - delta);

            if (keyboard.space && !planeState.isCrashed && fireCooldown === 0) {
                fireBurst(planeState);
                fireCooldown = MACHINE_GUN_FIRE_INTERVAL;
            }

            for (let index = tracers.length - 1; index >= 0; index--) {
                const tracer = tracers[index];
                const distanceStep = tracer.velocity.length() * delta;
                tracer.mesh.position.addScaledVector(tracer.velocity, delta);
                tracer.distance += distanceStep;
                tracer.mesh.material.opacity = Math.max(
                    0,
                    1 - tracer.distance / MACHINE_GUN_RANGE
                );

                if (tracer.distance >= MACHINE_GUN_RANGE) {
                    scene.remove(tracer.mesh);
                    tracer.mesh.material.dispose();
                    tracers.splice(index, 1);
                }
            }
        },

        clear() {
            for (const tracer of tracers) {
                scene.remove(tracer.mesh);
                tracer.mesh.material.dispose();
            }
            tracers.length = 0;
            fireCooldown = 0;
        }
    };
}
