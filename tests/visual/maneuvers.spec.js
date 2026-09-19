import { test, expect } from '@playwright/test';
async function airborne(page) {
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.evaluate(() => {
        const a = window.planeAutomation;
        a.setControls({ throttle: 1, boost: true });
        a.step({ seconds: 10 });
        a.setControls({ pitch: 0.12 });
        a.step({ seconds: 3 });
        a.setControls({ pitch: 0, gearDown: false });
        a.step({ seconds: 10 });
    });
}
test('desktop controls roll fully and gear changes through visible intermediate positions', async ({
    page
}, testInfo) => {
    await airborne(page);
    await page.evaluate(() => window.planeAutomation.release());
    await page
        .locator('#canvas-container canvas')
        .click({ position: { x: 620, y: 300 } });
    await page.keyboard.press('g');
    await expect(page.locator('#gear-button')).toContainText('extending');
    await page.waitForFunction(() => {
        const s = window.planeAutomation.getState().plane;
        return s.gearExtension > 0.25 && s.gearExtension < 0.9;
    });
    await page.keyboard.press('c');
    await page.keyboard.press('c');
    await page.screenshot({ path: testInfo.outputPath('gear-transition.png') });
    await expect(page.locator('#gear-button')).toContainText('down');
    await page
        .locator('#canvas-container canvas')
        .click({ position: { x: 620, y: 300 } });
    await page.keyboard.press('g');
    await expect(page.locator('#gear-button')).toContainText('retracting');
    await expect(page.locator('#gear-button')).toContainText('up');
    await page
        .locator('#canvas-container canvas')
        .click({ position: { x: 620, y: 300 } });
    await page.keyboard.down('ArrowRight');
    await page.waitForFunction(
        () => Math.abs(window.planeAutomation.getState().plane.rollAngle) > 2.8
    );
    await page.screenshot({
        path: testInfo.outputPath('desktop-inverted.png')
    });
    await page.waitForFunction(
        () => Math.abs(window.planeAutomation.getState().plane.rollAngle) < 0.3
    );
    await page.keyboard.up('ArrowRight');
    await expect
        .poll(async () =>
            Math.abs(
                (await page.evaluate(() => window.planeAutomation.getState()))
                    .plane.rollAngle
            )
        )
        .toBeLessThan(0.08);
    expect(
        (await page.evaluate(() => window.planeAutomation.getState())).plane
            .isCrashed
    ).toBe(false);
});
test('bank and elevator produce high-G turning with coherent camera and telemetry', async ({
    page
}, testInfo) => {
    await airborne(page);
    const result = await page.evaluate(() => {
        const a = window.planeAutomation;
        let peakG = 0;
        const before = a.getState().plane.yawAngle;
        for (let i = 0; i < 240; i++) {
            const s = a.getState().plane;
            a.setControls({
                roll:
                    Math.max(-1, Math.min(1, (1.05 - s.rollAngle) * 3)) || 1e-6,
                fire: true,
                pitch: 0.85
            });
            a.step({ seconds: 1 / 60 });
            peakG = Math.max(peakG, a.getState().plane.gForce);
        }
        return {
            peakG,
            turn: Math.abs(a.getState().plane.yawAngle - before),
            state: a.getState()
        };
    });
    expect(result.peakG).toBeGreaterThan(6);
    expect(result.turn).toBeGreaterThan(0.6);
    expect(result.state.plane.isCrashed).toBe(false);
    await expect(page.locator('#jet-readout')).toContainText('Mach');
    await page.screenshot({ path: testInfo.outputPath('bank-and-pull.png') });
});

test.describe('touch maneuvers', () => {
    test.use({ hasTouch: true, isMobile: true });
    test('touch stick rolls beyond vertical and gear animates on tap', async ({
        page
    }, testInfo) => {
        await page.setViewportSize({ width: 844, height: 390 });
        await airborne(page);
        await page.evaluate(() => window.planeAutomation.release());
        await page.locator('#gear-button').tap();
        await expect(page.locator('#gear-button')).toContainText('extending');
        await page.waitForFunction(() => {
            const s = window.planeAutomation.getState().plane;
            return s.gearExtension > 0.1 && s.gearExtension < 0.95;
        });
        await expect(page.locator('#gear-button')).toContainText('down');
        const box = await page.locator('[data-stick]').boundingBox();
        const touch = await page.context().newCDPSession(page);
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchStart',
            touchPoints: [
                { x: box.x + box.width * 0.9, y: box.y + box.height / 2 }
            ]
        });
        await page.waitForFunction(
            () =>
                Math.abs(window.planeAutomation.getState().plane.rollAngle) > 2
        );
        await page.screenshot({ path: testInfo.outputPath('mobile-roll.png') });
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await expect
            .poll(async () =>
                Math.abs(
                    (
                        await page.evaluate(() =>
                            window.planeAutomation.getState()
                        )
                    ).plane.rollAngle
                )
            )
            .toBeLessThan(0.08);
        expect(
            (await page.evaluate(() => window.planeAutomation.getState())).plane
                .isCrashed
        ).toBe(false);
    });
});
