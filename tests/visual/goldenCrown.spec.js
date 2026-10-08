import { test, expect } from '@playwright/test';

test('Golden Crown model renders all review angles and gear control', async ({
    page
}, info) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/3d-plane/golden-crown.html');
    await page.waitForFunction(
        () => document.documentElement.dataset.visualReady === 'true'
    );
    for (const view of [
        'hero',
        'side',
        'opposite',
        'top',
        'underside',
        'crown',
        'tail',
        'tailPersian',
        'rear'
    ]) {
        await page.locator(`button[data-view="${view}"]`).click();
        await expect(
            page.locator(`button[data-view="${view}"]`)
        ).toHaveAttribute('aria-pressed', 'true');
        await page.screenshot({
            path: info.outputPath(`golden-crown-${view}.png`)
        });
    }
    for (const number of ['1', '2', '3', '4', '5', '6']) {
        await page.getByRole('combobox', { name: 'Aircraft number' }).selectOption(number);
        await expect(page.locator('html')).toHaveAttribute('data-aircraft-number', number);
        for (const view of ['tail', 'tailPersian']) {
            await page.locator(`button[data-view="${view}"]`).click();
            await page.screenshot({ path: info.outputPath(`number-${number}-${view}.png`) });
        }
    }
    await page.locator('#gear').click();
    await expect(page.locator('#gear')).toHaveAttribute(
        'aria-pressed',
        'false'
    );
    expect(errors).toEqual([]);
});

test('Golden Crown preview fits a touch viewport', async ({
    browser
}, info) => {
    const context = await browser.newContext({
        viewport: { width: 844, height: 390 },
        isMobile: true,
        hasTouch: true
    });
    const page = await context.newPage();
    await page.goto('/3d-plane/golden-crown.html');
    await page.waitForFunction(
        () => document.documentElement.dataset.visualReady === 'true'
    );
    await page.getByRole('combobox', { name: 'Aircraft number' }).selectOption('6');
    await page.locator('button[data-view="side"]').tap();
    await expect(page.locator('button[data-view="side"]')).toHaveAttribute(
        'aria-pressed',
        'true'
    );
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth
        )
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('golden-crown-mobile.png') });
    await context.close();
});
