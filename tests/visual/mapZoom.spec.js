import { test, expect } from '@playwright/test';
test('wheel zoom, drag, selection, fit and reopening work together', async ({
    page
}, info) => {
    test.setTimeout(60000);
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.getByRole('button', { name: 'Open full map' }).click();
    const canvas = page.locator('#world-map-canvas');
    const box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    const first = JSON.parse(await canvas.getAttribute('data-destination'));
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 300);
    await expect
        .poll(async () => Number(await canvas.getAttribute('data-zoom')))
        .toBeGreaterThan(1);
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    const same = JSON.parse(await canvas.getAttribute('data-destination'));
    expect(same.x).toBeCloseTo(first.x, 3);
    expect(same.z).toBeCloseTo(first.z, 3);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
        box.x + box.width / 2 + 60,
        box.y + box.height / 2 + 30,
        { steps: 8 }
    );
    await page.mouse.up();
    expect(JSON.parse(await canvas.getAttribute('data-destination'))).toEqual(
        same
    );
    await page.screenshot({ path: info.outputPath('zoomed-map.png') });
    const zoom = await canvas.getAttribute('data-zoom');
    await page.locator('#close-world-map').click();
    await page.getByRole('button', { name: 'Open full map' }).click();
    await expect(canvas).toHaveAttribute('data-zoom', zoom);
    await page.locator('#map-fit').click();
    await expect(canvas).toHaveAttribute('data-zoom', '1');
    await expect(page.locator('#map-zoom-out')).toBeDisabled();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -500);
    await expect(canvas).toHaveAttribute('data-zoom', '1');
});
test.describe('touch zoom', () => {
    test.use({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 844, height: 390 }
    });
    test('pinch zooms without choosing a destination', async ({
        page
    }, info) => {
        await page.goto('/3d-plane/?mission=luxeuil&automation=1');
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await page.getByRole('button', { name: 'Open full map' }).click();
        const canvas = page.locator('#world-map-canvas');
        const box = await canvas.boundingBox();
        const x = box.x + box.width / 2,
            y = box.y + box.height / 2;
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
                { x: x - 30, y, id: 1 },
                { x: x + 30, y, id: 2 }
            ]
        });
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [
                { x: x - 70, y, id: 1 },
                { x: x + 70, y, id: 2 }
            ]
        });
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await expect
            .poll(async () => Number(await canvas.getAttribute('data-zoom')))
            .toBeGreaterThan(1);
        await expect(canvas).toHaveAttribute('data-destination', '');
        await page.screenshot({ path: info.outputPath('touch-zoom.png') });
        await page.locator('#map-fit').tap();
        await expect(canvas).toHaveAttribute('data-zoom', '1');
    });
});
