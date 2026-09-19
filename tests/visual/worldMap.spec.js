import { expect, test } from '@playwright/test';

test('hold M opens, release closes, and repeat or blur cannot leave a stuck map', async ({
    page
}) => {
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await page.keyboard.down('m');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.down('m');
    await page.keyboard.up('m');
    await expect(page.locator('#world-map')).toBeHidden();
    await page.keyboard.down('m');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(page.locator('#world-map')).toBeHidden();
    await page.keyboard.up('m');
    await page.locator('#settings-button').click();
    await page.getByLabel('Graphics', { exact: true }).focus();
    await page.keyboard.down('m');
    await expect(page.locator('#world-map')).toBeHidden();
    await page.keyboard.up('m');
});

test('mobile map stays open, updates live telemetry, and closes with X', async ({
    page
}) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open full map' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const bounds = await page.getByRole('dialog').boundingBox();
    expect(bounds).toEqual({ x: 0, y: 0, width: 844, height: 390 });
    const before = await page.locator('#world-map-position').textContent();
    await page.evaluate(() => {
        window.planeAutomation.setControls({ throttle: 1 });
        window.planeAutomation.step({ seconds: 1 });
    });
    await expect(page.locator('#world-map-position')).not.toHaveText(before);
    await page.keyboard.press('m');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close full map' }).click();
    await expect(page.locator('#world-map')).toBeHidden();
});
