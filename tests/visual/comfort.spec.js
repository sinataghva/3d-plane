import { test, expect } from '@playwright/test';
test('desktop holds brake at idle, settings pause and clear input, HUD replaces buttons', async ({
    page
}, info) => {
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await expect(page.locator('#jet-controls')).toBeHidden();
    await expect(page.locator('#flight-data #jet-readout')).toBeVisible();
    await page.evaluate(() => window.planeAutomation.release());
    await page.keyboard.down('s');
    await expect(page.locator('#jet-readout')).toContainText('BRAKING');
    await page.keyboard.up('s');
    await expect(page.locator('#jet-readout')).not.toContainText('BRAKING');
    await page.keyboard.down('w');
    await page.keyboard.press('p');
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.keyboard.up('w');
    const before = await page.evaluate(
        () => window.planeAutomation.getState().plane.position
    );
    await page.waitForTimeout(400);
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().plane.position
        )
    ).toEqual(before);
    await page.screenshot({ path: info.outputPath('settings-desktop.png') });
    await page.keyboard.press('Escape');
    await expect(page.locator('#settings-dialog')).not.toBeVisible();
    await page.keyboard.press('p');
    await expect(page.locator('#settings-dialog')).toBeVisible();
});
test.describe('mobile', () => {
    test.use({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 844, height: 390 }
    });
    test('touch brake releases on cancellation and settings fit', async ({
        page
    }, info) => {
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await expect(page.locator('#jet-controls')).toBeVisible();
        await expect(page.locator('[data-key="space"]')).toBeVisible();
        const box = await page.locator('#touch-throttle').boundingBox();
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [{ x: box.x + 2, y: box.y + box.height / 2 }]
        });
        await expect(page.locator('#jet-readout')).toContainText('BRAKING');
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchCancel',
            touchPoints: []
        });
        await expect(page.locator('#jet-readout')).not.toContainText('BRAKING');
        await page.screenshot({ path: info.outputPath('mobile-hud.png') });
        await page.locator('#settings-button').tap();
        await expect(page.locator('#settings-dialog')).toBeVisible();
        await page.screenshot({ path: info.outputPath('mobile-settings.png') });
    });
});
