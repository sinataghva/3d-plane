import { test, expect } from '@playwright/test';
test.setTimeout(90000);
for (const view of [
    'azadi-detail',
    'milad-detail',
    'landmark-golestan',
    'landmark-tabiat',
    'landmark-saadabad',
    'landmark-niavaran',
    'landmark-university',
    'landmark-stadium',
    'tehran-horizon',
    'card'
]) {
    test(`Tehran ${view}`, async ({ page }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (e) => {
            if (e.type() === 'error' && /THREE|shader|WebGL/i.test(e.text()))
                errors.push(e.text());
        });
        await page.goto(`/3d-plane/?mission=tehran&visual=${view}`);
        await expect(page.locator('html')).toHaveAttribute(
            'data-visual-ready',
            'true',
            { timeout: 60000 }
        );
        await page.screenshot({ path: info.outputPath(`${view}.png`) });
        if (view === 'azadi-detail') {
            for (const axis of ['east', 'west', 'north', 'south']) {
                await page.goto(
                    `/3d-plane/?mission=tehran&visual=azadi-detail&azadi-view=${axis}`
                );
                await expect(page.locator('html')).toHaveAttribute(
                    'data-visual-ready',
                    'true',
                    { timeout: 60000 }
                );
                await page.screenshot({
                    path: info.outputPath(`azadi-${axis}.png`)
                });
            }
        }
        if (view === 'landmark-university') {
            await page.goto(
                '/3d-plane/?mission=tehran&visual=landmark-university&gate-view=rear'
            );
            await expect(page.locator('html')).toHaveAttribute(
                'data-visual-ready',
                'true',
                { timeout: 60000 }
            );
            await page.screenshot({
                path: info.outputPath('university-rear.png')
            });
            await page.goto(
                '/3d-plane/?mission=tehran&visual=landmark-university&gate-view=street'
            );
            await expect(page.locator('html')).toHaveAttribute(
                'data-visual-ready',
                'true',
                { timeout: 60000 }
            );
            await page.screenshot({
                path: info.outputPath('university-street.png')
            });
        }
        if (view === 'card') {
            await page.getByRole('button', { name: 'Open full map' }).click();
            await expect(page.locator('#world-map')).toBeVisible();
            await page.screenshot({
                path: info.outputPath('landmark-map.png')
            });
        }
        if (view === 'tehran-horizon') {
            await page.goto(
                '/3d-plane/?mission=tehran&visual=tehran-horizon&time=night'
            );
            await expect(page.locator('html')).toHaveAttribute(
                'data-visual-ready',
                'true',
                { timeout: 60000 }
            );
            await page.screenshot({
                path: info.outputPath('horizon-night.png')
            });
        }
        expect(errors).toEqual([]);
    });
}
