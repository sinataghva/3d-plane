import { test, expect } from '@playwright/test';
for (const scenario of ['exhaust', 'exhaustBoost', 'chase']) {
    test(`${scenario} nozzle visual`, async ({ page }, info) => {
        await page.goto(`/3d-plane/?mission=luxeuil&visual=${scenario}`);
        await page.waitForFunction(
            () => document.documentElement.dataset.visualReady === 'true'
        );
        await page.screenshot({ path: info.outputPath(`${scenario}.png`) });
        await expect(page.locator('body')).not.toHaveClass(/has-runtime-error/);
    });
}
for (const mobile of [false, true]) {
    test(`landing feedback ${mobile ? 'mobile' : 'desktop'} clears view and expires`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: mobile
                ? { width: 852, height: 393 }
                : { width: 1280, height: 720 },
            hasTouch: mobile,
            isMobile: mobile
        });
        const page = await context.newPage();
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await page.evaluate(async () => {
            const { showLandingFeedback } =
                await import('/3d-plane/src/ui/experience.js');
            const schedule = window.setTimeout;
            window.setTimeout = (callback, delay, ...args) =>
                schedule(callback, delay === 3000 ? 20000 : delay, ...args);
            showLandingFeedback(
                document.getElementById('flight-feedback'),
                'Runway landing · Smooth touchdown · 1.2 m/s descent.'
            );
            window.setTimeout = schedule;
            document
                .getElementById('flight-feedback')
                .getAnimations()
                .forEach((a) => a.pause());
        });
        const feedback = page.locator('#flight-feedback');
        await expect(feedback).toBeVisible();
        const bounds = await feedback.boundingBox();
        expect(bounds.y + bounds.height).toBeLessThan(mobile ? 100 : 120);
        for (const selector of [
            '#flight-data',
            '#settings-button',
            '#mini-map'
        ]) {
            const other = await page.locator(selector).boundingBox();
            expect(
                bounds.x + bounds.width <= other.x ||
                    bounds.x >= other.x + other.width ||
                    bounds.y + bounds.height <= other.y ||
                    bounds.y >= other.y + other.height
            ).toBe(true);
        }
        await page.screenshot({ path: info.outputPath('landing.png') });
        await page.evaluate(async () => {
            const { showLandingFeedback } =
                await import('/3d-plane/src/ui/experience.js');
            showLandingFeedback(
                document.getElementById('flight-feedback'),
                'Runway landing · Smooth touchdown · 1.2 m/s descent.'
            );
        });
        await expect(feedback).toBeHidden({ timeout: 4000 });
        await context.close();
    });
}
