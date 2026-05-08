import './styles.css';

import * as THREE from 'three';

import { createAirplane, updateAirplaneControlSurfaces } from './airplane.js';
import { createAirbase } from './airbase.js';
import { addClouds } from './clouds.js';
import { createCameraModeToggle, updateCamera } from './camera.js';
import { createHud } from './hud.js';
import { createKeyboardState } from './input.js';
import {
    createPlanePhysics,
    createPlaneState,
    resetPlaneState,
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

const CRASH_RESTART_DELAY = 2.2;

/**
 * @param {THREE.Scene} scene
 */
function createCrashEffect(scene) {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);

    const shockwaveGeometry = new THREE.RingGeometry(0.5, 0.58, 40);
    const shockwaveMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide
    });
    const shockwave = new THREE.Mesh(shockwaveGeometry, shockwaveMaterial);
    shockwave.rotation.x = -Math.PI / 2;
    group.add(shockwave);

    const particleGeometry = new THREE.SphereGeometry(0.16, 10, 8);
    /** @type {THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[]} */
    const particles = [];
    const directions = [
        new THREE.Vector3(1, 0.35, 0),
        new THREE.Vector3(-1, 0.28, 0.15),
        new THREE.Vector3(0.5, 0.5, 0.75),
        new THREE.Vector3(0.2, 0.38, -0.95),
        new THREE.Vector3(-0.6, 0.45, -0.65),
        new THREE.Vector3(0.85, 0.25, -0.45),
        new THREE.Vector3(-0.25, 0.6, 0.9),
        new THREE.Vector3(0.05, 0.85, -0.1)
    ];

    for (const direction of directions) {
        const material = new THREE.MeshBasicMaterial({
            color: direction.y > 0.5 ? 0xfff3a1 : 0xff7a24,
            transparent: true,
            opacity: 0
        });
        const particle = new THREE.Mesh(particleGeometry, material);
        particle.userData.direction = direction.normalize();
        group.add(particle);
        particles.push(particle);
    }

    return {
        /**
         * @param {THREE.Vector3} position
         */
        trigger(position) {
            group.position.copy(position);
            group.position.y = 0.52;
            group.visible = true;
            shockwave.scale.setScalar(0.4);
            shockwaveMaterial.opacity = 0.85;

            for (const particle of particles) {
                particle.position.set(0, 0.22, 0);
                particle.scale.setScalar(1);
                particle.material.opacity = 0.95;
            }
        },

        /**
         * @param {number} elapsed
         */
        update(elapsed) {
            if (!group.visible) return;

            const progress = Math.min(elapsed / CRASH_RESTART_DELAY, 1);
            shockwave.scale.setScalar(0.4 + progress * 6);
            shockwaveMaterial.opacity = Math.max(0, 0.85 * (1 - progress));

            for (const particle of particles) {
                /** @type {THREE.Vector3} */
                const direction = particle.userData.direction;
                particle.position
                    .copy(direction)
                    .multiplyScalar(progress * 3.8);
                particle.position.y +=
                    0.22 + Math.sin(progress * Math.PI) * 0.9;
                particle.scale.setScalar(Math.max(0.12, 1 - progress * 0.78));
                particle.material.opacity = Math.max(0, 0.95 * (1 - progress));
            }
        },

        hide() {
            group.visible = false;
        }
    };
}

function startApp() {
    if (!isWebGLAvailable()) {
        showRuntimeFallback('WebGL is not available in this browser.');
        return;
    }

    const container = document.getElementById('canvas-container');
    if (!(container instanceof HTMLElement)) {
        throw new Error('Missing #canvas-container element');
    }
    const crashOverlay = document.getElementById('crash-overlay');
    if (!(crashOverlay instanceof HTMLElement)) {
        throw new Error('Missing #crash-overlay element');
    }
    const crashOverlayElement = crashOverlay;

    const { scene, camera, renderer, controls } = createScene({ container });

    const { airplane, propeller } = createAirplane();
    const planeState = createPlaneState();
    syncPlaneMesh({ airplane, propeller, planeState });
    scene.add(airplane);

    const airbase = createAirbase();
    airbase.position.y = -0.5;
    scene.add(airbase);

    addClouds(scene);
    const crashEffect = createCrashEffect(scene);

    const keyboard = createKeyboardState();
    const planePhysics = createPlanePhysics();
    const cameraMode = createCameraModeToggle();
    const hud = createHud();
    const timer = new THREE.Timer();
    timer.connect(document);
    let crashElapsed = 0;
    let wasCrashed = false;

    /**
     * @param {number} timestamp
     */
    function animate(timestamp) {
        requestAnimationFrame(animate);

        timer.update(timestamp);
        const delta = timer.getDelta();
        updatePlanePhysics({ planeState, keyboard, planePhysics, delta });

        if (planeState.isCrashed) {
            if (!wasCrashed) {
                crashElapsed = 0;
                wasCrashed = true;
                crashOverlayElement.hidden = false;
                crashEffect.trigger(airplane.position);
            }

            crashElapsed += delta;
            crashEffect.update(crashElapsed);

            if (crashElapsed >= CRASH_RESTART_DELAY) {
                resetPlaneState(planeState);
                crashOverlayElement.hidden = true;
                crashEffect.hide();
                wasCrashed = false;
            }
        }

        updateAirplaneControlSurfaces({ airplane, keyboard, delta });
        syncPlaneMesh({ airplane, propeller, planeState });
        updateCamera({ camera, controls, airplane, cameraMode });
        hud.update({ planeState, cameraMode });

        renderer.render(scene, camera);
    }

    requestAnimationFrame(animate);
}

try {
    startApp();
} catch (error) {
    reportRuntimeError(error);
}
