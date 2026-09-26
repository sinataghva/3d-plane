import * as THREE from 'three';
import { aircraftCapabilities } from '../aircraft/capabilities.js';

/**
 * @typedef {import('../flight/input.js').KeyboardState} KeyboardState
 * @typedef {import('../flight/physics.js').PlaneState} PlaneState
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
    if (planeState.attitude) {
        const q = planeState.attitude;
        return new THREE.Quaternion(q.x, q.y, q.z, q.w);
    }
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
    return LOCAL_FORWARD.clone().applyQuaternion(
        getPlaneQuaternion(planeState)
    );
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

    const muzzles =
        planeState.aircraft === 'mirage'
            ? [
                  new THREE.Vector3(2.8, 0.1, 0.85),
                  new THREE.Vector3(2.8, 0.1, -0.85)
              ]
            : MUZZLE_LOCAL_POSITIONS;
    return muzzles.map((localPosition) =>
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
    /** @type {Tracer[]} */
    const pool = [];
    /** @type {THREE.Mesh[]} */
    const flashes = [];
    let flashTime = 0;
    const flashGeometry = new THREE.SphereGeometry(0.22, 6, 4);
    const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffd486 });
    const recycle = (/** @type {Tracer} */ tracer) => {
        scene.remove(tracer.mesh);
        pool.push(tracer);
    };

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
            if (tracers.length >= 160) break;
            const reused = pool.pop();
            const mesh =
                reused?.mesh ??
                new THREE.Mesh(tracerGeometry, tracerMaterial.clone());
            mesh.material.opacity = 1;
            mesh.quaternion.copy(tracerQuaternion);
            mesh.position
                .copy(muzzlePosition)
                .addScaledVector(forwardVector, TRACER_LENGTH * 0.5);
            scene.add(mesh);

            tracers.push({
                mesh,
                velocity: forwardVector
                    .clone()
                    .multiplyScalar(
                        (planeState.aircraft === 'mirage'
                            ? 650
                            : MACHINE_GUN_TRACER_SPEED) +
                            planeState.speed * 60
                    ),
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
            if (aircraftCapabilities(planeState.aircraft).weapon !== 'gun') {
                this.clear();
                return;
            }
            if (delta <= 0) return;
            flashTime = Math.max(0, flashTime - delta);
            if (
                planeState.aircraft === 'mirage' &&
                keyboard.space &&
                !planeState.isCrashed
            ) {
                while (flashes.length < 2) {
                    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
                    flashes.push(flash);
                    scene.add(flash);
                }
            }
            fireCooldown = Math.max(0, fireCooldown - delta);

            if (keyboard.space && !planeState.isCrashed && fireCooldown === 0) {
                fireBurst(planeState);
                fireCooldown =
                    planeState.aircraft === 'mirage'
                        ? 0.025
                        : MACHINE_GUN_FIRE_INTERVAL;
                flashTime = 0.022;
            }

            const muzzles = getMuzzlePositions(planeState);
            flashes.forEach((flash, i) => {
                flash.visible =
                    keyboard.space && flashTime > 0 && !planeState.isCrashed;
                flash.position.copy(muzzles[i]);
            });
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
                    recycle(tracer);
                    tracers.splice(index, 1);
                }
            }
        },

        dispose() {
            this.clear();
            for (const tracer of pool) tracer.mesh.material.dispose();
            pool.length = 0;
            for (const flash of flashes) scene.remove(flash);
            flashes.length = 0;
            flashGeometry.dispose();
            flashMaterial.dispose();
            tracerGeometry.dispose();
            tracerMaterial.dispose();
        },
        clear() {
            for (const tracer of tracers) {
                recycle(tracer);
            }
            for (const flash of flashes) flash.visible = false;
            tracers.length = 0;
            fireCooldown = 0;
        }
    };
}
