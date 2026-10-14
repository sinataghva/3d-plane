import * as THREE from 'three';

/** CPU backing is retained for context restoration. Only dirty rectangles are
 * copied during normal rendering; staging never owns a GPU allocation.
 * @param {number} size @param {HTMLCanvasElement} staging
 * @param {THREE.WebGLRenderer} [renderer] */
export function createGroundAtlas(size, staging, renderer) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.anisotropy = 4;
    const source = new THREE.Texture(staging);
    const region = new THREE.Box2();
    const destination = new THREE.Vector2();
    let initialized = false;
    return {
        texture,
        canvas,
        /** @param {number} x @param {number} y @param {number} width
         * @param {number} height @param {number} [inset] */
        upload(x, y, width, height, inset = 0) {
            ctx?.drawImage(
                staging,
                inset,
                inset,
                width,
                height,
                x,
                y,
                width,
                height
            );
            if (!renderer || renderer.getContext().isContextLost()) {
                texture.needsUpdate = true;
                initialized = false;
                return size * size * 4;
            }
            // The CPU mirror also lets Three restore the complete texture after
            // context loss, including changes made while the context was lost.
            if (!initialized) {
                // A render may already have recreated this texture after context
                // restoration. Include the rectangle just written to its mirror.
                texture.needsUpdate = true;
                renderer.initTexture(texture);
                initialized = true;
                return size * size * 4;
            }
            region.min.set(inset, inset);
            region.max.set(inset + width, inset + height);
            destination.set(x, size - y - height);
            renderer.copyTextureToTexture(source, texture, region, destination);
            return width * height * 4;
        },
        dispose() {
            source.dispose();
            texture.dispose();
            canvas.width = canvas.height = 0;
        }
    };
}
