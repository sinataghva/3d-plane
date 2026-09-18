import * as THREE from 'three';
import { isEditableTarget } from './input.js';

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

        offset.set(-10, 4, 0).applyQuaternion(airplane.quaternion);
        target.copy(airplane.position).add(offset);
        const snap =
            delta === 0 ||
            camera.userData.flightMode !== activeMode ||
            camera.position.distanceToSquared(target) > 2500;
        camera.position.lerp(target, snap ? 1 : 1 - Math.exp(-8 * delta));
        camera.up.copy(worldUp);
        lookTarget
            .set(2, 0, 0)
            .applyQuaternion(airplane.quaternion)
            .add(airplane.position);
        camera.lookAt(lookTarget);
    } else if (activeMode === 'cockpit') {
        setCameraFov(camera, 68);

        offset.set(2.14, 1.03, 0).applyQuaternion(airplane.quaternion);
        camera.position.copy(airplane.position).add(offset);
        camera.up.copy(worldUp).applyQuaternion(airplane.quaternion);
        lookTarget
            .set(12, 0.92, 0)
            .applyQuaternion(airplane.quaternion)
            .add(airplane.position);
        camera.lookAt(lookTarget);
    } else {
        setCameraFov(camera, 75);

        camera.up.copy(worldUp);
        controls.target.copy(airplane.position);
        controls.update();
    }
    camera.userData.flightMode = activeMode;
}
