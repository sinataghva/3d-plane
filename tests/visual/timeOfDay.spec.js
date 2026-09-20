import { test, expect } from '@playwright/test';

for (const mission of ['saint-cyr', 'luxeuil']) {
    test(`${mission} lighting presets render without errors`, async ({
        page
    }, info) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        for (const mode of ['day', 'sunset', 'night']) {
            await page.goto(`/?mission=${mission}&visual=chase&time=${mode}`);
            await page.waitForFunction(
                () => document.documentElement.dataset.visualReady === 'true'
            );
            await expect(page.locator('#time-of-day')).toHaveValue(mode);
            await page.screenshot({
                path: info.outputPath(`${mission}-${mode}.png`)
            });
        }
        expect(errors).toEqual([]);
    });
}

test('time selection persists through reload in mobile settings', async ({
    page
}, info) => {
    await page.setViewportSize({ width: 852, height: 393 });
    await page.goto('/?mission=luxeuil');
    await page.locator('#settings-button').click();
    await page.locator('#time-of-day').selectOption('night');
    await expect(page.locator('#settings-dialog')).toBeVisible();
    await page.screenshot({ path: info.outputPath('mobile-settings.png') });
    await page.reload();
    await page.locator('#settings-button').click();
    await expect(page.locator('#time-of-day')).toHaveValue('night');
    await page.locator('#time-of-day').selectOption('day');
    await page.locator('#close-settings').click();
    await expect(page.locator('#settings-dialog')).not.toBeVisible();
});
