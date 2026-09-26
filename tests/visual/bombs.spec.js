import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

for (const view of [
    'loaded',
    'partial',
    'reloading',
    'restored',
    'impact',
    'water',
    'building',
    'slope'
])
    test(`bombs ${view} visual`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/3d-plane/?mission=tehran&visual=bombs-${view}`);
        await expect(page.locator('html')).toHaveAttribute(
            'data-visual-ready',
            'true',
            { timeout: 60000 }
        );
        await page.screenshot({ path: info.outputPath(`${view}.png`) });
        await expect(page.locator('#bomb-readout')).toContainText(
            view === 'reloading'
                ? 'Reloading'
                : view === 'partial' ||
                    view === 'impact' ||
                    view === 'water' ||
                    view === 'building'
                  ? '5/6'
                  : '6/6'
        );
        expect(errors).toEqual([]);
        if (view === 'building' || view === 'slope') {
            const stats = JSON.parse(
                await page.locator('html').getAttribute('data-scenery-stats')
            );
            expect(stats.bombPredictionKind).toBe(
                view === 'building' ? 'building' : 'ground'
            );
        }
        if (view === 'water') {
            const stats = JSON.parse(
                await page.locator('html').getAttribute('data-scenery-stats')
            );
            expect(stats.bombSplashCount).toBe(1);
            expect(stats.bombPredictionKind).toBe('water');
        }
    });

test('impact crosshair stays readable at low and high altitude, including blocked release', async ({
    page
}, info) => {
    for (const view of ['low', 'high']) {
        await page.goto(`/3d-plane/?mission=tehran&visual=bombs-${view}`);
        await expect(page.locator('html')).toHaveAttribute(
            'data-visual-ready',
            'true',
            { timeout: 60000 }
        );
        const stats = JSON.parse(
            await page.locator('html').getAttribute('data-scenery-stats')
        );
        expect(stats.bombMarkerVisible).toBe(view !== 'low');
        if (view !== 'low') {
            expect(
                Math.max(stats.bombMarkerWidth, stats.bombMarkerHeight)
            ).toBeCloseTo(160, -1);
            expect(stats.bombMarkerHeight).toBeLessThan(
                stats.bombMarkerWidth * 0.9
            );
        }
        if (view === 'low')
            await expect(page.locator('#bomb-readout')).toContainText(
                'Below release height'
            );
        await page.screenshot({
            path: info.outputPath(`crosshair-${view}.png`)
        });
    }
});

test('flight release, hold, full reload, pause and reset', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await expect(page.locator('#scenery-loading')).toHaveCount(0, {
        timeout: 45000
    });
    const result = await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ fire: true });
        api.step({ seconds: 1 });
        const blocked = api.getState().plane.bombs;
        api.setControls({ fire: false, throttle: 1, boost: true });
        api.step({ seconds: 10 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 3 });
        api.setControls({ pitch: 0, gearDown: false });
        api.step({ seconds: 6 });
        api.setControls({ fire: true });
        api.step({ seconds: 1 });
        const first = api.getState().plane.bombs;
        const counts = [];
        for (let i = 0; i < 5; i++) {
            api.setControls({ fire: false });
            api.step({ seconds: 1 / 60 });
            api.setControls({ fire: true });
            api.step({ seconds: 1 / 60 });
            counts.push(api.getState().plane.bombs.remaining);
        }
        const empty = api.getState().plane.bombs;
        api.setControls({ fire: false, throttle: 0.3, boost: false });
        return { blocked, first, counts, empty };
    });
    expect(result.blocked.remaining).toBe(6);
    expect(result.first.remaining).toBe(5);
    expect(result.counts).toEqual([4, 3, 2, 1, 0]);
    expect(result.empty.reloadSeconds).toBeCloseTo(30);
    await page.waitForTimeout(1000);
    const paused = await page.evaluate(
        () => window.planeAutomation.getState().plane.bombs
    );
    expect(paused.reloadSeconds).toBe(result.empty.reloadSeconds);
    await page.screenshot({ path: info.outputPath('airborne-reloading.png') });
    const reloaded = await page.evaluate(() => {
        const api = window.planeAutomation;
        for (let i = 0; i < 3; i++) api.step({ seconds: 10 });
        return api.getState();
    });
    expect(reloaded.plane.isCrashed).toBe(false);
    expect(reloaded.plane.bombs.remaining).toBe(6);
    await page.evaluate(() => window.planeAutomation.reset());
    await expect(page.locator('#bomb-readout')).toContainText('6/6');
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().plane.bombs.active
        )
    ).toBe(0);
});

test('touch release control and HUD fit phone landscape', async ({
    browser
}, info) => {
    const page = await browser.newPage({
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true
    });
    await page.goto(
        'http://127.0.0.1:5173/3d-plane/?mission=tehran&automation=1'
    );
    await expect(page.locator('#scenery-loading')).toHaveCount(0, {
        timeout: 45000
    });
    await expect(page.locator('.touch-fire')).toBeEnabled();
    await expect(page.locator('.touch-fire')).toHaveText('Drop bomb');
    await page.locator('.touch-fire').tap();
    await expect(page.locator('#bomb-readout')).toContainText('6/6');
    // A human touch intentionally releases automation ownership. Reopen for setup.
    await page.reload();
    await expect(page.locator('#scenery-loading')).toHaveCount(0, {
        timeout: 45000
    });
    await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ throttle: 1, boost: true });
        api.step({ seconds: 10 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 3 });
        api.setControls({ pitch: 0, gearDown: false });
        api.step({ seconds: 6 });
        api.release();
    });
    await page.locator('.touch-fire').tap();
    await expect(page.locator('#bomb-readout')).toContainText('5/6');
    const box = await page.locator('#bomb-readout').boundingBox();
    expect(box.y + box.height).toBeLessThanOrEqual(390);
    await page.screenshot({ path: info.outputPath('mobile-bombs.png') });
    await page.close();
});

for (const quality of ['low', 'balanced', 'high', 'mobile'])
    test(`bomb prediction and effects stay bounded during real-time flight ${quality}`, async ({
        page
    }, info) => {
        test.setTimeout(90000);
        if (quality === 'mobile')
            await page.setViewportSize({ width: 844, height: 390 });
        await page.addInitScript(
            (quality) =>
                localStorage.setItem('plane-graphics-quality', quality),
            quality === 'mobile' ? 'balanced' : quality
        );
        const external = [];
        page.on('request', (r) => {
            if (
                !r.url().startsWith('http://127.0.0.1:5173') &&
                !r.url().startsWith('data:')
            )
                external.push(r.url());
        });
        await page.goto('/3d-plane/?mission=tehran&automation=1');
        await expect(page.locator('#scenery-loading')).toHaveCount(0, {
            timeout: 45000
        });
        await page.evaluate(() => {
            const a = window.planeAutomation;
            a.setControls({ throttle: 1, boost: true });
            a.step({ seconds: 10 });
            a.setControls({ pitch: 0.3 });
            a.step({ seconds: 3 });
            a.setControls({ pitch: 0, gearDown: false });
            a.step({ seconds: 6 });
            a.setControls({ throttle: 0.3, boost: false });
            a.resume();
        });
        const report = await page.evaluate(async () => {
            const times = [],
                work = [];
            let previous = performance.now();
            let maxEffects = 0;
            // This climb also gives the bombs upward velocity. Keep sampling
            // through their eventual impact, not just the initial falling arc.
            for (let i = 0; i < 5400; i++) {
                await new Promise(requestAnimationFrame);
                const now = performance.now();
                times.push(now - previous);
                previous = now;
                if (i < 120 && i % 20 === 0)
                    window.planeAutomation.setControls({ fire: true });
                if (i < 120 && i % 20 === 1)
                    window.planeAutomation.setControls({ fire: false });
                const s = JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                );
                if (s.bombPredictionPeakMs !== undefined)
                    work.push(s.bombPredictionPeakMs);
                maxEffects = Math.max(maxEffects, s.bombEffects || 0);
                if (i >= 2400 && maxEffects > 0) break;
            }
            window.planeAutomation.pause();
            times.sort((a, b) => a - b);
            return {
                median: times[Math.floor(times.length / 2)],
                p95: times[Math.floor(times.length * 0.95)],
                maxPredictionMs: Math.max(...work),
                maxEffects,
                state: window.planeAutomation.getState(),
                stats: JSON.parse(document.documentElement.dataset.sceneryStats)
            };
        });
        await writeFile(
            info.outputPath('bomb-performance.json'),
            JSON.stringify(report, null, 2)
        );
        expect(report.state.plane.isCrashed).toBe(false);
        expect([0, 6]).toContain(report.state.plane.bombs.remaining);
        expect(report.stats.bombsActive).toBeLessThanOrEqual(30);
        expect(report.stats.bombEffects).toBeLessThanOrEqual(16);
        expect(report.maxEffects).toBeGreaterThan(0);
        expect(report.p95).toBeLessThan(100);
        expect(external).toEqual([]);
        await info.attach('bomb-performance.json', {
            body: JSON.stringify(report, null, 2),
            contentType: 'application/json'
        });
        await page.screenshot({
            path: info.outputPath('live-bomb-flight.png')
        });
    });
