import * as THREE from 'three';

/**
 * @typedef {object} CameraMode
 * @property {() => boolean} isOrbitMode
 */

/**
 * @returns {CameraMode}
 */
export function createCameraModeToggle() {
    let cameraMode = false;

    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'c') {
            cameraMode = !cameraMode;
        }
    });

    return {
        isOrbitMode() {
            return cameraMode;
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
    if (!cameraMode.isOrbitMode()) {
        const cameraOffset = new THREE.Vector3(-10, 4, 0);
        cameraOffset.applyQuaternion(airplane.quaternion);

        camera.position.copy(airplane.position).add(cameraOffset);

        const lookAtOffset = new THREE.Vector3(2, 0, 0);
        lookAtOffset.applyQuaternion(airplane.quaternion);
        const lookAtPoint = airplane.position.clone().add(lookAtOffset);
        camera.lookAt(lookAtPoint);
    } else {
        controls.target.copy(airplane.position);
        controls.update();
    }
}
