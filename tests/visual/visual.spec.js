import { expect, test } from '@playwright/test';

const SCENARIOS = ['chase', 'cockpit', 'orbit', 'warning', 'crash'];

test('afterburner remains visible over detailed runway surfaces', async ({ page }) => {
    await page.goto('/?mission=luxeuil&visual=afterburner');
    await page.waitForFunction(
        () => document.documentElement.dataset.visualReady === 'true'
    );
    await expect(page).toHaveScreenshot('afterburner-road.png', {
        animations: 'disabled',
        maxDiffPixels: 50,
        threshold: 0.2
    });
});

test.describe('3D plane visual states', () => {
    for (const scenario of SCENARIOS) {
        test(`${scenario} view matches baseline`, async ({ page }) => {
            await page.goto(`/?visual=${scenario}`);
            await page.waitForFunction(
                () => document.documentElement.dataset.visualReady === 'true'
            );

            await expect(page).toHaveScreenshot(`${scenario}.png`, {
                animations: 'disabled',
                maxDiffPixelRatio: 0.025,
                threshold: 0.2
            });
        });
    }
});
