import { test, expect } from '@playwright/test';

test('mobile viewport, hit targets, compact HUD and home screen assets', async ({
    browser
}, info) => {
    test.setTimeout(60000);
    const context = await browser.newContext({
        viewport: { width: 852, height: 393 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    for (const size of [
        { width: 393, height: 852 },
        { width: 852, height: 393 }
    ])
        await page.setViewportSize(size);
    await page.waitForTimeout(500);
    const result = await page.evaluate(() => {
        const selectors = [
            '.touch-fire',
            '#touch-throttle',
            '#gear-button',
            '#settings-button',
            '#mini-map'
        ];
        return selectors.map((selector) => {
            const el = document.querySelector(selector),
                r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2
            );
            return {
                selector,
                aligned: hit === el || el.contains(hit),
                inside:
                    r.x >= 0 &&
                    r.y >= 0 &&
                    r.right <= innerWidth &&
                    r.bottom <= innerHeight
            };
        });
    });
    expect(result.every((r) => r.aligned && r.inside)).toBe(true);
    const hud = await page.locator('#flight-data').boundingBox();
    expect(hud.height).toBeLessThan(130);
    expect(hud.y).toBeLessThan(15);
    await page.locator('#mobile-data-toggle').tap();
    await expect(page.locator('#mobile-data-toggle')).toHaveAttribute(
        'aria-expanded',
        'true'
    );
    await page.locator('#mobile-data-toggle').tap();
    await page.locator('.touch-fire').tap();
    await page.locator('.touch-fire').tap();
    expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
    expect(await page.evaluate(() => getSelection().toString())).toBe('');
    await expect(page.locator('.mini-map-header')).toHaveCount(0);
    const manifest = await (
        await page.request.get('/3d-plane/manifest.webmanifest')
    ).json();
    expect(manifest.display).toBe('standalone');
    expect(
        (await page.request.get('/3d-plane/icons/apple-touch-icon.png')).ok()
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('mobile.png') });
    await context.close();
});

test('joystick cancels native tap defaults and releases after repeated touch input', async ({
    browser
}, info) => {
    const context = await browser.newContext({
        viewport: { width: 852, height: 393 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    const stick = page.locator('[data-stick]');
    const cancelled = await stick.evaluate((el) =>
        ['touchstart', 'touchmove', 'touchend', 'dblclick'].map(
            (type) =>
                !el.dispatchEvent(
                    type.startsWith('touch')
                        ? new TouchEvent(type, {
                              bubbles: true,
                              cancelable: true
                          })
                        : new MouseEvent(type, {
                              bubbles: true,
                              cancelable: true
                          })
                )
        )
    );
    expect(cancelled).toEqual([true, true, true, true]);
    const box = await stick.boundingBox();
    const touch = await context.newCDPSession(page);
    for (let i = 0; i < 4; i++) {
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
                { x: box.x + box.width * 0.7, y: box.y + box.height * 0.35 }
            ]
        });
        await expect(stick).toHaveAttribute('data-active', 'true');
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await expect(stick).toHaveAttribute('data-active', 'false');
    }
    expect(await page.evaluate(() => visualViewport.scale)).toBe(1);
    await touch.send('Emulation.setPageScaleFactor', { pageScaleFactor: 2 });
    await expect(page.locator('body')).toHaveClass(/browser-zoomed/);
    expect(
        await stick.evaluate((el) => getComputedStyle(el).touchAction)
    ).toMatch(/manipulation|pinch-zoom/);
    await touch.send('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
    await expect(page.locator('body')).not.toHaveClass(/browser-zoomed/);
    await expect(page.locator('body')).not.toHaveClass(/has-runtime-error/);
    await page.screenshot({ path: info.outputPath('joystick-taps.png') });
    await context.close();
});
