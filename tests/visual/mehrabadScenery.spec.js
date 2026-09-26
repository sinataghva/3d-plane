import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
    test(`Mehrabad static scenery ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        const page = await browser.newPage({
            viewport: mobile
                ? { width: 844, height: 390 }
                : { width: 1280, height: 720 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**/__mehrabad-test', (route) =>
            route.fulfill({
                contentType: 'text/html',
                body: '<body style="margin:0"><div id="canvas-container" style="width:100vw;height:100vh"></div></body>'
            })
        );
        await page.goto('http://127.0.0.1:5173/3d-plane/__mehrabad-test');
        const stats = await page.evaluate(async () => {
            const [
                { createGeography },
                { createTerrain },
                { createParkedAircraft },
                { createScene },
                { createGroundDetail }
            ] = await Promise.all([
                import('/3d-plane/src/scenery/geography.js'),
                import('/3d-plane/src/scenery/terrain.js'),
                import('/3d-plane/src/scenery/parkedAircraft.js'),
                import('/3d-plane/src/rendering/scene.js'),
                import('/3d-plane/src/scenery/groundDetail.js')
            ]);
            const [data, dem] = await Promise.all(
                ['map', 'elevation'].map((n) =>
                    fetch(`/3d-plane/data/tehran/${n}.json`).then((r) =>
                        r.json()
                    )
                )
            );
            const world = createGeography(data, dem, {
                icao: 'OIII',
                runwayRef: '11R/29L'
            });
            const { scene, camera, renderer, controls } = createScene({
                container: document.getElementById('canvas-container')
            });
            const terrain = createTerrain(world),
                parked = createParkedAircraft(world);
            const detail = createGroundDetail(world);
            scene.add(terrain, parked.group, detail.group);
            window.mehrabadTest = {
                world,
                scene,
                camera,
                renderer,
                controls,
                detail,
                parked
            };
            return {
                count: parked.spots.length,
                fighters: parked.spots.filter((p) => p.radius < 10).length,
                airliners: parked.spots.filter((p) => p.radius > 10).length,
                buildings: terrain.userData.summary.detailedAirfieldBuildings
            };
        });
        expect(stats.count).toBeGreaterThan(8);
        expect(stats.count).toBeLessThanOrEqual(14);
        expect(stats.fighters).toBe(8);
        expect(stats.airliners).toBe(3);
        expect(stats.buildings).toBeGreaterThan(0);
        for (const type of ['f5', 'airliner']) {
            const draws = await page.evaluate((type) => {
                const { world, scene, camera, renderer, parked, detail } =
                    window.mehrabadTest;
                const p = parked.spots.find((p) =>
                    type === 'f5' ? p.radius < 10 : p.radius > 10
                );
                const y = world.height(p.x, p.z);
                camera.position.set(
                    p.x + (type === 'f5' ? 24 : 55),
                    y + (type === 'f5' ? 15 : 30),
                    p.z + (type === 'f5' ? 24 : 55)
                );
                camera.lookAt(p.x, y + 2, p.z);
                scene.userData.followSun(camera.position);
                parked.update(camera.position, 'high');
                for (let i = 0; i < 120; i++)
                    detail.update(camera.position, 'high', 0.1, 0);
                renderer.render(scene, camera);
                return renderer.info.render.calls;
            }, type);
            expect(draws).toBeLessThan(2000);
            await page.screenshot({ path: info.outputPath(`${type}.png`) });
        }
        expect(errors).toEqual([]);
        await page.evaluate(() => {
            const { scene, renderer, controls, detail } = window.mehrabadTest;
            detail.dispose();
            const geometries = new Set(),
                materials = new Set();
            scene.traverse((o) => {
                if (o.geometry) geometries.add(o.geometry);
                if (o.material)
                    for (const m of Array.isArray(o.material)
                        ? o.material
                        : [o.material])
                        materials.add(m);
            });
            geometries.forEach((g) => g.dispose());
            materials.forEach((m) => {
                Object.values(m).forEach((v) => {
                    if (v?.isTexture) v.dispose();
                });
                m.dispose();
            });
            controls.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
        });
        await page.close();
    });
}
