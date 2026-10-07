import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('soft clouds blend behind nearby smoke and in front of distant smoke', async ({
    page
}, info) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/3d-plane/');
    const result = await page.evaluate(async () => {
        const { addClouds } = await import('/3d-plane/src/effects/clouds.js');
        const { createLayeredSmoke, transparentLayer } =
            await import('/3d-plane/src/rendering/transparency.js');
        const resources = performance
            .getEntriesByType('resource')
            .map((r) => r.name);
        const THREE = await import(
            resources.find((n) => /\/three\.js(?:\?|$)/.test(n))
        );
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(240, 160);
        renderer.setPixelRatio(1);
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x4488cc);
        const camera = new THREE.PerspectiveCamera(45, 1.5, 1, 2000);
        const texture = new THREE.DataTexture(
            new Uint8Array([255, 255, 255, 255]),
            1,
            1
        );
        texture.needsUpdate = true;
        const clouds = addClouds(scene, texture);
        clouds.update(0, camera);
        // Isolate one cloud puff at a known depth using the production shader.
        const batches = scene.children[0].children;
        for (const mesh of batches) {
            mesh.count = 0;
            mesh.visible = false;
        }
        const cloud = batches[transparentLayer(500)];
        cloud.count = 1;
        cloud.visible = true;
        cloud.setMatrixAt(
            0,
            new THREE.Matrix4().compose(
                new THREE.Vector3(0, 0, -500),
                new THREE.Quaternion(),
                new THREE.Vector3(500, 500, 1)
            )
        );
        cloud.instanceMatrix.needsUpdate = true;
        cloud.geometry.attributes.cloudOpacity.setX(0, 0.8);
        cloud.geometry.attributes.cloudOpacity.needsUpdate = true;
        cloud.geometry.attributes.cloudVariant.setX(0, 0);
        cloud.geometry.attributes.cloudVariant.needsUpdate = true;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
                [-100, -100, 0, 100, -100, 0, -100, 100, 0, 100, 100, 0],
                3
            )
        );
        geometry.setIndex([0, 1, 2, 1, 3, 2]);
        const smoke = createLayeredSmoke(
            geometry,
            new THREE.MeshBasicMaterial({
                color: 0xff0000,
                transparent: true,
                opacity: 0.6,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        scene.add(smoke.group);
        const pixel = new Uint8Array(4);
        const gl = renderer.getContext();
        const capture = (depth) => {
            smoke.group.position.z = -depth;
            smoke.update(camera);
            renderer.render(scene, camera);
            gl.readPixels(120, 80, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
            return {
                pixel: [...pixel],
                image: renderer.domElement.toDataURL()
            };
        };
        const front = capture(200);
        const behind = capture(800);
        renderer.dispose();
        return { front, behind };
    });
    // A foreground white cloud washes out the red; a background cloud must not.
    expect(result.front.pixel[1]).toBeLessThan(result.behind.pixel[1] - 50);
    expect(result.front.pixel[0]).toBeGreaterThan(result.front.pixel[1] + 60);
    expect(errors).toEqual([]);
    for (const [name, shot] of Object.entries(result))
        await writeFile(
            info.outputPath(`smoke-${name}-cloud.png`),
            Buffer.from(shot.image.split(',')[1], 'base64')
        );
});
