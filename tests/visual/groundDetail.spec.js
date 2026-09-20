import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil'])
    test(`${mission} ground detail changes by quality and stays bounded in flight`, async ({
        page
    }, info) => {
        test.setTimeout(90000);
        await page.goto(`/3d-plane/?mission=${mission}&automation=1`);
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await page.waitForFunction(
            () =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                ).groundDetailVisible > 0
        );
        await page.waitForTimeout(2500);
        const initial = await page.evaluate(() =>
            JSON.parse(document.documentElement.dataset.sceneryStats)
        );
        expect(initial.groundDetailTiles).toBeLessThanOrEqual(80);
        await page.screenshot({ path: info.outputPath('high-ground.png') });
        await page.evaluate((jet) => {
            const a = window.planeAutomation;
            a.setControls({ throttle: 1, boost: jet });
            a.step({ seconds: jet ? 10 : 1 });
            a.setControls({ pitch: jet ? 0.12 : 0.3 });
            a.step({ seconds: jet ? 3 : 1 });
            a.setControls({ pitch: 0, gearDown: false });
            a.step({ seconds: 10 });
        }, mission === 'luxeuil');
        expect(
            (await page.evaluate(() => window.planeAutomation.getState())).plane
                .isAirborne
        ).toBe(true);
        await page.waitForTimeout(2500);
        await page.screenshot({ path: info.outputPath('high-flight.png') });
        await page.locator('#settings-button').click();
        await page.locator('#graphics-quality').selectOption('balanced');
        await page.waitForFunction(
            () =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                ).groundDetailVisible <= 20
        );
        await page.locator('#graphics-quality').selectOption('low');
        await page.waitForFunction(
            () =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                ).groundDetailVisible === 0
        );
        await page.locator('#graphics-quality').selectOption('high');
        await page.waitForTimeout(5000);
        const end = await page.evaluate(() =>
            JSON.parse(document.documentElement.dataset.sceneryStats)
        );
        expect(end.groundDetailTiles).toBeLessThanOrEqual(80);
        expect(end.groundDetailGeometries).toBeLessThanOrEqual(80 * 12);
    });
for (const mission of ['saint-cyr', 'luxeuil'])
    test(`mobile ${mission} detail stays readable on the runway and in flight`, async ({
        browser
    }, info) => {
        test.setTimeout(60000);
        const context = await browser.newContext({
            hasTouch: true,
            isMobile: true,
            viewport: { width: 844, height: 390 }
        });
        const page = await context.newPage();
        await page.goto(`/3d-plane/?mission=${mission}&automation=1`);
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await page.waitForFunction(
            () =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                ).groundDetailVisible > 0
        );
        await page.waitForTimeout(2000);
        await page.screenshot({ path: info.outputPath('mobile-ground.png') });
        await page.evaluate((jet) => {
            const a = window.planeAutomation;
            a.setControls({ throttle: 1, boost: jet });
            a.step({ seconds: jet ? 10 : 1 });
            a.setControls({ pitch: jet ? 0.12 : 0.3 });
            a.step({ seconds: jet ? 3 : 1 });
            a.setControls({ pitch: 0, gearDown: false });
            a.step({ seconds: 8 });
        }, mission === 'luxeuil');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: info.outputPath('mobile-flight.png') });
        expect(
            (await page.evaluate(() => window.planeAutomation.getState())).plane
                .isCrashed
        ).toBe(false);
        await context.close();
    });

test('detail cache stays capped across travel, fades at altitude, and disposes', async ({
    page
}) => {
    test.setTimeout(60000);
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    const result = await page.evaluate(async () => {
        const { createGroundDetail } =
            await import('/3d-plane/src/groundDetail.js');
        // Vite may append an HMR timestamp; read the running game's singleton.
        const geographyUrl = performance
            .getEntriesByType('resource')
            .map((r) => r.name)
            .find((n) => /\/src\/geography\.js(?:\?|$)/.test(n));
        const { getGeography } = await import(geographyUrl);
        const world = getGeography();
        const detail = createGroundDetail(world);
        let maximum = 0;
        for (let n = 0; n < 12; n++) {
            const x = world.spawn.x + n * 700,
                z = world.spawn.z + n * 350;
            for (let i = 0; i < 30; i++) {
                detail.update({ x, y: world.height(x, z) + 5, z }, 'high', 0.1);
                maximum = Math.max(maximum, detail.stats().groundDetailTiles);
            }
        }
        for (let i = 0; i < 80; i++)
            detail.update(
                { x: world.spawn.x, y: 6000, z: world.spawn.z },
                'high',
                0.1
            );
        const atAltitude = detail.stats();
        detail.dispose();
        return { maximum, atAltitude, disposed: detail.stats() };
    });
    expect(result.maximum).toBeLessThanOrEqual(80);
    expect(result.atAltitude.groundDetailVisible).toBe(0);
    expect(result.disposed.groundDetailTiles).toBe(0);
});
