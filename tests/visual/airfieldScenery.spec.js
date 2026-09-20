import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil']) {
    for (const mobile of [false, true]) {
        test(`${mission} airfield scenery ${mobile ? 'mobile' : 'desktop'}`, async ({
            browser
        }, info) => {
            test.setTimeout(90000);
            const context = await browser.newContext({
                viewport: mobile
                    ? { width: 844, height: 390 }
                    : { width: 1280, height: 720 },
                hasTouch: mobile,
                isMobile: mobile
            });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (e) => errors.push(e.message));
            for (const view of mission === 'luxeuil' && !mobile
                ? ['airfield', 'shelter', 'tower']
                : ['airfield']) {
                await page.goto(
                    `/3d-plane/?mission=${mission}&visual=${view}-detail`
                );
                await page.waitForFunction(
                    () =>
                        document.documentElement.dataset.visualReady === 'true'
                );
                await page.screenshot({ path: info.outputPath(`${view}.png`) });
                await page.waitForFunction(() =>
                    Boolean(document.documentElement.dataset.sceneryStats)
                );
                const stats = await page.evaluate(() =>
                    JSON.parse(document.documentElement.dataset.sceneryStats)
                );
                expect(stats.detailedAirfieldBuildings).toBeGreaterThan(
                    mission === 'luxeuil' ? 70 : 10
                );
                expect(stats.groundDetailTiles).toBeLessThanOrEqual(80);
                expect(stats.groundDetailGeometries).toBeLessThanOrEqual(
                    80 * 12
                );
            }
            expect(errors).toEqual([]);
            await context.close();
        });
    }
}
