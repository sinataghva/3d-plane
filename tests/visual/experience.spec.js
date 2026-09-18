import { expect, test } from '@playwright/test';

test('guides are optional, dismissible, and do not alter flight state', async ({
    page
}) => {
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await expect(page.locator('#guide-mode')).toHaveValue('free');
    await expect(page.locator('#guide-card')).toBeHidden();
    await page.getByLabel('Guide', { exact: true }).selectOption('circuit');
    await expect(page.locator('#guide-card')).toBeVisible();
    await page.getByRole('button', { name: 'Dismiss guide' }).click();
    await expect(page.locator('#guide-mode')).toHaveValue('free');
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().simulationSeconds
        )
    ).toBe(0);
});

test('mobile throttle, camera, pause and restart work', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await page.getByLabel('Thrust percent').fill('100');
    await expect(page.locator('#thrust-value')).toHaveText('100');
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.locator('#pause-overlay')).toBeVisible();
    const position = await page.evaluate(
        () => window.planeAutomation.getState().plane.position
    );
    await page.getByRole('button', { name: 'Camera: Chase' }).click();
    await expect(
        page.getByRole('button', { name: 'Camera: Cockpit' })
    ).toBeVisible();
    expect(
        await page.evaluate(
            () => window.planeAutomation.getState().plane.position
        )
    ).toEqual(position);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(page.locator('#pause-overlay')).toBeHidden();
    await expect(page.locator('#thrust-value')).toHaveText('0');
});

test('crash waits for manual retry', async ({ page }) => {
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ throttle: 1 });
        api.step({ seconds: 1 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 1 });
        api.setControls({ pitch: -1, throttle: 0 });
        api.step({ seconds: 10 });
    });
    await expect(
        page.getByRole('button', { name: 'Return to runway' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Take control' }).click();
    // Wait beyond the old automatic restart delay.
    await page.waitForTimeout(2400);
    await expect(
        page.getByRole('button', { name: 'Return to runway' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Return to runway' }).click();
    await expect(page.locator('#crash-overlay')).toBeHidden();
    await expect(page.locator('#thrust-value')).toHaveText('0');
});

test('takeoff bounce is not reported as a landing and cockpit guide clears gauges', async ({
    page
}) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
    await page.getByLabel('Guide', { exact: true }).selectOption('circuit');
    await page.evaluate(() => {
        const api = window.planeAutomation;
        api.setControls({ throttle: 1 });
        api.step({ seconds: 1 });
        api.setControls({ pitch: 0.3 });
        api.step({ seconds: 0.75 });
        api.setControls({ pitch: 0 });
        api.step({ seconds: 5 });
    });
    await expect(page.locator('#flight-feedback')).toBeHidden();
    await page.getByRole('button', { name: 'Camera: Chase' }).click();
    await expect(page.locator('#cockpit-overlay')).toBeVisible();
    const hint = await page.locator('#guide-card').boundingBox();
    const gauges = await page.locator('.cockpit-instruments').boundingBox();
    expect(hint.y + hint.height).toBeLessThan(gauges.y);
});
