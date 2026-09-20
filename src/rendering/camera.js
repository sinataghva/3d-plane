import * as THREE from 'three';
import { isEditableTarget } from '../flight/input.js';

/**
 * @typedef {object} CameraMode
 * @property {() => boolean} isOrbitMode
 * @property {() => string} getMode
 * @property {(mode: string) => void} setMode
 */

const CAMERA_MODES = ['chase', 'cockpit', 'orbit'];

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {number} fov
 */
function setCameraFov(camera, fov) {
    if (camera.fov === fov) return;

    camera.fov = fov;
    camera.updateProjectionMatrix();
}

/**
 * @returns {CameraMode}
 */
export function createCameraModeToggle(initialMode = 'chase') {
    let cameraModeIndex = Math.max(0, CAMERA_MODES.indexOf(initialMode));

    window.addEventListener('keydown', (event) => {
        if (
            !event.repeat &&
            !isEditableTarget(event.target) &&
            !event.metaKey &&
            !event.ctrlKey &&
            !event.altKey &&
            event.key.toLowerCase() === 'c'
        ) {
            cameraModeIndex = (cameraModeIndex + 1) % CAMERA_MODES.length;
        }
    });

    return {
        isOrbitMode() {
            return this.getMode() === 'orbit';
        },
        getMode() {
            return CAMERA_MODES[cameraModeIndex];
        },
        setMode(mode) {
            const nextIndex = CAMERA_MODES.indexOf(mode);
            if (nextIndex === -1) {
                throw new Error(`Unknown camera mode: ${mode}`);
            }

            cameraModeIndex = nextIndex;
        }
    };
}

const offset = new THREE.Vector3();
const target = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
const worldUp = new THREE.Vector3(0, 1, 0);

/**
 * @param {object} args
 * @param {THREE.PerspectiveCamera} args.camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} args.controls
 * @param {THREE.Object3D} args.airplane
 * @param {number} [args.delta]
 * @param {CameraMode} args.cameraMode
 */
export function updateCamera({
    camera,
    controls,
    airplane,
    cameraMode,
    delta = 0
}) {
    const activeMode = cameraMode.getMode();
    // Carry the camera with translation; smooth only the changing chase offset.
    const previous = camera.userData.flightPosition;
    if (
        delta > 0 &&
        previous &&
        camera.userData.flightMode === activeMode &&
        (activeMode === 'chase' || activeMode === 'orbit') &&
        airplane.position.distanceToSquared(previous) < 2500
    ) {
        camera.position.add(airplane.position).sub(previous);
    }
    if (!previous) camera.userData.flightPosition = new THREE.Vector3();
    camera.userData.flightPosition.copy(airplane.position);

    if (activeMode === 'chase') {
        setCameraFov(camera, 75);

        // Follow horizontal heading, retaining the last bearing at vertical flight.
        lookTarget.set(1, 0, 0).applyQuaternion(airplane.quaternion);
        if (Math.hypot(lookTarget.x, lookTarget.z) > 0.15)
            camera.userData.chaseHeading = Math.atan2(
                -lookTarget.z,
                lookTarget.x
            );
        const heading = camera.userData.chaseHeading ?? 0;
        const distance = airplane.userData.jet ? 23 : 10;
        offset.set(
            -Math.cos(heading) * distance,
            airplane.userData.jet ? 8 : 4,
            Math.sin(heading) * distance
        );
        target.copy(airplane.position).add(offset);
        const snap =
            delta === 0 ||
            camera.userData.flightMode !== activeMode ||
            camera.position.distanceToSquared(target) > 2500;
        camera.position.lerp(target, snap ? 1 : 1 - Math.exp(-3 * delta));
        camera.up.copy(worldUp);

        lookTarget
            .set(2, 0, 0)
            .applyQuaternion(airplane.quaternion)
            .add(airplane.position);
        camera.lookAt(lookTarget);
    } else if (activeMode === 'cockpit') {
        setCameraFov(camera, 68);

        offset
            .set(
                airplane.userData.jet ? 3.5 : 2.14,
                airplane.userData.jet ? 2.1 : 1.03,
                0
            )
            .applyQuaternion(airplane.quaternion);
        camera.position.copy(airplane.position).add(offset);
        camera.up.copy(worldUp).applyQuaternion(airplane.quaternion);
        lookTarget
            .set(
                airplane.userData.jet ? 20 : 12,
                airplane.userData.jet ? 2.1 : 0.92,
                0
            )
            .applyQuaternion(airplane.quaternion)
            .add(airplane.position);
        camera.lookAt(lookTarget);
    } else {
        setCameraFov(camera, 75);

        camera.up.copy(worldUp);
        if (camera.userData.flightMode !== 'orbit') {
            // Orbit follows cockpit in the cycle; do not inherit its close-up.
            offset.set(-14, 0, 12).applyQuaternion(airplane.quaternion);
            offset.y = 0;
            if (offset.lengthSq() < 0.01) offset.set(-14, 0, 12);
            offset.setLength(airplane.userData.jet ? 32 : 18);
            offset.y = airplane.userData.jet ? 12 : 7;
            camera.position.copy(airplane.position).add(offset);
        }
        controls.target.copy(airplane.position);
        controls.update();
    }
    camera.userData.flightMode = activeMode;
}
