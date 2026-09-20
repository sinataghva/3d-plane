import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil'])
    for (const mobile of [false, true]) {
        test(`${mission} service vehicles ${mobile ? 'mobile' : 'desktop'}`, async ({
            browser
        }, info) => {
            const context = await browser.newContext({
                viewport: mobile
                    ? { width: 844, height: 390 }
                    : { width: 1280, height: 720 },
                isMobile: mobile,
                hasTouch: mobile
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(e.message));
            await page.goto(
                `/3d-plane/?mission=${mission}&visual=service-detail`
            );
            await page.waitForFunction(
                () => document.documentElement.dataset.visualReady === 'true'
            );
            await page.screenshot({
                path: info.outputPath('service-vehicles.png')
            });
            const stats = await page.evaluate(() =>
                JSON.parse(document.documentElement.dataset.sceneryStats)
            );
            expect(stats.serviceVehicles).toBeGreaterThan(0);
            expect(stats.serviceVehicles).toBeLessThanOrEqual(
                mission === 'luxeuil' ? 12 : 6
            );
            expect(errors).toEqual([]);
            await context.close();
        });
    }
