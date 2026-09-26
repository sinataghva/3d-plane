import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.setTimeout(120000);
const stats = (page) =>
    page.evaluate(() =>
        JSON.parse(document.documentElement.dataset.sceneryStats || '{}')
    );
const ready = (page) =>
    page.waitForFunction(() => {
        const s = JSON.parse(
            document.documentElement.dataset.sceneryStats || '{}'
        );
        return (
            s.groundTextureReady &&
            s.groundTextureTiles > 0 &&
            s.groundTexturePending === 0
        );
    });

test('fast low flight and turns keep loading bounded without shader errors', async ({
    page
}, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await page.waitForFunction(() => window.planeAutomation);
    await ready(page);
    const report = await page.evaluate(async () => {
        const api = window.planeAutomation;
        api.setControls({ throttle: 1, boost: true });
        api.step({ seconds: 10 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 3 });
        api.setControls({ pitch: 0, gearDown: false });
        api.step({ seconds: 8 });
        const frames = [],
            samples = [];
        let previous = performance.now();
        const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
        for (let i = 0; i < 600; i++) {
            const s = api.getState();
            const bank = Math.sin(i / 90) * 0.35;
            const pitch = clamp((450 - s.altitudeMeters) * 0.0006, -0.08, 0.13);
            api.setControls({
                throttle: 0.65,
                boost: false,
                pitch: clamp(
                    (pitch - s.plane.pitchAngle) * 3 + 0.035,
                    -0.3,
                    0.4
                ),
                roll: clamp((bank - s.plane.rollAngle) * 0.75, -0.5, 0.5)
            });
            api.step({ seconds: 0.1 });
            await new Promise(requestAnimationFrame);
            const now = performance.now();
            frames.push(now - previous);
            previous = now;
            if (i % 60 === 0)
                samples.push({
                    state: api.getState(),
                    detail: JSON.parse(
                        document.documentElement.dataset.sceneryStats
                    )
                });
            if (api.getState().plane.isCrashed) break;
        }
        frames.sort((a, b) => a - b);
        return {
            samples,
            final: api.getState(),
            medianMs: frames[Math.floor(frames.length * 0.5)],
            p95Ms: frames[Math.floor(frames.length * 0.95)]
        };
    });
    expect(report.final.plane.isCrashed).toBe(false);
    expect(errors).toEqual([]);
    expect(report.final.simulationSeconds).toBeGreaterThan(80);
    for (const s of report.samples) {
        expect(s.detail.groundTextureTiles).toBeLessThanOrEqual(9);
        expect(s.detail.groundTextureStrength).toBeGreaterThanOrEqual(0);
        expect(s.detail.groundTextureStrength).toBeLessThanOrEqual(1);
    }
    await page.screenshot({ path: info.outputPath('fast-turning-flight.png') });
    await writeFile(
        info.outputPath('flight-metrics.json'),
        JSON.stringify(report, null, 2)
    );
});
for (const mobile of [false, true])
    test(`Tehran fine terrain, flight and concurrent map ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        const page = await browser.newPage({
            viewport: mobile
                ? { width: 844, height: 390 }
                : { width: 1280, height: 720 },
            hasTouch: mobile,
            isMobile: mobile
        });
        const errors = [],
            external = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        page.on('request', (r) => {
            if (
                !r.url().startsWith('http://127.0.0.1:5173/') &&
                !r.url().startsWith('data:')
            )
                external.push(r.url());
        });
        await page.goto(
            'http://127.0.0.1:5173/3d-plane/?mission=tehran&automation=1'
        );
        await page.waitForFunction(() => window.planeAutomation);
        const start = Date.now();
        await ready(page);
        const preparationMs = Date.now() - start;
        await page.waitForTimeout(600);
        const runway = await stats(page);
        expect(runway.groundTextureResolution).toBe(8192);
        expect(runway.groundTextureStrength).toBeGreaterThan(0.99);
        expect(runway.groundTextureStrength).toBeLessThanOrEqual(1);
        expect(runway.groundTextureTiles).toBeLessThanOrEqual(9);
        await page.screenshot({ path: info.outputPath('fine-runway.png') });
        const frames = await page.evaluate(
            () =>
                new Promise((resolve) => {
                    const samples = [];
                    let last = performance.now();
                    function tick(now) {
                        samples.push(now - last);
                        last = now;
                        if (samples.length < 120) requestAnimationFrame(tick);
                        else {
                            samples.sort((a, b) => a - b);
                            resolve({
                                medianMs: samples[60],
                                p95Ms: samples[114]
                            });
                        }
                    }
                    requestAnimationFrame(tick);
                })
        );
        await page.locator('#mini-map').click();
        await page.locator('#world-map-canvas').evaluate((canvas) => {
            canvas.dispatchEvent(
                new Event('gesturestart', { cancelable: true })
            );
            const r = canvas.getBoundingClientRect(),
                e = new Event('gesturechange', { cancelable: true });
            Object.assign(e, {
                scale: 12,
                clientX: r.x + r.width / 2,
                clientY: r.y + r.height / 2
            });
            canvas.dispatchEvent(e);
        });
        await page.waitForFunction(() => {
            const s = JSON.parse(
                document.querySelector('#world-map-canvas').dataset
                    .detailMetrics || '{}'
            );
            return s.ready && !s.pending;
        });
        const map = await page
            .locator('#world-map-canvas')
            .evaluate((c) => JSON.parse(c.dataset.detailMetrics));
        const combinedBytes = runway.groundTextureBytes + map.backingBytes;
        expect(combinedBytes).toBeLessThan(46 * 1024 * 1024);
        await page.screenshot({
            path: info.outputPath('fine-map-and-ground.png')
        });
        await page.locator('#close-world-map').click();
        for (const quality of ['balanced', 'low', 'high']) {
            await page.locator('#settings-button').click();
            await page.locator('#graphics-quality').selectOption(quality);
            await page.locator('#close-settings').click();
            if (quality === 'low') {
                await page.waitForFunction(
                    () =>
                        JSON.parse(
                            document.documentElement.dataset.sceneryStats
                        ).groundTextureBytes === 0
                );
            } else await ready(page);
        }
        // Real UI interaction intentionally releases automation ownership.
        await page.reload();
        await page.waitForFunction(() => window.planeAutomation);
        await ready(page);
        await page.evaluate(() => {
            const a = window.planeAutomation;
            a.setControls({ throttle: 1, boost: true });
            a.step({ seconds: 10 });
            a.setControls({ pitch: 0.3 });
            a.step({ seconds: 3 });
            a.setControls({ pitch: 0, gearDown: false });
            a.step({ seconds: 8 });
        });
        expect(
            (await page.evaluate(() => window.planeAutomation.getState())).plane
                .isCrashed
        ).toBe(false);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: info.outputPath('fine-low-flight.png') });
        const flight = await stats(page);
        await writeFile(
            info.outputPath('measurements.json'),
            JSON.stringify(
                {
                    mobile,
                    preparationMs,
                    frames,
                    runway,
                    map,
                    combinedBytes,
                    flight
                },
                null,
                2
            )
        );
        await info.attach('measurements.json', {
            body: JSON.stringify(
                {
                    mobile,
                    preparationMs,
                    frames,
                    runway,
                    map,
                    combinedBytes,
                    flight
                },
                null,
                2
            ),
            contentType: 'application/json'
        });
        await page.evaluate(() => window.planeAutomation.reset());
        await ready(page);
        expect((await stats(page)).groundTextureTiles).toBeLessThanOrEqual(9);
        expect(errors).toEqual([]);
        expect(external).toEqual([]);
        await page.close();
    });

test('fine terrain handles tile boundaries, rapid travel, altitude cycles and disposal', async ({
    page
}, info) => {
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await page.waitForFunction(() => window.planeAutomation);
    const report = await page.evaluate(async () => {
        const { createGroundTextureDetail } =
            await import('/3d-plane/src/scenery/groundTextureDetail.js');
        const url = performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .find((n) => /\/src\/scenery\/geography\.js(?:\?|$)/.test(n));
        const { getGeography } = await import(url);
        const { MeshLambertMaterial } =
            await import('/3d-plane/node_modules/.vite/deps/three.js');
        const w = getGeography(),
            material = new MeshLambertMaterial(),
            d = createGroundTextureDetail(w, material);
        const samples = [];
        for (const [dx, dz, height] of [
            [0, 0, 80],
            [3400, 1000, 90],
            [6800, 2000, 100],
            [10000, -3000, 120],
            [15000, -6000, 200],
            [0, 0, 1200],
            [0, 0, 80],
            [0, 0, 1200],
            [0, 0, 80]
        ]) {
            const x = w.spawn.x + dx,
                z = w.spawn.z + dz,
                p = { x, z, y: w.height(x, z) + height };
            let n = 0;
            do {
                d.update(p, 'high', 0.1);
                await new Promise(requestAnimationFrame);
                n++;
            } while (
                n < 300 &&
                (n < 30 ||
                    !d.stats().groundTextureReady ||
                    d.stats().groundTexturePending)
            );
            samples.push(d.stats());
        }
        // Abandon incomplete work repeatedly before settling at the runway.
        for (let n = 0; n < 30; n++)
            d.update(
                { x: w.spawn.x + n * 900, z: w.spawn.z + 4000, y: 200 },
                'high',
                0.016
            );
        d.reset();
        const reset = d.stats();
        d.dispose();
        material.dispose();
        return { samples, reset, disposed: d.stats() };
    });
    for (const s of report.samples) {
        expect(s.groundTextureTiles).toBeLessThanOrEqual(9);
        expect(s.groundTexturePending).toBe(0);
        expect(s.groundTextureBytes).toBeLessThan(21 * 1024 * 1024);
    }
    expect(report.samples[5].groundTextureStrength).toBeLessThan(0.001);
    expect(report.samples[6].groundTextureStrength).toBeGreaterThan(0.99);
    expect(report.reset.groundTextureBytes).toBe(0);
    expect(report.disposed.groundTextureTiles).toBe(0);
    await writeFile(
        info.outputPath('travel-metrics.json'),
        JSON.stringify(report, null, 2)
    );
    await info.attach('travel-metrics.json', {
        body: JSON.stringify(report, null, 2),
        contentType: 'application/json'
    });
});
