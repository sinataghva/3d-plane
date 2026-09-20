import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('water time pauses with settings and resumes without a jump', async ({
    page
}) => {
    const errors = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/3d-plane/?mission=luxeuil');
    const time = () =>
        page.evaluate(
            () =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                ).waterAnimationTime
        );
    await page.waitForFunction(
        () =>
            JSON.parse(document.documentElement.dataset.sceneryStats || '{}')
                .waterAnimationTime > 0.1
    );
    await page.locator('#settings-button').click();
    await page.waitForTimeout(1300);
    const paused = await time();
    await page.waitForTimeout(1300);
    expect(await time()).toBe(paused);
    await page.keyboard.press('p');
    await page.waitForTimeout(1500);
    const resumed = await time();
    expect(resumed).toBeGreaterThan(paused);
    expect(resumed - paused).toBeLessThan(2);
    expect(errors).toEqual([]);
});

for (const mission of ['saint-cyr', 'luxeuil'])
    test(`${mission} water animation and rendering cost`, async ({
        page
    }, info) => {
        test.setTimeout(90000);
        const errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });
        await page.goto(`/3d-plane/?mission=${mission}&visual=water-detail`);
        await page.waitForFunction(
            () => document.documentElement.dataset.visualReady === 'true'
        );
        const result = await page.evaluate(async () => {
            const resources = performance
                .getEntriesByType('resource')
                .map((r) => r.name);
            const THREE = await import(
                resources.find((n) => /\/three\.js(?:\?|$)/.test(n))
            );
            const { getGeography } = await import(
                resources.find((n) => /\/src\/geography\.js(?:\?|$)/.test(n))
            );
            const { createGroundDetail } =
                await import('/3d-plane/src/groundDetail.js');
            const world = getGeography();
            const f = world.data.features.find(
                (f) =>
                    f.kind === 'water' &&
                    /Grand Canal|Sept Chevaux/i.test(f.name)
            );
            const [x, z] = f.points[Math.floor(f.points.length / 2)];
            const position = { x, y: world.height(x, z) + 15, z };
            const detail = createGroundDetail(world);
            for (let i = 0; i < 120; i++) detail.update(position, 'high', 0.1);
            const scene = new THREE.Scene();
            scene.background = new THREE.Color(0x798b62);
            scene.add(detail.group);
            scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x496238, 1.15));
            const sun = new THREE.DirectionalLight(0xfff2c7, 1.75);
            sun.position.set(70, 110, -80);
            scene.add(sun);
            const camera = new THREE.PerspectiveCamera(55, 960 / 540, 1, 6000);
            camera.position.set(x + 30, position.y + 25, z + 35);
            camera.lookAt(x, position.y - 15, z);
            const renderer = new THREE.WebGLRenderer({
                antialias: true,
                preserveDrawingBuffer: true
            });
            renderer.setSize(960, 540);
            renderer.setPixelRatio(1);
            const gl = renderer.getContext();
            const render = () => renderer.render(scene, camera);
            const image = () => {
                render();
                return renderer.domElement.toDataURL();
            };
            const snapshots = {};
            snapshots.high0 = image();
            for (let i = 0; i < 80; i++)
                detail.waterEffects.update(0.1, 'high');
            snapshots.high8 = image();
            const geometry = renderer.info.memory.geometries;
            const calls = renderer.info.render.calls;
            detail.waterEffects.update(0, 'balanced');
            snapshots.balanced = image();
            detail.waterEffects.update(0, 'high');
            const originals = [];
            detail.group.traverse((o) => {
                if (o.isMesh && o.material.userData.kind === 'water')
                    originals.push([o, o.material]);
            });
            const measure = () => {
                for (let i = 0; i < 8; i++) render();
                gl.finish();
                const times = [];
                for (let i = 0; i < 24; i++) {
                    const start = performance.now();
                    render();
                    gl.finish();
                    times.push(performance.now() - start);
                }
                times.sort((a, b) => a - b);
                return {
                    medianMs: times[12],
                    p95Ms: times[22],
                    calls: renderer.info.render.calls,
                    geometries: renderer.info.memory.geometries
                };
            };
            const high = measure();
            detail.waterEffects.update(0, 'balanced');
            const balanced = measure();
            for (const [mesh, material] of originals) {
                const plain = material.clone();
                plain.onBeforeCompile = () => {};
                plain.customProgramCacheKey = () => '';
                plain.roughness = 1;
                mesh.material = plain;
            }
            snapshots.static = image();
            const staticWater = measure();
            for (const [mesh, material] of originals) {
                mesh.material.dispose();
                mesh.material = material;
            }
            for (let i = 0; i < 6; i++) {
                detail.waterEffects.update(0, i % 2 ? 'high' : 'balanced');
                render();
            }
            const programs = renderer.info.programs.length;
            const textureCount = renderer.info.memory.textures;
            const watched = new Set([
                detail.waterEffects.uniforms.waterRipples.value
            ]);
            detail.group.traverse((o) => {
                if (o.isMesh)
                    for (const key of ['map', 'bumpMap'])
                        if (o.material[key]) watched.add(o.material[key]);
            });
            detail.dispose();
            render();
            const afterDispose = {
                geometries: renderer.info.memory.geometries,
                textures: renderer.info.memory.textures,
                remaining: [...watched]
                    .filter((t) => renderer.properties.get(t).__webglTexture)
                    .map((t) => ({
                        name: t.name,
                        width: t.image?.width,
                        height: t.image?.height
                    }))
            };
            // Repeat a world lifecycle on the same renderer: distinguish renderer
            // retained resources from allocations that accumulate per mission.
            const lifecycleCounts = [afterDispose.textures];
            for (let cycle = 0; cycle < 2; cycle++) {
                const next = createGroundDetail(world);
                scene.add(next.group);
                for (let i = 0; i < 120; i++)
                    next.update(position, 'high', 0.1);
                render();
                next.dispose();
                scene.remove(next.group);
                render();
                lifecycleCounts.push(renderer.info.memory.textures);
            }
            const gpuTimerAvailable = !!gl.getExtension(
                'EXT_disjoint_timer_query_webgl2'
            );
            renderer.dispose();
            renderer.forceContextLoss();
            return {
                snapshots,
                high,
                balanced,
                staticWater,
                geometry,
                calls,
                programs,
                textureCount,
                afterDispose,
                gpuTimerAvailable,
                lifecycleCounts
            };
        });
        for (const [name, data] of Object.entries(result.snapshots))
            await writeFile(
                info.outputPath(name + '.png'),
                Buffer.from(data.split(',')[1], 'base64')
            );
        await writeFile(
            info.outputPath('render-cost.json'),
            JSON.stringify({ ...result, snapshots: undefined }, null, 2)
        );
        expect(result.snapshots.high0).not.toBe(result.snapshots.high8);
        expect(result.snapshots.high0).not.toBe(result.snapshots.balanced);
        expect(result.high.calls).toBe(result.staticWater.calls);
        expect(result.high.geometries).toBe(result.staticWater.geometries);
        expect(result.afterDispose.geometries).toBe(0);
        expect(result.afterDispose.remaining).toEqual([]);
        expect(new Set(result.lifecycleCounts).size).toBe(1);
        expect(result.programs).toBeLessThanOrEqual(4);
        expect(errors).toEqual([]);
        delete result.snapshots;
        await info.attach('render-cost', {
            body: JSON.stringify(result, null, 2),
            contentType: 'application/json'
        });
    });
