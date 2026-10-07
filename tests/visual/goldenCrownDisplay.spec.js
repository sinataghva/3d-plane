import { test, expect } from '@playwright/test';

test('Tehran Golden Crown display supports deterministic maneuver review', async ({
    page
}, info) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/3d-plane/?mission=tehran&goldenCrown=review');
    const panel = page.locator('#golden-crown-review');
    await expect(panel).toHaveAttribute('data-ready', 'true', {
        timeout: 120000
    });
    for (const [time, name, view] of [
        [18, 'arrival', 'aerial'],
        [49, 'turn', 'aerial'],
        [78, 'opposed-rolls', 'aerial'],
        [84, 'solo-loops', 'solo'],
        [94, 'outward-exit', 'solo'],
        [112, 'inverted', 'solo'],
        [142, 'rejoin', 'wide'],
        [160, 'presentation', 'aerial'],
        [165, 'observer', 'ground'],
        [194, 'departure', 'wide']
    ]) {
        await page
            .getByRole('slider', { name: 'Show timeline' })
            .fill(String(time));
        await page
            .getByLabel('Display view', { exact: true })
            .selectOption(view);
        await expect(panel.locator('output')).toContainText(
            `${time.toFixed(1)} /`
        );
        await page.screenshot({ path: info.outputPath(`display-${name}.png`) });
    }
    await page
        .getByLabel('Smoke colors', { exact: true })
        .selectOption('white');
    await page.getByRole('slider', { name: 'Show timeline' }).fill('18');
    await page
        .getByLabel('Display view', { exact: true })
        .selectOption('aerial');
    await page.screenshot({ path: info.outputPath('display-white-smoke.png') });
    await page
        .getByLabel('Smoke colors', { exact: true })
        .selectOption('tricolor');
    await page.screenshot({
        path: info.outputPath('display-tricolor-smoke.png')
    });
    // Inspect trail continuity across the path, including an overhead orbit.
    await page.mouse.move(640, 200);
    await page.mouse.down();
    await page.mouse.move(900, 200, { steps: 20 });
    await page.mouse.up();
    await page.screenshot({ path: info.outputPath('display-smoke-side.png') });
    await page.mouse.move(640, 200);
    await page.mouse.down();
    await page.mouse.move(640, 400, { steps: 20 });
    await page.mouse.up();
    await page.screenshot({ path: info.outputPath('display-smoke-overhead.png') });
    await page.getByRole('slider', { name: 'Show timeline' }).fill('194');
    await page.getByRole('button', { name: '+1 second', exact: true }).click();
    await expect(panel.locator('output')).toContainText('195.0 /');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Pause', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.getByRole('button', { name: 'Hide display controls' }).click();
    await expect(page.getByRole('slider', { name: 'Show timeline' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Show display controls' })).toHaveAttribute('aria-expanded', 'false');
    await page.screenshot({ path: info.outputPath('display-controls-collapsed.png') });
    await page.getByRole('button', { name: 'Show display controls' }).click();
    await expect(page.getByRole('slider', { name: 'Show timeline' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to F-4' }).click();
    await expect(panel).toBeHidden();
    const watch = await page.locator('#golden-crown-watch').boundingBox();
    const feedback = await page.locator('#flight-feedback').boundingBox();
    if (watch && feedback) expect(watch.y).toBeGreaterThanOrEqual(feedback.y + feedback.height);
    await page.screenshot({ path: info.outputPath('display-watch-button-desktop.png') });
    await page.getByRole('button', { name: 'Watch Golden Crown' }).click();
    await expect(panel).toBeVisible();
    expect(errors).toEqual([]);
});

test('display review controls work on a touch viewport', async ({
    browser
}, info) => {
    test.setTimeout(180000);
    const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=tehran&goldenCrown=review');
    await expect(page.locator('#golden-crown-review')).toHaveAttribute(
        'data-ready',
        'true',
        { timeout: 120000 }
    );
    await page
        .getByLabel('Display maneuver', { exact: true })
        .selectOption('151');
    await page.getByRole('button', { name: '+1 second', exact: true }).tap();
    await expect(page.locator('#golden-crown-review output')).toContainText(
        '152.0 /'
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('display-mobile.png') });
    await page.getByRole('button', { name: 'Hide display controls' }).tap();
    await expect(page.getByRole('slider', { name: 'Show timeline' })).toBeHidden();
    await page.screenshot({ path: info.outputPath('display-controls-collapsed-mobile.png') });
    await page.getByRole('button', { name: 'Show display controls' }).tap();
    await expect(page.getByRole('slider', { name: 'Show timeline' })).toBeVisible();
    await page.getByRole('button', { name: 'Return to F-4' }).tap();
    const watch = await page.locator('#golden-crown-watch').boundingBox();
    const map = await page.locator('#mini-map').boundingBox();
    expect(watch).not.toBeNull();
    expect(map).not.toBeNull();
    if (watch && map) expect(watch.x + watch.width).toBeLessThanOrEqual(map.x);
    await page.screenshot({ path: info.outputPath('display-watch-button-mobile.png') });
    await context.close();
});
