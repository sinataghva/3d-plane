import { test, expect } from '@playwright/test';

test('pointer controls return Space to gunfire without reopening map or settings', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    // Observe the real DOM keyboard routing with an independent input state.
    await page.evaluate(async () => {
        const { createKeyboardState } =
            await import('/3d-plane/src/flight/input.js');
        window.focusTestInput = createKeyboardState();
    });
    await page.locator('#mini-map').click();
    await expect(page.locator('#world-map')).toBeVisible();
    await expect(page.locator('#close-world-map')).not.toBeFocused();
    await page.locator('#close-world-map').click();
    await expect(page.locator('#world-map')).not.toBeVisible();
    await expect(page.locator('#mini-map')).not.toBeFocused();
    await page.screenshot({ path: info.outputPath('after-map-click.png') });
    await page.keyboard.down('Space');
    expect(await page.evaluate(() => window.focusTestInput.space)).toBe(true);
    await expect(page.locator('#world-map')).not.toBeVisible();
    await page.keyboard.up('Space');
    expect(await page.evaluate(() => window.focusTestInput.space)).toBe(false);
    await page.locator('#settings-button').click();
    await page.locator('#close-settings').click();
    await page.keyboard.press('Space');
    await expect(page.locator('#settings-dialog')).not.toBeVisible();
    // Even keyboard-focused game buttons cannot steal Space from the gun.
    await page.locator('#mini-map').focus();
    await page.keyboard.down('Space');
    expect(await page.evaluate(() => window.focusTestInput.space)).toBe(true);
    await expect(page.locator('#world-map')).not.toBeVisible();
    await page.keyboard.up('Space');
    // Enter still supports deliberate keyboard activation.
    await page.locator('#mini-map').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#world-map')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mini-map')).toBeFocused();
});
