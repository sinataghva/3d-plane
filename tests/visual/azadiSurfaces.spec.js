import { test, expect } from '@playwright/test';
test('Azadi gardens and road junctions from above', async ({ page }, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
        '/3d-plane/?mission=tehran&visual=azadi-detail&azadi-view=surfaces'
    );
    await expect(page.locator('html')).toHaveAttribute(
        'data-visual-ready',
        'true',
        { timeout: 60000 }
    );
    await page.screenshot({ path: info.outputPath('azadi-surfaces.png') });
    expect(errors).toEqual([]);
});
