import { test, expect } from '@playwright/test';

test('Phantom eighteen-store layout from below and on its wheels', async ({
    page
}, info) => {
    await page.goto('/3d-plane/');
    const count = await page.evaluate(async () => {
        const { createPhantom } =
            await import('/3d-plane/src/aircraft/phantom.js');
        const { createPhantomRacks, BOMB_MOUNTS } =
            await import('/3d-plane/src/aircraft/phantomLoadout.js');
        const { createBombGeometry } =
            await import('/3d-plane/src/aircraft/bombModel.js');
        const resources = performance
            .getEntriesByType('resource')
            .map((r) => r.name);
        const THREE = await import(
            resources.find((n) => /\/three\.js(?:\?|$)/.test(n))
        );
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xcad2d2);
        const { airplane } = createPhantom();
        airplane.add(createPhantomRacks().group);
        const geometry = createBombGeometry();
        const material = new THREE.MeshStandardMaterial({ color: 0x81834e });
        for (const p of BOMB_MOUNTS) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(...p);
            airplane.add(mesh);
        }
        scene.add(airplane, new THREE.HemisphereLight(0xffffff, 0x889099, 3));
        const light = new THREE.DirectionalLight(0xffffff, 3);
        light.position.set(10, -15, 10);
        scene.add(light);
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            preserveDrawingBuffer: true
        });
        renderer.setSize(1280, 720);
        renderer.domElement.style.cssText =
            'position:fixed;inset:0;z-index:999999;visibility:visible';
        const camera = new THREE.OrthographicCamera(
            -19.5,
            19.5,
            11,
            -11,
            0.1,
            100
        );
        camera.position.set(0, -25, 0);
        camera.up.set(1, 0, 0);
        camera.lookAt(0, 0, 0);
        document.body.replaceChildren(renderer.domElement);
        renderer.render(scene, camera);
        window.loadoutReview = { renderer, scene, camera, light };
        return BOMB_MOUNTS.length;
    });
    expect(count).toBe(18);
    await page.screenshot({ path: info.outputPath('underside.png') });
    await page.evaluate(() => {
        const { renderer, scene, camera } = window.loadoutReview;
        camera.left = -11;
        camera.right = 11;
        camera.top = 6.2;
        camera.bottom = -6.2;
        camera.updateProjectionMatrix();
        camera.up.set(0, 1, 0);
        camera.position.set(14, 3, 22);
        camera.lookAt(0, 1, 0);
        renderer.render(scene, camera);
    });
    await page.screenshot({ path: info.outputPath('front-quarter.png') });
    for (const side of [-1, 1]) {
        await page.evaluate((side) => {
            const { renderer, scene, camera, light } = window.loadoutReview;
            light.position.set(8, 15, side * 12);
            camera.left = -8;
            camera.right = 8;
            camera.top = 4.5;
            camera.bottom = -4.5;
            camera.updateProjectionMatrix();
            camera.position.set(0, 3.2, side * 25);
            camera.lookAt(-0.4, 1.6, 0);
            renderer.render(scene, camera);
        }, side);
        await page.screenshot({
            path: info.outputPath(`markings-${side}.png`)
        });
    }
    await page.evaluate(() => {
        const { renderer, scene, camera, light } = window.loadoutReview;
        light.position.set(8, 15, 12);
        camera.left = -3.5;
        camera.right = 3.5;
        camera.top = 1.97;
        camera.bottom = -1.97;
        camera.updateProjectionMatrix();
        camera.position.set(8, 6, 14);
        camera.lookAt(2, 1.9, 0);
        renderer.render(scene, camera);
    });
    await page.screenshot({ path: info.outputPath('canopy.png') });
    await page.evaluate(() => {
        const { renderer, scene, camera } = window.loadoutReview;
        camera.position.set(2, 1.9, -25);
        camera.lookAt(2, 1.9, 0);
        renderer.render(scene, camera);
    });
    await page.screenshot({ path: info.outputPath('canopy-side.png') });
    for (const side of [-1, 1]) {
        for (const shadows of [false, true]) {
            await page.evaluate(
                ({ side, shadows }) => {
                    const { renderer, scene, camera, light } =
                        window.loadoutReview;
                    const hemisphere = scene.children.find(
                        (o) => o.isHemisphereLight
                    );
                    hemisphere.color.setHex(0xcfe8ff);
                    hemisphere.groundColor.setHex(0x496238);
                    hemisphere.intensity = 1.15;
                    light.color.setHex(0xfff2c7);
                    light.intensity = 1.75;
                    light.position.set(70, 110, side * 80);
                    light.castShadow = shadows;
                    light.shadow.mapSize.set(2048, 2048);
                    light.shadow.normalBias = 0.18;
                    light.shadow.bias = -0.00005;
                    Object.assign(light.shadow.camera, {
                        near: 1,
                        far: 280,
                        left: -140,
                        right: 140,
                        top: 140,
                        bottom: -140
                    });
                    light.shadow.camera.updateProjectionMatrix();
                    renderer.shadowMap.enabled = true;
                    camera.left = -9;
                    camera.right = 9;
                    camera.top = 5.06;
                    camera.bottom = -5.06;
                    camera.updateProjectionMatrix();
                    camera.position.set(8, 4, side * 25);
                    camera.lookAt(0, 1.5, 0);
                    scene.traverse((o) => {
                        if (o.material) o.material.needsUpdate = true;
                    });
                    renderer.render(scene, camera);
                },
                { side, shadows }
            );
            await page.screenshot({
                path: info.outputPath(`intake-${side}-shadows-${shadows}.png`)
            });
        }
    }
});
