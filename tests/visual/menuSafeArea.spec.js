import { test, expect } from '@playwright/test';

test('iPhone menus respect safe insets across rotation and standalone-sized viewports', async ({
    browser
}, info) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
        viewport: { width: 393, height: 852 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();

    const cases = [
        { width: 393, height: 852, top: 59, bottom: 34, left: 0, right: 0 },
        { width: 852, height: 393, top: 0, bottom: 21, left: 59, right: 59 },
        { width: 393, height: 659, top: 0, bottom: 34, left: 0, right: 0 },
        { width: 852, height: 320, top: 0, bottom: 21, left: 59, right: 59 }
    ];
    await page.goto('/3d-plane/');
    for (const size of cases) {
        await page.setViewportSize({ width: size.width, height: size.height });
        // Chromium cannot emulate iOS safe-area env values; inject their CSS inputs.
        await page.evaluate((size) => {
            for (const side of ['top', 'right', 'bottom', 'left'])
                document.documentElement.style.setProperty(
                    `--safe-${side}`,
                    `${size[side]}px`
                );
        }, size);
        for (const selector of [
            '.mission-heading',
            '[data-mission="saint-cyr"]',
            '[data-mission="luxeuil"]',
            '.mission-footer'
        ]) {
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(size.left + 12);
            expect(box.y).toBeGreaterThanOrEqual(size.top + 12);
            expect(box.x + box.width).toBeLessThanOrEqual(
                size.width - size.right - 12
            );
            expect(box.y + box.height).toBeLessThanOrEqual(
                size.height - size.bottom - 12
            );
        }
        expect(
            await page
                .locator('#mission-select')
                .evaluate((e) => e.scrollHeight <= e.clientHeight)
        ).toBe(true);
        await page.locator('[data-mission="luxeuil"]').tap();
        await expect(page.locator('#fly-button')).toContainText('Luxeuil');
        await page.screenshot({
            path: info.outputPath(`picker-${size.width}-${size.height}.png`)
        });
    }
    await page.locator('#fly-button').tap();
    await expect(page.locator('#settings-button')).toBeVisible();
    for (const size of cases.slice(0, 2)) {
        await page.setViewportSize({ width: size.width, height: size.height });
        // Chromium cannot emulate iOS safe-area env values; inject their CSS inputs.
        await page.evaluate((size) => {
            for (const side of ['top', 'right', 'bottom', 'left'])
                document.documentElement.style.setProperty(
                    `--safe-${side}`,
                    `${size[side]}px`
                );
        }, size);
        const button = await page.locator('#settings-button').boundingBox();
        expect(button.y).toBeGreaterThanOrEqual(size.top + 8);
        expect(button.x + button.width).toBeLessThanOrEqual(
            size.width - size.right - 8
        );
        await page.locator('#settings-button').tap();
        const dialog = await page.locator('#settings-dialog').boundingBox();
        expect(dialog.x).toBeGreaterThanOrEqual(size.left + 12);
        expect(dialog.y).toBeGreaterThanOrEqual(size.top + 12);
        expect(dialog.x + dialog.width).toBeLessThanOrEqual(
            size.width - size.right - 12
        );
        expect(dialog.y + dialog.height).toBeLessThanOrEqual(
            size.height - size.bottom - 12
        );
        await page.screenshot({
            path: info.outputPath(`settings-${size.width}.png`)
        });
        await page.locator('#close-settings').tap();
        await expect(page.locator('#settings-dialog')).not.toBeVisible();
        // The game hides flight HUD in portrait; open before rotating to verify the map.
        if (size.width < size.height) await page.keyboard.down('m');
        else await page.locator('#mini-map').tap();
        await expect(page.locator('#world-map')).toBeVisible();
        for (const selector of [
            '.world-map-header',
            '#world-map-canvas',
            '#world-map footer'
        ]) {
            const box = await page.locator(selector).boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(size.left + 12);
            expect(box.y).toBeGreaterThanOrEqual(size.top + 12);
            expect(box.x + box.width).toBeLessThanOrEqual(
                size.width - size.right - 12
            );
            expect(box.y + box.height).toBeLessThanOrEqual(
                size.height - size.bottom - 12
            );
        }
        await page.screenshot({
            path: info.outputPath(`map-${size.width}.png`)
        });
        await page.locator('#close-world-map').tap();
        await expect(page.locator('#world-map')).not.toBeVisible();
        await page.keyboard.up('m');
    }
    await context.close();
});

test('map reuses HUD margins when modal insets resolve to zero', async ({
    browser
}, info) => {
    test.setTimeout(90000);
    const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=luxeuil');
    await expect(page.locator('#mini-map')).toBeVisible();
    // Reproduce the reported difference: flight HUD is safely inset but the
    // map receives zero insets. No device-size fallback is used by the game.
    await page.addStyleTag({
        content:
            '#flight-data {left:59px} #mini-map {right:59px} #world-map {--safe-left:0px;--safe-right:0px}'
    });
    await page.locator('#mini-map').tap();
    for (const selector of [
        '.world-map-header',
        '#world-map-canvas',
        '#world-map footer'
    ]) {
        const box = await page.locator(selector).boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(71);
        expect(box.x + box.width).toBeLessThanOrEqual(803);
    }
    await page.locator('#map-zoom-in').tap();
    await expect(page.locator('#map-zoom-level')).toContainText('120%');
    await page.screenshot({ path: info.outputPath('map-matches-hud.png') });
    await page.locator('#close-world-map').tap();
    await expect(page.locator('#world-map')).not.toBeVisible();
    await context.close();
});
