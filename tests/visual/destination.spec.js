import { test, expect } from '@playwright/test';
for (const mobile of [false, true])
    test.describe(mobile ? 'touch destination' : 'desktop destination', () => {
        test.use(
            mobile
                ? {
                      hasTouch: true,
                      isMobile: true,
                      viewport: { width: 844, height: 390 }
                  }
                : {}
        );
        test('select, fly toward, replace, clear and reset a destination', async ({
            page
        }, info) => {
            test.setTimeout(60000);
            await page.goto('/3d-plane/?mission=luxeuil&automation=1');
            await page.waitForFunction(() => Boolean(window.planeAutomation));
            await page.getByRole('button', { name: 'Open full map' }).click();
            const canvas = page.locator('#world-map-canvas');
            const box = await canvas.boundingBox();
            await canvas.click({
                position: { x: box.width / 2, y: box.height / 2 }
            });
            await expect(page.locator('#clear-destination')).toBeEnabled();
            const first = JSON.parse(
                await canvas.getAttribute('data-destination')
            );
            expect(Number.isFinite(first.y)).toBe(true);
            await page.screenshot({
                path: info.outputPath('destination-map.png')
            });
            await page.locator('#close-world-map').click();
            await expect(page.locator('#destination-guidance')).toBeVisible();
            await page.screenshot({
                path: info.outputPath('destination-beacon.png')
            });
            await page.evaluate(() => {
                const a = window.planeAutomation;
                a.setControls({ throttle: 1, boost: true });
                a.step({ seconds: 10 });
                a.setControls({ pitch: 0.12 });
                a.step({ seconds: 3 });
                a.setControls({ pitch: 0, gearDown: false });
                a.step({ seconds: 8 });
            });
            expect(
                (await page.evaluate(() => window.planeAutomation.getState()))
                    .plane.isAirborne
            ).toBe(true);
            await page.screenshot({
                path: info.outputPath('destination-flight.png')
            });
            await page.getByRole('button', { name: 'Open full map' }).click();
            await canvas.click({
                position: { x: box.width / 2 + 35, y: box.height / 2 + 25 }
            });
            const next = JSON.parse(
                await canvas.getAttribute('data-destination')
            );
            expect(next.x).not.toBe(first.x);
            await page.locator('#clear-destination').click();
            await expect(canvas).toHaveAttribute('data-destination', '');
            await expect(page.locator('#destination-guidance')).toBeHidden();
            await canvas.click({
                position: { x: box.width / 2, y: box.height / 2 }
            });
            await page.locator('#close-world-map').click();
            await page.evaluate(() => window.planeAutomation.reset());
            await expect(page.locator('#destination-guidance')).toBeHidden();
        });
    });
