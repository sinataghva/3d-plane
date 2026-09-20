import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil']) {
    test(`${mission} joined road bends`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/3d-plane/?mission=${mission}&visual=road-detail`);
        await page.waitForSelector('html[data-visual-ready=true]', {
            state: 'attached'
        });
        await page.screenshot({ path: info.outputPath('road-joins.png') });
        expect(errors).toEqual([]);
    });
}
