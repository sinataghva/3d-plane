import * as THREE from 'three';

/**
 * @typedef {object} CameraMode
 * @property {() => boolean} isOrbitMode
 * @property {() => string} getMode
 */

const CAMERA_MODES = ['chase', 'cockpit', 'orbit'];

/**
 * @returns {CameraMode}
 */
export function createCameraModeToggle() {
    let cameraModeIndex = 0;

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
        const cameraOffset = new THREE.Vector3(-10, 4, 0);
        cameraOffset.applyQuaternion(airplane.quaternion);

        camera.position.copy(airplane.position).add(cameraOffset);

        const lookAtOffset = new THREE.Vector3(2, 0, 0);
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else if (activeMode === 'cockpit') {
        const cameraOffset = new THREE.Vector3(1.9, 0.95, 0);
        cameraOffset.applyQuaternion(airplane.quaternion);

        camera.position.copy(airplane.position).add(cameraOffset);

        const lookAtOffset = new THREE.Vector3(12, 0.65, 0);
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else {
        controls.target.copy(airplane.position);
        controls.update();
    }
}
