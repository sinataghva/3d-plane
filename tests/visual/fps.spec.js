import { test, expect } from '@playwright/test';
for (const mobile of [false, true])
    test(`FPS counter ${mobile ? 'mobile' : 'desktop'}`, async ({
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
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await expect(page.locator('#fps-counter')).toHaveText(/^\d+ FPS$/, {
            timeout: 20000
        });
        const box = await page.locator('#fps-counter').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(mobile ? 390 : 720);
        if (mobile) {
            const fire = await page.locator('[data-key="space"]').boundingBox();
            expect(fire.y + fire.height).toBeLessThanOrEqual(box.y);
        }
        await page.screenshot({ path: info.outputPath('fps.png') });
        await context.close();
    });
