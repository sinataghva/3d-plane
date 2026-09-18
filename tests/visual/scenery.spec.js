import { expect, test } from '@playwright/test';

test('loads regional scenery locally and exposes geographic map landmarks', async ({
    page
}) => {
    const external = [];
    page.on('request', (r) => {
        if (
            /^https?:/.test(r.url()) &&
            !r.url().startsWith('http://127.0.0.1:5173/')
        )
            external.push(r.url());
    });
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#scenery-loading')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open full map' }).click();
    await expect(page.locator('#world-map-canvas')).toHaveAttribute(
        'aria-label',
        /Versailles.*Saint-Cyr.*Bailly/
    );
    await expect(page.locator('#world-map-position')).toContainText(
        'Heading 113°'
    );
    const state = await page.evaluate(() => window.planeAutomation.getState());
    expect(state.altitudeMeters).toBe(0);
    expect(state.plane.position.x).toBeLessThan(-1500);
    expect(external).toEqual([]);
});
