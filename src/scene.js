import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * @typedef {object} SceneContext
 * @property {THREE.Scene} scene
 * @property {THREE.PerspectiveCamera} camera
 * @property {THREE.WebGLRenderer} renderer
 * @property {OrbitControls} controls
 */

/**
 * @returns {THREE.CanvasTexture | THREE.Color}
 */
function createSkyBackground() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 256;

    const context = canvas.getContext('2d');
    if (!context) {
        return new THREE.Color(0xd8ecff);
    }

    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#78b7ee');
    gradient.addColorStop(0.48, '#c7e4ff');
    gradient.addColorStop(0.72, '#edf6ff');
    gradient.addColorStop(1, '#f7f1dc');

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

/**
 * @returns {THREE.Sprite}
 */
function createSunSprite() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;

    const context = canvas.getContext('2d');
    if (!context) {
        const fallbackTexture = new THREE.Texture();
        return new THREE.Sprite(
            new THREE.SpriteMaterial({ map: fallbackTexture })
        );
    }

    const glow = context.createRadialGradient(64, 64, 8, 64, 64, 62);
    glow.addColorStop(0, 'rgba(255, 250, 214, 1)');
    glow.addColorStop(0.3, 'rgba(255, 224, 128, 0.82)');
    glow.addColorStop(0.68, 'rgba(255, 190, 84, 0.22)');
    glow.addColorStop(1, 'rgba(255, 190, 84, 0)');

    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sunMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.92,
        depthTest: false,
        depthWrite: false,
        fog: false
    });
    const sun = new THREE.Sprite(sunMaterial);
    sun.position.set(1800, 940, -2300);
    sun.scale.set(220, 220, 1);
    sun.renderOrder = -10;
    return sun;
}

/**
 * @param {{ container: HTMLElement }} args
 * @returns {SceneContext}
 */
export function createScene({ container }) {
    const scene = new THREE.Scene();
    scene.background = createSkyBackground();
    scene.fog = new THREE.Fog(0xd9edf7, 180, 900);
    scene.add(createSunSprite());

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        5000
    );
    camera.position.set(10, 5, -120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 100;

    const hemisphereLight = new THREE.HemisphereLight(0xcfe8ff, 0x496238, 1.15);
    scene.add(hemisphereLight);

    const directionalLight = new THREE.DirectionalLight(0xfff2c7, 1.75);
    directionalLight.position.set(70, 110, -80);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 1;
    directionalLight.shadow.camera.far = 280;
    directionalLight.shadow.camera.left = -140;
    directionalLight.shadow.camera.right = 140;
    directionalLight.shadow.camera.top = 140;
    directionalLight.shadow.camera.bottom = -140;
    scene.add(directionalLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return { scene, camera, renderer, controls };
}
