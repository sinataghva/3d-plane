import './styles.css';

import { createAirplane } from './airplane.js';
import { createAirbase } from './airbase.js';
import { addClouds } from './clouds.js';
import { createCameraModeToggle, updateCamera } from './camera.js';
import { createHud } from './hud.js';
import { createKeyboardState } from './input.js';
import { createPlanePhysics, updatePlanePhysics } from './physics.js';
import { createScene } from './scene.js';

const container = document.getElementById('canvas-container');
const { scene, camera, renderer, controls } = createScene({ container });

const { airplane, propeller } = createAirplane();
airplane.position.set(0, 0.5, -120);
airplane.rotation.y = -Math.PI / 2;
scene.add(airplane);

const airbase = createAirbase();
airbase.position.y = -0.5;
scene.add(airbase);

addClouds(scene);

const keyboard = createKeyboardState();
const planePhysics = createPlanePhysics();
const cameraMode = createCameraModeToggle();
const hud = createHud();

function animate() {
    requestAnimationFrame(animate);

    updatePlanePhysics({ airplane, propeller, keyboard, planePhysics });
    updateCamera({ camera, controls, airplane, cameraMode });
    hud.update({ airplane, planePhysics });

    renderer.render(scene, camera);
}

animate();
