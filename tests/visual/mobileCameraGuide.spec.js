import { test, expect } from '@playwright/test';

for (const [width, height] of [
    [844, 390],
    [390, 844]
])
    test(`mobile camera shortcut and concise guide ${width}x${height}`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: { width, height },
            isMobile: true,
            hasTouch: true
        });
        const page = await context.newPage();
        await page.goto('/3d-plane/?mission=tehran');
        await expect(page.locator('#scenery-loading')).toHaveCount(0, {
            timeout: 45000
        });
        const button = page.getByRole('button', {
            name: 'Switch camera view',
            exact: true
        });
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        for (const selector of ['#photo-button', '#settings-button']) {
            const other = await page.locator(selector).boundingBox();
            expect(
                box.x + box.width <= other.x || other.x + other.width <= box.x
            ).toBe(true);
        }
        for (const mode of ['Cockpit', 'Orbit', 'Chase']) {
            await button.tap();
            await expect(page.locator('#camera-mode-value')).toHaveText(mode);
        }
        await page.screenshot({ path: info.outputPath('camera-shortcut.png') });
        const guide = page.locator('#instructions-panel');
        await expect(guide).toContainText('Drop one bomb');
        await expect(guide).toContainText('Toggle landing gear');
        await expect(guide).not.toContainText('No gun');
        await expect(guide).not.toContainText('not available');
        await expect(guide).not.toContainText('F-4 Phantom');
        expect(
            await guide
                .locator('li')
                .evaluateAll((items) =>
                    items.every(
                        (item) =>
                            item.querySelector('kbd') &&
                            item.textContent.length < 65
                    )
                )
        ).toBe(true);
        await context.close();
    });

test('desktop keeps its existing toolbar and keyboard camera control', async ({
    page
}, info) => {
    await page.goto('/3d-plane/?mission=tehran');
    await expect(page.locator('#scenery-loading')).toHaveCount(0, {
        timeout: 45000
    });
    await expect(page.locator('#camera-shortcut')).toBeHidden();
    await page.keyboard.press('c');
    await expect(page.locator('#camera-mode-value')).toHaveText('Cockpit');
    await page.locator('#instructions-panel summary').click();
    await page.screenshot({ path: info.outputPath('concise-guide.png') });
    await page
        .locator('#instructions-panel')
        .evaluate((el) => (el.scrollTop = el.scrollHeight));
    await page.screenshot({
        path: info.outputPath('concise-guide-bottom.png')
    });
});

for (const view of ['smoke', 'expired'])
    test(`bomb effect ${view}`, async ({ page }, info) => {
        await page.goto(`/3d-plane/?mission=tehran&visual=bombs-${view}`);
        await expect(page.locator('html')).toHaveAttribute(
            'data-visual-ready',
            'true',
            { timeout: 60000 }
        );
        const stats = JSON.parse(
            await page.locator('html').getAttribute('data-scenery-stats')
        );
        expect(stats.bombEffects).toBe(view === 'smoke' ? 1 : 0);
        expect(stats.bombSmokeCount).toBe(view === 'smoke' ? 1 : 0);
        await page.screenshot({ path: info.outputPath(`${view}.png`) });
    });
