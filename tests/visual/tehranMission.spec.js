import { test, expect } from '@playwright/test';

test('Tehran graphics presets switch live and persist', async ({
    page
}, info) => {
    test.setTimeout(60000);
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await ready(page);
    for (const quality of ['low', 'balanced', 'high']) {
        await page.locator('#settings-button').click();
        await page.locator('#graphics-quality').selectOption(quality);
        await page.locator('#close-settings').click();
        // Let the nearby surface cache fade in before inspecting the runway.
        await page.waitForTimeout(3000);
        await page.screenshot({
            path: info.outputPath(`tehran-${quality}.png`)
        });
    }
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await page.locator('#settings-button').click();
    await expect(page.locator('#graphics-quality')).toHaveValue('high');
});
const ready = async (page) =>
    expect(page.locator('#scenery-loading')).toHaveCount(0, { timeout: 45000 });

test('extended F-4 departures toward the city and southeastern desert', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await ready(page);
    for (const destination of ['city', 'desert']) {
        const report = await page.evaluate(async (destination) => {
            const { bounds, origin } = await fetch(
                '/3d-plane/data/tehran/map.json'
            ).then((r) => r.json());
            const longitudeScale =
                111320 * Math.cos((origin[0] * Math.PI) / 180);
            const world = {
                minX: (bounds[1] - origin[1]) * longitudeScale,
                maxX: (bounds[3] - origin[1]) * longitudeScale,
                minZ: (origin[0] - bounds[2]) * 111320,
                maxZ: (origin[0] - bounds[0]) * 111320
            };
            const api = window.planeAutomation;
            api.reset();
            api.setControls({ throttle: 1, boost: true });
            api.step({ seconds: 10 });
            api.setControls({ pitch: 0.3 });
            api.step({ seconds: 3 });
            api.setControls({
                pitch: 0,
                gearDown: false,
                boost: false,
                throttle: 0.5
            });
            api.step({ seconds: 8 });
            const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
            const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
            const targetYaw = destination === 'city' ? 0.2 : -1.0;
            const samples = [];
            for (let step = 0; step < 240; step++) {
                const s = api.getState();
                const targetBank = clamp(
                    -wrap(targetYaw - s.plane.yawAngle) * 1.5,
                    -0.45,
                    0.45
                );
                const targetPitch = clamp(
                    (1000 - s.altitudeMeters) * 0.0006,
                    -0.08,
                    0.13
                );
                api.setControls({
                    throttle: 0.35,
                    pitch: clamp(
                        (targetPitch - s.plane.pitchAngle) * 3 + 0.035,
                        -0.3,
                        0.4
                    ),
                    roll: clamp(
                        (targetBank - s.plane.rollAngle) * 0.75,
                        -0.5,
                        0.5
                    )
                });
                api.step({ seconds: 0.25 });
                const next = api.getState();
                if (step % 80 === 0 || next.plane.isCrashed) samples.push(next);
                if (next.plane.isCrashed) break;
            }
            const final = api.getState(),
                p = final.plane.position;
            return {
                samples,
                final,
                insideMap:
                    p.x > world.minX &&
                    p.x < world.maxX &&
                    p.z > world.minZ &&
                    p.z < world.maxZ
            };
        }, destination);
        expect(report.final.plane.isCrashed).toBe(false);
        expect(report.final.plane.isAirborne).toBe(true);
        expect(report.final.simulationSeconds).toBeGreaterThanOrEqual(80);
        expect(report.insideMap).toBe(true);
        await page.evaluate(
            () =>
                new Promise((resolve) =>
                    requestAnimationFrame(() => requestAnimationFrame(resolve))
                )
        );
        await expect(page.locator('#altitude-value')).not.toHaveText('0');
        await page.screenshot({
            path: info.outputPath(`extended-${destination}.png`)
        });
        await info.attach(`${destination}-flight.json`, {
            body: JSON.stringify(report, null, 2),
            contentType: 'application/json'
        });
    }
});

for (const mobile of [false, true]) {
    test(`Tehran flight, instruments and lifecycle ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        const page = await browser.newPage({
            viewport: mobile
                ? { width: 844, height: 390 }
                : { width: 1280, height: 720 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const errors = [],
            maps = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('request', (r) => {
            if (/data\/.+\.json/.test(r.url())) maps.push(r.url());
        });
        await page.goto(
            'http://127.0.0.1:5173/3d-plane/?mission=tehran&automation=1'
        );
        await ready(page);
        expect(maps.some((u) => /saint-cyr|luxeuil/.test(u))).toBe(false);
        await expect(page.locator('.touch-fire')).toBeEnabled();
        let state = await page.evaluate(() =>
            window.planeAutomation.getState()
        );
        expect(state.plane.aircraft).toBe('phantom');
        expect(state.plane.mission).toBe('tehran');
        const spawn = state.plane.position;
        // Inspect the actual stationary start, not just an elevated visual scene.
        await page.screenshot({
            path: info.outputPath('phantom-runway-start.png')
        });
        await page.evaluate(() => {
            const api = window.planeAutomation;
            api.setControls({ throttle: 1, boost: true });
            api.step({ seconds: 10 });
            api.setControls({ pitch: 0.3 });
            api.step({ seconds: 3 });
            api.setControls({ pitch: 0, gearDown: false });
            api.step({ seconds: 8 });
        });
        state = await page.evaluate(() => window.planeAutomation.getState());
        expect(state.plane.isCrashed).toBe(false);
        expect(state.plane.isAirborne).toBe(true);
        expect(state.altitudeMeters).toBeGreaterThan(50);
        expect(state.speedKmh).toBeGreaterThan(300);
        expect(state.plane.gearExtension).toBe(0);
        await expect(page.locator('#jet-readout')).toContainText('Mach');
        await page.screenshot({ path: info.outputPath('phantom-flight.png') });
        await page.getByRole('button', { name: 'Open full map' }).click();
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'aria-label',
            /Tehran.*Mehrabad/
        );
        await page.screenshot({ path: info.outputPath('tehran-map.png') });
        await page.locator('#close-world-map').click();
        await page.locator('#settings-button').click();
        await expect(page.locator('#thrust-value')).toHaveText('100');
        await page.locator('#restart-button').click();
        state = await page.evaluate(() => window.planeAutomation.getState());
        expect(state.plane.position).toEqual(spawn);
        expect(state.plane.gearDown).toBe(true);
        expect(state.plane.thrust).toBe(0);
        await page.locator('#settings-button').click();
        await page.getByRole('button', { name: 'Change flight' }).click();
        await expect(page.locator('#mission-select')).toBeVisible();
        await expect(page.locator('.mission-card')).toHaveCount(3);
        await expect(page.locator('[data-mission=tehran] img')).toBeVisible();
        expect(errors).toEqual([]);
        await page.close();
    });
}

test('all three mission cards fit portrait and landscape touch screens', async ({
    browser
}, info) => {
    const page = await browser.newPage({ isMobile: true, hasTouch: true });
    for (const [width, height] of [
        [390, 844],
        [844, 390]
    ]) {
        await page.setViewportSize({ width, height });
        await page.goto('http://127.0.0.1:5173/3d-plane/');
        await expect(page.locator('.mission-card')).toHaveCount(3);
        for (const id of ['saint-cyr', 'luxeuil', 'tehran']) {
            const card = page.locator(`[data-mission=${id}]`);
            await card.click();
            const box = await card.boundingBox();
            expect(box.width).toBeGreaterThan(150);
            expect(box.y + box.height).toBeLessThanOrEqual(height);
        }
        await expect(page.locator('#fly-button')).toHaveText('Fly Tehran →');
        const fly = await page.locator('#fly-button').boundingBox();
        expect(fly.y + fly.height).toBeLessThanOrEqual(height);
        await page.screenshot({ path: info.outputPath(`picker-${width}.png`) });
    }
    await page.close();
});

for (const view of [
    'card',
    'cockpit',
    'exhaustBoost',
    'tehran-city',
    'tehran-desert',
    'tehran-south'
])
    test(`Phantom ${view} rendering`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/3d-plane/?mission=tehran&visual=${view}`);
        await expect(page.locator('html')).toHaveAttribute(
            'data-visual-ready',
            'true',
            { timeout: 45000 }
        );
        if (view === 'cockpit')
            await expect(page.locator('.cockpit-reticle')).toBeHidden();
        await page.screenshot({ path: info.outputPath(`${view}.png`) });
        expect(errors).toEqual([]);
    });
