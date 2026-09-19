import { test, expect } from '@playwright/test';

for (const viewport of [
    { width: 393, height: 659 },
    { width: 852, height: 393 }
]) {
    test(`iPhone picker fits ${viewport.width}`, async ({ browser }, info) => {
        const context = await browser.newContext({
            viewport,
            isMobile: true,
            hasTouch: true
        });
        const page = await context.newPage();
        await page.goto('/3d-plane/');
        await expect(page.locator('#mission-select')).toBeVisible();
        expect(
            await page
                .locator('#mission-select')
                .evaluate((e) => e.scrollHeight <= e.clientHeight)
        ).toBe(true);
        for (const selector of [
            '[data-mission="saint-cyr"]',
            '[data-mission="luxeuil"]',
            '#fly-button'
        ]) {
            const box = await page.locator(selector).boundingBox();
            expect(box.y).toBeGreaterThanOrEqual(0);
            expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
        }
        await page.locator('[data-mission="luxeuil"]').tap();
        await expect(page.locator('#fly-button')).toContainText('Luxeuil');
        await page.screenshot({ path: info.outputPath('picker.png') });
        await context.close();
    });
}

test('mobile throttle end zones spring back and gear toggles', async ({
    browser
}, info) => {
    test.setTimeout(60000);
    const context = await browser.newContext({
        viewport: { width: 852, height: 393 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.evaluate(() => {
        const a = window.planeAutomation;
        a.setControls({ throttle: 1, boost: true });
        a.step({ seconds: 10 });
        a.setControls({ pitch: 0.12 });
        a.step({ seconds: 3 });
        a.setControls({ pitch: 0 });
    });
    const gear = page.locator('#gear-button');
    await expect(gear).toBeVisible();
    await gear.tap();
    await expect(gear).toHaveAttribute('aria-pressed', 'false');
    await gear.tap();
    await expect(gear).toHaveAttribute('aria-pressed', 'true');
    const slider = page.locator('#touch-throttle');
    const box = await slider.boundingBox();
    const touch = await context.newCDPSession(page);
    const press = async (x) =>
        touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x, y: box.y + box.height / 2 }]
        });
    const release = async () =>
        touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
    await press(box.x + box.width - 2);
    await expect(page.locator('#jet-readout')).toContainText('AFTERBURNER');
    await release();
    await expect(slider).toHaveValue('100');
    await expect(page.locator('#jet-readout')).not.toContainText('AFTERBURNER');
    await press(box.x + 2);
    await expect(page.locator('#jet-readout')).toContainText('BRAKING');
    await release();
    await expect(slider).toHaveValue('0');
    await expect(page.locator('#jet-readout')).not.toContainText('BRAKING');
    await press(box.x + box.width - 2);
    await expect(page.locator('#jet-readout')).toContainText('AFTERBURNER');
    await touch.send('Input.dispatchTouchEvent', {
        type: 'touchCancel',
        touchPoints: []
    });
    await expect(slider).toHaveValue('100');
    await expect(page.locator('#jet-readout')).not.toContainText('AFTERBURNER');
    await press(box.x + box.width - 2);
    await expect(page.locator('#jet-readout')).toContainText('AFTERBURNER');
    await page.evaluate(() =>
        document.getElementById('settings-button').click()
    );
    await release();
    await expect(slider).toHaveValue('100');
    await expect(page.locator('#jet-readout')).not.toContainText('AFTERBURNER');
    await page.locator('#close-settings').tap();
    await page.screenshot({ path: info.outputPath('controls.png') });
    await context.close();
});
