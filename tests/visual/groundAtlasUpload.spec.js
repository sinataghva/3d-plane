import { test, expect } from '@playwright/test';

test('partial canvas uploads match a complete CPU-backed upload, including cropped strips and wrap edges', async ({
    page
}) => {
    await page.goto('/3d-plane/');
    const result = await page.evaluate(async () => {
        const THREE =
            await import('/3d-plane/node_modules/three/build/three.module.js');
        const { createGroundAtlas } =
            await import('/3d-plane/src/scenery/groundAtlas.js');
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(128, 128);
        const staging = document.createElement('canvas');
        const atlas = createGroundAtlas(128, staging, renderer);
        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
        camera.position.z = 1;
        const geometry = new THREE.PlaneGeometry(2, 2);
        const material = new THREE.MeshBasicMaterial({ map: atlas.texture });
        scene.add(new THREE.Mesh(geometry, material));
        const target = new THREE.WebGLRenderTarget(128, 128);
        renderer.setRenderTarget(target);
        const samples = [];
        for (const [x, y, w, h] of [
            [0, 0, 128, 128],
            [4, 7, 16, 32],
            [120, 0, 8, 80],
            [0, 120, 87, 8],
            [57, 53, 5, 9]
        ]) {
            staging.width = w + 4;
            staging.height = h + 4;
            const ctx = staging.getContext('2d');
            // Asymmetric pattern exposes both row reversal and wrong offsets.
            for (let row = 0; row < h + 4; row++)
                for (let col = 0; col < w + 4; col++) {
                    ctx.fillStyle = `rgb(${(row * 13 + x) % 256},${(col * 7 + y) % 256},${(col + row * 3) % 256})`;
                    ctx.fillRect(col, row, 1, 1);
                }
            atlas.upload(x, y, w, h, 2);
            renderer.render(scene, camera);
            const partial = new Uint8Array(128 * 128 * 4);
            renderer.readRenderTargetPixels(target, 0, 0, 128, 128, partial);
            atlas.texture.needsUpdate = true;
            renderer.render(scene, camera);
            const full = new Uint8Array(partial.length);
            renderer.readRenderTargetPixels(target, 0, 0, 128, 128, full);
            samples.push(
                partial.reduce((sum, v, i) => sum + (v !== full[i] ? 1 : 0), 0)
            );
        }
        atlas.dispose();
        target.dispose();
        material.dispose();
        geometry.dispose();
        renderer.dispose();
        return samples;
    });
    expect(result).toEqual([0, 0, 0, 0, 0]);
});

test('Tehran photo detail follows the camera and returns to the aircraft on exit', async ({
    page
}) => {
    test.setTimeout(90000);
    await page.route('**/src/main.js*', async (route) => {
        const response = await route.fetch();
        const body = (await response.text()).replace(
            'groundTexture.update(\n            detailPosition,',
            'window.__detailAnchor = {anchor:{...detailPosition}, camera:camera.position.toArray(), aircraft:{...viewedState.position}}; groundTexture.update(\n            detailPosition,'
        );
        await route.fulfill({ response, body });
    });
    await page.goto('/3d-plane/?mission=tehran');
    await page.waitForFunction(() => window.__detailAnchor);
    await page.locator('#photo-button').click();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const a = window.__detailAnchor;
                return Math.hypot(
                    a.anchor.x - a.camera[0],
                    a.anchor.y - a.camera[1],
                    a.anchor.z - a.camera[2]
                );
            })
        )
        .toBe(0);
    const offset = await page.evaluate(() => {
        const a = window.__detailAnchor;
        return Math.hypot(
            a.anchor.x - a.aircraft.x,
            a.anchor.y - a.aircraft.y,
            a.anchor.z - a.aircraft.z
        );
    });
    expect(offset).toBeGreaterThan(1);
    await page.locator('#photo-exit').click();
    await expect
        .poll(() =>
            page.evaluate(() => {
                const a = window.__detailAnchor;
                return Math.hypot(
                    a.anchor.x - a.aircraft.x,
                    a.anchor.y - a.aircraft.y,
                    a.anchor.z - a.aircraft.z
                );
            })
        )
        .toBe(0);
});
