import { test, expect } from '@playwright/test';
const ready = async (page) =>
    expect(page.locator('#scenery-loading')).toHaveCount(0, { timeout: 45000 });
test('selection uses local rendered cards and switches between clean flight sessions', async ({
    page
}) => {
    const maps = [];
    page.on('request', (r) => {
        if (/data\/.+\.json/.test(r.url())) maps.push(r.url());
    });
    await page.goto('/3d-plane/');
    await expect(
        page.getByRole('heading', { name: 'Where will you fly?' })
    ).toBeVisible();
    expect(maps).toHaveLength(0);
    expect(
        await page
            .locator('.mission-card img')
            .evaluateAll((imgs) =>
                imgs.every((img) => img.complete && img.naturalWidth > 0)
            )
    ).toBe(true);
    await page.locator('[data-mission=luxeuil]').click();
    await page.getByRole('button', { name: 'Fly Luxeuil →' }).click();
    await ready(page);
    await expect(page.locator('#jet-controls')).toBeHidden();
    await expect(page.locator('#flight-data #jet-readout')).toBeVisible();
    expect(maps.some((u) => u.includes('saint-cyr.json'))).toBe(false);
    await page.locator('#settings-button').click();
    await page.getByRole('button', { name: 'Change flight' }).click();
    await expect(page.locator('#mission-select')).toBeVisible();
    await page.getByRole('button', { name: 'Fly Saint-Cyr →' }).click();
    await ready(page);
    await expect(page.locator('#jet-controls')).toHaveCount(0);
    await expect(page.locator('#canvas-container canvas')).toHaveCount(1);
});
test('desktop jet boosts on held W and cancels on release, blur, pause and restart', async ({
    page
}) => {
    await page.goto('/3d-plane/?mission=luxeuil');
    await ready(page);
    await page.keyboard.down('w');
    await expect(page.locator('#thrust-value')).toHaveText('110', {
        timeout: 10000
    });
    await expect(page.locator('#boost-button')).toHaveAttribute(
        'data-active',
        'true'
    );
    await page.keyboard.up('w');
    await expect(page.locator('#thrust-value')).toHaveText('100');
    await page.keyboard.down('w');
    await expect(page.locator('#thrust-value')).toHaveText('110');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('#thrust-value')).toHaveText('100');
    await page.keyboard.up('w');
    await page.keyboard.down('w');
    await expect(page.locator('#thrust-value')).toHaveText('110');
    await page.locator('#settings-button').click();
    await expect(page.locator('#thrust-value')).toHaveText('100');
    await page.keyboard.up('w');
    await page.locator('#restart-button').click();
    await expect(page.locator('#thrust-value')).toHaveText('0');
});
test.describe('touchscreen', () => {
    test.use({ hasTouch: true, isMobile: true });
    test('mobile jet flies with boost, releases on cancellation, shows local town labels', async ({
        page
    }, testInfo) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await ready(page);
        await page.evaluate(() => {
            window.planeAutomation.setControls({ throttle: 1, boost: true });
            window.planeAutomation.step({ seconds: 10 });
            window.planeAutomation.setControls({ pitch: 0.3 });
            window.planeAutomation.step({ seconds: 3 });
            window.planeAutomation.setControls({ pitch: 0, gearDown: false });
            window.planeAutomation.step({ seconds: 8 });
        });
        const s = await page.evaluate(() => window.planeAutomation.getState());
        expect(s.plane.isAirborne).toBe(true);
        expect(s.altitudeMeters).toBeGreaterThan(50);
        expect(s.plane.gearDown).toBe(false);
        await page.screenshot({
            path: testInfo.outputPath('luxeuil-mobile-flight.png')
        });
        await page.getByRole('button', { name: 'Open full map' }).click();
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'aria-label',
            /Luxeuil.*Abelcourt/
        );
        await page.locator('#close-world-map').click();
        const boost = page.locator('#boost-button');
        const box = await page.locator('#touch-throttle').boundingBox();
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
                { x: box.x + box.width - 2, y: box.y + box.height / 2 }
            ]
        });
        await expect(boost).toHaveAttribute('data-active', 'true');
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchCancel',
            touchPoints: []
        });
        await expect(boost).toHaveAttribute('data-active', 'false');
        await expect(page.locator('#thrust-value')).toHaveText('100');
    });
});
