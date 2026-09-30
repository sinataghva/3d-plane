import { test, expect } from '@playwright/test';
test.setTimeout(120000);
async function prepare(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('**/src/main.js*', async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body = body
            .replace(
                'Object.assign(window, { planeAutomation: automation });',
                `Object.assign(window, { planeAutomation: automation });
        window.structureTest={world,roadStructures,roadTraffic,airbase,config:null,
        place(){if(!this.config)return;const {x,z,agl,heading=0}=this.config;planeState.position={x,z,y:world.height(x,z)+agl};airplane.visible=false;camera.position.set(x+Math.sin(heading)*110,world.height(x,z)+agl,z+Math.cos(heading)*110);camera.lookAt(x,world.height(x,z),z)}};`
            )
            .replace(
                'if (trafficBench) trafficBench.position();',
                'window.structureTest?.place();\nif (trafficBench) trafficBench.position();'
            );
        await route.fulfill({ response, body });
    });
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await page.waitForFunction(() => window.structureTest);
    return errors;
}
test('Tehran bridge geometry remains bounded and vehicles use elevated and lower roads', async ({
    page
}, info) => {
    const errors = await prepare(page);
    const stats = await page.evaluate(() => {
        const t = window.structureTest;
        t.config = { x: 6100, z: -12150, agl: 90 };
        t.roadTraffic.reset();
        return t.roadStructures.stats();
    });
    expect(stats.structureTriangles).toBeLessThanOrEqual(200000);
    expect(stats.structureBytes).toBeLessThan(20 * 1024 * 1024);
    expect(stats.structureResidentTiles).toBeLessThanOrEqual(64);
    await page.waitForTimeout(1600);
    const populations = await page.evaluate(() => {
        const t = window.structureTest;
        const cars = t.roadTraffic.snapshot();
        return cars.map((c) => ({
            ...c,
            aboveGround: c.roadY - t.roadStructures.data.height(c.x, c.z)
        }));
    });
    expect(populations.some((c) => c.aboveGround > 5)).toBe(true);
    expect(populations.some((c) => Math.abs(c.aboveGround) < 0.2)).toBe(true);
    await page.screenshot({ path: info.outputPath('sadr-traffic.png') });
    expect(errors).toEqual([]);
});
test('tunnel portals hide underground cars while preserving route progress and terrain collision', async ({
    page
}, info) => {
    const errors = await prepare(page);
    await page.evaluate(() => {
        const t = window.structureTest;
        t.config = { x: -100, z: -2000, agl: 30 };
        t.roadTraffic.reset();
    });
    await page.waitForTimeout(1000);
    const report = await page.evaluate(() => {
        const t = window.structureTest,
            origin = { x: -100, y: 30, z: -2000 };
        let enters = 0,
            exits = 0,
            moves = 0;
        let previous = t.roadTraffic.snapshot();
        const height = t.world.height(-100, -2000);
        for (let i = 0; i < 160; i++) {
            t.roadTraffic.update(origin, 'high', 1);
            const now = t.roadTraffic.snapshot();
            for (const a of previous) {
                const b = now.find((c) => c.id === a.id);
                if (!b) continue;
                if (!a.underground && b.underground) enters++;
                if (a.underground && !b.underground) exits++;
                if (
                    a.underground &&
                    b.underground &&
                    Math.hypot(a.x - b.x, a.z - b.z) > 0.1
                )
                    moves++;
            }
            previous = now;
        }
        return {
            enters,
            exits,
            moves,
            unchanged: height === t.world.height(-100, -2000),
            stats: t.roadTraffic.stats()
        };
    });
    expect(report.enters).toBeGreaterThan(0);
    expect(report.exits).toBeGreaterThan(0);
    expect(report.moves).toBeGreaterThan(0);
    expect(report.unchanged).toBe(true);
    expect(report.stats.trafficActive).toBeLessThanOrEqual(240);
    await page.screenshot({ path: info.outputPath('tohid-entrance.png') });
    expect(errors).toEqual([]);
});

test('nearby structure cache streams on approach and restores the original distant terrain', async ({
    page
}, info) => {
    const errors = await prepare(page);
    await page.evaluate(() => {
        window.structureTest.config = { x: -100, z: -2000, agl: 10000 };
    });
    await page.waitForTimeout(500);
    expect(
        await page.evaluate(
            () =>
                window.structureTest.roadStructures.stats().structureActiveTiles
        )
    ).toBe(0);
    expect(
        await page.evaluate(
            () =>
                window.structureTest.roadStructures.stats()
                    .structureTerrainPatches
        )
    ).toBe(0);
    await page.screenshot({
        path: info.outputPath('far-original-terrain.png')
    });
    await page.evaluate(() => {
        window.structureTest.config = { x: -100, z: -2000, agl: 30 };
    });
    await page.waitForFunction(() => {
        const s = window.structureTest.roadStructures.stats();
        return (
            s.structureActiveTiles > 0 &&
            s.structurePending === 0 &&
            s.structureTerrainPatches > 0
        );
    });
    await page.waitForTimeout(500);
    await page.screenshot({
        path: info.outputPath('near-streamed-tunnel.png')
    });
    const bounded = await page.evaluate(() => {
        const t = window.structureTest;
        for (let i = 0; i < 12; i++)
            for (let j = 0; j < 50; j++)
                t.roadStructures.update(
                    {
                        x: -12000 + i * 2500,
                        z: -9000,
                        y: t.world.height(-12000 + i * 2500, -9000) + 80
                    },
                    'high'
                );
        const peak = t.roadStructures.stats();
        t.roadStructures.update({ x: 0, y: 10000, z: 0 }, 'low');
        return { peak, far: t.roadStructures.stats() };
    });
    expect(bounded.peak.structureResidentTiles).toBeLessThanOrEqual(64);
    expect(bounded.peak.structureActiveTiles).toBeLessThanOrEqual(48);
    expect(bounded.far.structureTerrainPatches).toBe(0);
    expect(bounded.far.structureActiveTiles).toBe(0);
    expect(errors).toEqual([]);
});
