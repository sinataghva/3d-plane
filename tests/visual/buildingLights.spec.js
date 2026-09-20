import { test, expect } from '@playwright/test';
for (const mission of ['luxeuil', 'saint-cyr']) {
    test(`${mission} civilian windows render in night and sunset`, async ({
        page
    }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        for (const time of ['day', 'sunset', 'night']) {
            await page.goto(
                `/?mission=${mission}&visual=town-detail&time=${time}`
            );
            await page.waitForFunction(
                () => document.documentElement.dataset.visualReady === 'true'
            );
            await page.screenshot({ path: info.outputPath(`${time}.png`) });
        }
        expect(errors).toEqual([]);
    });
}
