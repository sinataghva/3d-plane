import { expect, test } from '@playwright/test';

test('Saint-Cyr smoke toggles by press and leaves a fading trail', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.goto('/3d-plane/?mission=saint-cyr&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ throttle: 1 });
        api.step({ seconds: 1 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 0.75 });
        api.setControls({ pitch: 0, fire: true });
        api.step({ seconds: 2 });
    });
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().plane.smokeOn
        )
    ).toBe(true);
    await page.waitForTimeout(500);
    await page.screenshot({
        path: info.outputPath('saint-cyr-blue-smoke-chase.png')
    });
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    await page.waitForTimeout(300);
    await page.screenshot({
        path: info.outputPath('saint-cyr-blue-smoke-orbit.png')
    });
    await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ fire: false });
        api.setControls({ fire: true });
        api.step({ seconds: 8 });
    });
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().plane.smokeOn
        )
    ).toBe(false);
    await page.getByRole('button', { name: 'Take control' }).click();
    await page.keyboard.press('Space');
    await expect(page.locator('.touch-fire')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    await page.keyboard.press('Space');
    await expect(page.locator('.touch-fire')).toHaveAttribute(
        'aria-pressed',
        'false'
    );
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator('.touch-fire')).toBeVisible();
    await page.locator('.touch-fire').click();
    await expect(page.locator('.touch-fire')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
});

test('Saint-Cyr mobile smoke button toggles on each tap', async ({
    browser
}, info) => {
    const context = await browser.newContext({
        viewport: { width: 852, height: 393 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=saint-cyr&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.getByRole('button', { name: 'Take control' }).tap();
    const button = page.locator('.touch-fire');
    await expect(button).toHaveText('Smoke');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({
        path: info.outputPath('saint-cyr-smoke-mobile.png')
    });
    await button.tap();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await context.close();
});
