import { test, expect } from '@playwright/test';

for (const mobile of [false, true]) {
    test(`photo mode freezes flight and restores controls on ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        test.setTimeout(90000);
        const context = await browser.newContext({
            viewport: mobile
                ? { width: 852, height: 393 }
                : { width: 1280, height: 720 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await page.waitForFunction(() => window.planeAutomation);
        await page.evaluate(() => {
            const api = window.planeAutomation;
            api.setControls({ throttle: 1, boost: true });
            api.step({ seconds: 10 });
            api.setControls({ pitch: 0.3 });
            api.step({ seconds: 3 });
            api.setControls({ pitch: 0, gearDown: false });
            api.step({ seconds: 8 });
        });
        await page.locator('#photo-button').click();
        await expect(page.locator('body')).toHaveClass(/photo-mode/);
        await expect(page.locator('#flight-data')).not.toBeVisible();
        await expect(page.locator('#settings-button')).not.toBeVisible();
        const frozen = await page.evaluate(
            () => window.planeAutomation.getState().plane
        );
        expect(frozen.isAirborne).toBe(true);
        const canvas = page.locator('#canvas-container canvas');
        const before = await canvas.screenshot();
        if (mobile) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchStart',
                touchPoints: [{ x: 450, y: 250 }]
            });
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchMove',
                touchPoints: [{ x: 550, y: 290 }]
            });
            await cdp.send('Input.dispatchTouchEvent', {
                type: 'touchEnd',
                touchPoints: []
            });
        } else {
            await page.mouse.move(650, 400);
            await page.mouse.down();
            await page.mouse.move(800, 500, { steps: 10 });
            await page.mouse.up();
            await page.mouse.wheel(0, 150);
        }
        await page.keyboard.press('g');
        await page.keyboard.press('m');
        await page.keyboard.press('Space');
        await expect(page.locator('#world-map')).not.toBeVisible();
        expect(
            await page.evaluate(() => window.planeAutomation.getState().plane)
        ).toEqual(frozen);
        expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
        await page.screenshot({ path: info.outputPath('photo-controls.png') });
        await page.locator('#photo-hide').click();
        await expect(page.locator('#photo-controls')).not.toBeVisible();
        await page.screenshot({ path: info.outputPath('photo-clean.png') });
        if (mobile) await page.touchscreen.tap(400, 250);
        else await page.mouse.click(400, 350);
        await expect(page.locator('#photo-controls')).toBeVisible();
        await page.locator('#photo-reset').click();
        await page.locator('#photo-exit').click();
        await expect(page.locator('#flight-data')).toBeVisible();
        await expect
            .poll(async () =>
                page.evaluate(
                    () => window.planeAutomation.getState().plane.position
                )
            )
            .not.toEqual(frozen.position);
        await page.locator('#photo-button').click();
        await page.keyboard.press('Escape');
        await expect(page.locator('#flight-data')).toBeVisible();
        expect(errors).toEqual([]);
        await context.close();
    });
}

test('light aircraft photo mode restores cockpit view', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.goto('/3d-plane/?mission=saint-cyr');
    await page.locator('#settings-button').click();
    await page.locator('#camera-select').selectOption('cockpit');
    await page.locator('#close-settings').click();
    await page.locator('#photo-button').click();
    await page.locator('#photo-hide').click();
    await page.screenshot({ path: info.outputPath('saint-cyr-photo.png') });
    await page.keyboard.press('Escape');
    await page.locator('#settings-button').click();
    await expect(page.locator('#camera-select')).toHaveValue('cockpit');
});
