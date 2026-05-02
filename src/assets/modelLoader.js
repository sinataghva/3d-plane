import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

/**
 * Loads a GLTF or GLB model from a Vite-served URL.
 *
 * Model files intended to keep stable public URLs should live under
 * `public/models` and be referenced as `/models/file-name.glb`.
 *
 * @param {string} url
 * @returns {Promise<import('three/addons/loaders/GLTFLoader.js').GLTF>}
 */
export function loadGltfModel(url) {
    return gltfLoader.loadAsync(url);
}
