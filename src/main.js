import './styles.css';

import * as THREE from 'three';

import { createAirplane } from './airplane.js';
import { createAirbase } from './airbase.js';
import { addClouds } from './clouds.js';
import { createCameraModeToggle, updateCamera } from './camera.js';
import { createHud } from './hud.js';
import { createKeyboardState } from './input.js';
import { createPlanePhysics, createPlaneState, syncPlaneMesh, updatePlanePhysics } from './physics.js';
import { createScene } from './scene.js';

const container = document.getElementById('canvas-container');
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
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    updatePlanePhysics({ planeState, keyboard, planePhysics, delta });
    syncPlaneMesh({ airplane, propeller, planeState });
    updateCamera({ camera, controls, airplane, cameraMode });
    hud.update({ planeState });

    renderer.render(scene, camera);
}

animate();
