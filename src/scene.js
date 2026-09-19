import * as THREE from 'three';
import { getRenderQuality } from './renderQuality.js';
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
    scene.fog = new THREE.Fog(0xd9edf7, 2400, 12000);
    scene.add(createSunSprite());

    const camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        18000
    );
    camera.position.set(10, 5, -120);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
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
    scene.add(directionalLight, directionalLight.target);
    const sunOffset = new THREE.Vector3(70, 110, -80);
    scene.userData.followSun = (/** @type {THREE.Vector3} */ position) => {
        directionalLight.position.copy(position).add(sunOffset);
        directionalLight.target.position.copy(position);
    };

    const qualitySelect = document.getElementById('graphics-quality');
    let quality = 'high';
    try {
        const saved = localStorage.getItem('plane-graphics-quality');
        if (saved && ['low', 'balanced', 'high'].includes(saved))
            quality = saved;
    } catch {
        /* Storage may be disabled. */
    }
    // Keep screenshot fixtures independent of a user's persisted graphics setting.
    if (new URLSearchParams(location.search).has('visual')) quality = 'high';
    const applyQuality = () => {
        const settings = getRenderQuality(quality, window.devicePixelRatio);
        scene.userData.quality = quality;
        renderer.setPixelRatio(settings.pixelRatio);
        if (renderer.shadowMap.enabled !== settings.shadows) {
            renderer.shadowMap.enabled = settings.shadows;
            scene.traverse((object) => {
                if (!(object instanceof THREE.Mesh)) return;
                const materials = Array.isArray(object.material)
                    ? object.material
                    : [object.material];
                for (const material of materials) material.needsUpdate = true;
            });
        }
        if (directionalLight.shadow.mapSize.width !== settings.shadowSize) {
            directionalLight.shadow.map?.dispose();
            directionalLight.shadow.map = null;
            directionalLight.shadow.mapSize.set(
                settings.shadowSize,
                settings.shadowSize
            );
        }
        renderer.shadowMap.needsUpdate = true;
    };
    applyQuality();
    if (qualitySelect instanceof HTMLSelectElement) {
        qualitySelect.value = quality;
        qualitySelect.addEventListener('change', () => {
            quality = qualitySelect.value;
            applyQuality();
            try {
                localStorage.setItem('plane-graphics-quality', quality);
            } catch {
                /* Optional persistence. */
            }
        });
    }

    const resize = () => {
        applyQuality();
        const rect = renderer.domElement.parentElement?.getBoundingClientRect();
        const width = rect?.width || window.innerWidth;
        const height = rect?.height || window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('pageshow', resize);
    resize();

    return { scene, camera, renderer, controls };
}
