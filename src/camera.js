import * as THREE from 'three';

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
        if (event.key.toLowerCase() === 'c') {
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

/**
 * @param {object} args
 * @param {THREE.PerspectiveCamera} args.camera
 * @param {import('three/addons/controls/OrbitControls.js').OrbitControls} args.controls
 * @param {THREE.Object3D} args.airplane
 * @param {CameraMode} args.cameraMode
 */
export function updateCamera({ camera, controls, airplane, cameraMode }) {
    const activeMode = cameraMode.getMode();

    if (activeMode === 'chase') {
        setCameraFov(camera, 75);

        const cameraOffset = new THREE.Vector3(-10, 4, 0);
        cameraOffset.applyQuaternion(airplane.quaternion);

        camera.position.copy(airplane.position).add(cameraOffset);

        const lookAtOffset = new THREE.Vector3(2, 0, 0);
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else if (activeMode === 'cockpit') {
        setCameraFov(camera, 68);

        const cameraOffset = new THREE.Vector3(2.14, 1.03, 0);
        cameraOffset.applyQuaternion(airplane.quaternion);

        camera.position.copy(airplane.position).add(cameraOffset);

        const lookAtOffset = new THREE.Vector3(12, 0.92, 0);
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else {
        setCameraFov(camera, 75);

        controls.target.copy(airplane.position);
        controls.update();
    }
}
