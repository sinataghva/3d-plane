import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil'])
    for (const feature of ['rail', 'water', 'river']) {
        test(`${mission} ${feature} nearby detail`, async ({ page }, info) => {
            test.setTimeout(90000);
            const errors = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.goto(
                `/3d-plane/?mission=${mission}&visual=${feature}-detail`
            );
            await page.waitForFunction(
                () => document.documentElement.dataset.visualReady === 'true'
            );
            await page.screenshot({ path: info.outputPath('detail.png') });
            expect(errors).toEqual([]);
        });
    }

for (const feature of ['rail', 'river'])
    test(`mobile ${feature} detail`, async ({ browser }, info) => {
        const context = await browser.newContext({
            viewport: { width: 844, height: 390 },
            isMobile: true,
            hasTouch: true
        });
        const page = await context.newPage();
        await page.goto(`/3d-plane/?mission=luxeuil&visual=${feature}-detail`);
        await page.waitForFunction(
            () => document.documentElement.dataset.visualReady === 'true'
        );
        await page.screenshot({ path: info.outputPath('detail.png') });
        await expect(page.locator('body')).not.toHaveClass(/has-runtime-error/);
        await context.close();
    });
