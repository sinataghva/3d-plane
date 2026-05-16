import { expect, test } from '@playwright/test';

const SCENARIOS = ['chase', 'cockpit', 'orbit', 'warning', 'crash'];

test.describe('3D plane visual states', () => {
    for (const scenario of SCENARIOS) {
        test(`${scenario} view matches baseline`, async ({ page }) => {
            await page.goto(`/?visual=${scenario}`);
            await page.waitForFunction(
                () =>
                    document.documentElement.dataset.visualReady === 'true'
            );

            await expect(page).toHaveScreenshot(`${scenario}.png`, {
                animations: 'disabled',
                maxDiffPixelRatio: 0.025,
                threshold: 0.2
            });
        });
    }
});
