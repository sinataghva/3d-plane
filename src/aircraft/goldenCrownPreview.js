import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
    createGoldenCrownSerial,
    goldenCrownSerial
} from './goldenCrownSerial.js';
import { createGoldenCrownNumber } from './goldenCrownNumber.js';
import { createGoldenCrown } from './goldenCrown.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdce4e4);
scene.fog = new THREE.Fog(0xdce4e4, 55, 135);
const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
document.body.prepend(renderer.domElement);
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 250);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.25, 0);
controls.enableDamping = true;
controls.minDistance = 10;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI / 2 - 0.015;
scene.add(new THREE.HemisphereLight(0xe6f4ff, 0x68796d, 2.5));
const sun = new THREE.DirectionalLight(0xfff4df, 4);
sun.position.set(6, 15, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, {
    left: -12,
    right: 12,
    top: 12,
    bottom: -12,
    near: 1,
    far: 45
});
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 3;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xb2d7ee, 1.2);
fill.position.set(-5, 6, -10);
scene.add(fill);
const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400),
    new THREE.MeshStandardMaterial({ color: 0xa6b8b7, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.005;
ground.receiveShadow = true;
scene.add(ground);
// Fine apron joints and a restrained guide stripe place the model at human scale.
const jointMaterial = new THREE.MeshStandardMaterial({
    color: 0x91a5a5,
    roughness: 1
});
for (let i = -6; i <= 6; i++) {
    for (const rotate of [false, true]) {
        const seam = new THREE.Mesh(
            new THREE.PlaneGeometry(0.013, 100),
            jointMaterial
        );
        seam.rotation.x = -Math.PI / 2;
        seam.position.set(rotate ? 0 : i * 6, 0.001, rotate ? i * 6 : 0);
        if (rotate) seam.rotation.z = Math.PI / 2;
        scene.add(seam);
    }
}
const { airplane, gear } = createGoldenCrown();
scene.add(airplane);
document
    .getElementById('aircraft-number')
    ?.addEventListener('change', (event) => {
        const number = Number(
            /** @type {HTMLSelectElement} */ (event.currentTarget).value
        );
        airplane.traverse((object) => {
            if (
                !(object instanceof THREE.Mesh) ||
                (!object.userData.displayNumber &&
                    !object.userData.displaySerial)
            )
                return;
            const material = /** @type {THREE.MeshBasicMaterial} */ (
                object.material
            );
            material.map?.dispose();
            material.dispose();
            if (object.userData.displaySerial) {
                object.material = createGoldenCrownSerial(
                    number,
                    object.userData.displaySerial
                );
                object.name = goldenCrownSerial(
                    number,
                    object.userData.displaySerial
                );
            } else {
                object.material = createGoldenCrownNumber(
                    number,
                    object.userData.displayNumber
                );
            }
        });
        document.documentElement.dataset.aircraftNumber = String(number);
    });
/** @type {Record<string, number[]>} */
const views = {
    hero: [14, 8, 17],
    crown: [2.04, 2.0, -3.1],
    tail: [-5.25, 3.0, -6.5],
    tailPersian: [-5.25, 3.0, 6.5],
    side: [0, 4.1, 23],
    opposite: [0, 4.1, -23],
    top: [0, 24, 0.01],
    underside: [0, 24, 0.01],
    rear: [-16, 6.7, 13]
};
let currentView = 'hero';
/** @param {string} view */
function setView(view) {
    currentView = view;
    airplane.rotation.x = view === 'underside' ? Math.PI : 0;
    airplane.position.y = view === 'underside' ? 3.28 : 0;
    const position = new THREE.Vector3(...views[view]);
    if (innerWidth / innerHeight < 1.1) position.multiplyScalar(1.45);
    camera.position.copy(position);
    controls.minDistance = ['crown', 'tail', 'tailPersian'].includes(view)
        ? 1
        : 10;
    controls.target.fromArray(
        view === 'crown'
            ? [2.04, 1.82, 0]
            : view.startsWith('tail')
              ? [-5.25, 3.0, 0]
              : [0, 1.25, 0]
    );
    controls.update();
    document
        .querySelectorAll('button[data-view]')
        .forEach((button) =>
            button.setAttribute(
                'aria-pressed',
                String(button.getAttribute('data-view') === view)
            )
        );
    document.documentElement.dataset.view = view;
}
document
    .querySelectorAll('button[data-view]')
    .forEach((button) =>
        button.addEventListener('click', () =>
            setView(button.getAttribute('data-view') || 'hero')
        )
    );
document.getElementById('gear')?.addEventListener('click', (event) => {
    gear.visible = !gear.visible;
    const button = /** @type {HTMLElement} */ (event.currentTarget);
    button.setAttribute('aria-pressed', String(gear.visible));
});
function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    setView(currentView);
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
    document.documentElement.dataset.visualReady = String(
        airplane.userData.markingsReady === true
    );
});
