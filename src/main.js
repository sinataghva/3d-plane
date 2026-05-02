import './styles.css';

import * as THREE from 'three';

import { createAirplane } from './airplane.js';
import { createAirbase } from './airbase.js';
import { addClouds } from './clouds.js';
import { createCameraModeToggle, updateCamera } from './camera.js';
import { createHud } from './hud.js';
import { createKeyboardState } from './input.js';
import {
    createPlanePhysics,
    createPlaneState,
    syncPlaneMesh,
    updatePlanePhysics
} from './physics.js';
import { isWebGLAvailable, showRuntimeFallback } from './runtimeFallback.js';
import { createScene } from './scene.js';

/**
 * @param {unknown} error
 */
function reportRuntimeError(error) {
    console.error(error);
    showRuntimeFallback('The 3D scene could not be started.');
}

window.addEventListener('error', (event) => {
    reportRuntimeError(event.error || event.message);
});

window.addEventListener('unhandledrejection', (event) => {
    reportRuntimeError(event.reason);
});

function startApp() {
    if (!isWebGLAvailable()) {
        showRuntimeFallback('WebGL is not available in this browser.');
        return;
    }

    const container = document.getElementById('canvas-container');
    if (!(container instanceof HTMLElement)) {
        throw new Error('Missing #canvas-container element');
    }

    const { scene, camera, renderer, controls } = createScene({ container });

    const { airplane, propeller } = createAirplane();
    const planeState = createPlaneState();
    syncPlaneMesh({ airplane, propeller, planeState });
    scene.add(airplane);

    const airbase = createAirbase();
    airbase.position.y = -0.5;
    scene.add(airbase);

    addClouds(scene);

    const keyboard = createKeyboardState();
    const planePhysics = createPlanePhysics();
    const cameraMode = createCameraModeToggle();
    const hud = createHud();
    const timer = new THREE.Timer();
    timer.connect(document);

    /**
     * @param {number} timestamp
     */
    function animate(timestamp) {
        requestAnimationFrame(animate);

        timer.update(timestamp);
        const delta = timer.getDelta();
        updatePlanePhysics({ planeState, keyboard, planePhysics, delta });
        syncPlaneMesh({ airplane, propeller, planeState });
        updateCamera({ camera, controls, airplane, cameraMode });
        hud.update({ planeState });

        renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
}

try {
    startApp();
} catch (error) {
    reportRuntimeError(error);
}
