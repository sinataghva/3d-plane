import { test, expect } from '@playwright/test';

test('Golden Crown possession, maneuvers and persistent return', async ({
    page
}, info) => {
    test.setTimeout(180000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/3d-plane/?mission=tehran');
    const fly = page.getByRole('button', {
        name: 'Fly Golden Crown',
        exact: true
    });
    await expect(fly).toBeVisible({ timeout: 120000 });
    await page.waitForFunction(() => window.goldenCrownTest);
    const serials = await page.evaluate(() =>
        window.goldenCrownTest.display.jets.map(({ jet }) => {
            const labels = [];
            jet.traverse((object) => {
                if (object.userData.displaySerial)
                    labels.push(object.material.userData.serial);
            });
            return labels.sort();
        })
    );
    expect(serials).toEqual([
        ['3-7099', '۳-۷۰۹۹'],
        ['3-7015', '۳-۷۰۱۵'],
        ['3-7046', '۳-۷۰۴۶'],
        ['3-7078', '۳-۷۰۷۸'],
        ['3-7079', '۳-۷۰۷۹'],
        ['3-7136', '۳-۷۱۳۶']
    ]);

    await page.evaluate(() => window.goldenCrownTest.display.seek(18));
    const before = await page.evaluate(() => window.goldenCrownTest.snapshot());
    const handoff = await page.evaluate(() => {
        const before = window.goldenCrownTest.snapshot();
        document.getElementById('golden-crown-fly').click();
        return { before, after: window.goldenCrownTest.snapshot() };
    });
    await expect(page.locator('#golden-crown-toast')).toBeVisible();
    await page.screenshot({ path: info.outputPath('formation-toast.png') });
    const panel = page.getByRole('region', { name: 'Golden Crown flight' });
    await expect(panel).toHaveCount(0);
    await expect(
        page.getByRole('slider', { name: 'Show timeline' })
    ).toHaveCount(0);
    await expect(page.locator('#golden-crown-review')).toHaveCount(0);
    await expect
        .poll(() => page.evaluate(() => window.goldenCrownTest.snapshot().mode))
        .toBe('player');
    expect(handoff.after.jets).toEqual(handoff.before.jets);
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => window.goldenCrownTest.display.pilot.status
                ),
            { timeout: 20000 }
        )
        .toBe('Release solos');
    const returnBounds = await page
        .locator('#golden-crown-return')
        .boundingBox();
    const settingsBounds = await page.locator('#photo-button').boundingBox();
    expect(returnBounds.y).toBe(settingsBounds.y);
    expect(settingsBounds.x - returnBounds.x - returnBounds.width).toBe(8);
    await expect(page.locator('#golden-crown-toast')).toBeHidden({
        timeout: 8000
    });
    await page.screenshot({ path: info.outputPath('leader-formation.png') });
    for (const view of ['Cockpit', 'Orbit', 'Chase']) {
        await page.keyboard.press('c');
        await expect(page.locator('#flight-feedback')).toHaveText(
            'Camera: ' + view
        );
        await expect(page.locator('#flight-feedback')).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath('camera-toast.png') });
    await expect(page.locator('#flight-feedback')).toBeHidden({
        timeout: 6000
    });
    await page.getByRole('button', { name: 'Photo mode', exact: true }).click();
    await expect(page.locator('body')).toHaveClass(/photo-mode/);
    const photoState = await page.evaluate(() =>
        window.goldenCrownTest.snapshot()
    );
    await page.screenshot({ path: info.outputPath('golden-crown-photo.png') });
    expect(
        (await page.evaluate(() => window.goldenCrownTest.snapshot())).jets
    ).toEqual(photoState.jets);
    await page
        .getByRole('button', { name: 'Return to flying', exact: true })
        .click();
    const originalSpeed = await page.evaluate(() => {
        const pilot = window.goldenCrownTest.display.pilot;
        const speed = pilot.diagnostics.speedTarget;
        pilot.setThrottle(0);
        return speed;
    });
    await expect(page.locator('#golden-crown-toast')).toBeHidden({
        timeout: 10000
    });
    await page.keyboard.press('Space');
    await expect(page.locator('#golden-crown-toast')).toHaveText(
        /Adjust speed to 288–612 km\/h/
    );
    await expect(page.locator('#golden-crown-toast')).toBeVisible();
    expect(
        (await page.evaluate(() => window.goldenCrownTest.snapshot())).soloOut
    ).toBe(false);
    await expect(page.locator('#golden-crown-toast')).toBeHidden({
        timeout: 8000
    });
    await page.keyboard.press('Space');
    await expect(page.locator('#golden-crown-toast')).toBeVisible();
    await page.screenshot({
        path: info.outputPath('blocked-maneuver-toast.png')
    });
    await page.evaluate(
        (speed) =>
            window.goldenCrownTest.display.pilot.setThrottle(
                (speed - 55) / 185
            ),
        originalSpeed
    );
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => window.goldenCrownTest.display.pilot.status
                ),
            { timeout: 20000 }
        )
        .toBe('Release solos');
    await expect(page.locator('#mini-map')).toBeVisible();
    const radarBounds = await page.locator('#mini-map').boundingBox();
    const flightBounds = await page.locator('#flight-data').boundingBox();
    expect(radarBounds.x).toBeGreaterThan(flightBounds.x + flightBounds.width);
    await page.keyboard.down('m');
    await expect(page.locator('#world-map')).toBeVisible();
    await expect(page.locator('#world-map-position')).toContainText(
        'Golden Crown'
    );
    await page.screenshot({ path: info.outputPath('golden-crown-map.png') });
    await page.keyboard.up('m');
    await page.keyboard.press('Space');
    await expect
        .poll(() =>
            page.evaluate(() => window.goldenCrownTest.snapshot().soloOut)
        )
        .toBe(true);
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => window.goldenCrownTest.display.pilot.status
                ),
            { timeout: 15000 }
        )
        .toBe('Opposed rolls');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect
        .poll(() =>
            page.evaluate(() => window.goldenCrownTest.snapshot().rolls)
        )
        .toBe(2);
    await page.waitForFunction(
        () => window.goldenCrownTest.snapshot().rollElapsed >= 0.6
    );
    await page.screenshot({ path: info.outputPath('solos-and-rolls.png') });
    await expect
        .poll(
            () =>
                page.evaluate(
                    () => window.goldenCrownTest.snapshot().completedRolls
                ),
            { timeout: 20000 }
        )
        .toBe(2);
    await expect
        .poll(() =>
            page.evaluate(() => window.goldenCrownTest.display.pilot.status)
        )
        .toBe('Opposed rolls');
    // Holding Space must not synthesize repeats.
    await page.keyboard.down('Space');
    await page.keyboard.down('Space');
    await expect
        .poll(() =>
            page.evaluate(() => window.goldenCrownTest.snapshot().rolls)
        )
        .toBe(1);
    await page.keyboard.up('Space');
    await page
        .getByRole('button', { name: 'Return to F-4', exact: true })
        .click();
    await expect(fly).toBeVisible();
    await page.keyboard.down('m');
    await expect(page.locator('#world-map-position')).toContainText(
        'Golden Crown'
    );
    await page.screenshot({ path: info.outputPath('f4-formation-map.png') });
    await page.keyboard.up('m');
    expect(
        (await page.evaluate(() => window.goldenCrownTest.snapshot())).mode
    ).toBe('return');
    // Step the return deterministically rather than waiting several real minutes.
    const recovery = await page.evaluate(() => {
        const { display } = window.goldenCrownTest;
        const pilot = display.pilot;
        const keys = {
            w: false,
            s: false,
            a: false,
            d: false,
            arrowLeft: false,
            arrowRight: false,
            arrowUp: false,
            arrowDown: false,
            space: false,
            stickPitch: 0,
            stickRoll: 0
        };
        for (let n = 0; n < 240 * 60 && pilot.mode !== 'script'; n++)
            pilot.update(1 / 60, keys);
        return pilot.diagnostics;
    });
    expect(recovery.mode).toBe('script');
    // No parked F-4 drift during possession.
    const parked = await page.evaluate(
        () => window.goldenCrownTest.snapshot().f4
    );
    expect(
        Math.hypot(parked.x - before.f4.x, parked.z - before.f4.z)
    ).toBeLessThan(1);
    const airborne = await page.evaluate(() => {
        const api = window.goldenCrownTest;
        const p = api.display.target();
        Object.assign(api.planeState, {
            position: { x: p.x, y: p.y + 500, z: p.z },
            isAirborne: true,
            isCrashed: false,
            speed: 2,
            verticalSpeed: 0,
            yawAngle: 0,
            pitchAngle: 0,
            rollAngle: 0,
            attitude: { x: 0, y: 0, z: 0, w: 1 }
        });
        document.getElementById('golden-crown-fly').click();
        return api.snapshot().f4;
    });
    await expect
        .poll(
            () => page.evaluate(() => window.goldenCrownTest.snapshot().f4.x),
            { timeout: 10000 }
        )
        .toBeGreaterThan(airborne.x + 120);
    const moving = await page.evaluate(
        () => window.goldenCrownTest.snapshot().f4
    );
    expect(moving.y).toBeCloseTo(airborne.y, 3);
    expect(moving.z).toBeCloseTo(airborne.z, 3);
    await page
        .getByRole('button', { name: 'Return to F-4', exact: true })
        .click();
    expect(
        (await page.evaluate(() => window.goldenCrownTest.snapshot().f4)).x
    ).toBeGreaterThan(airborne.x + 120);
    expect(errors).toEqual([]);
});

test.describe('touch flight', () => {
    test.use({ hasTouch: true, isMobile: true });
    test('mobile Golden Crown flight has touch maneuvers and no player timeline', async ({
        page
    }, info) => {
        test.setTimeout(180000);
        await page.setViewportSize({ width: 844, height: 390 });
        await page.goto('/3d-plane/?mission=tehran');
        await page
            .getByRole('button', { name: 'Fly Golden Crown', exact: true })
            .click({ timeout: 120000 });
        const panel = page.locator('#golden-crown-flight');
        await expect(panel).toBeHidden();
        await expect(
            page.getByRole('button', { name: 'Return to F-4' })
        ).toBeVisible();
        await expect(
            page.getByRole('slider', { name: 'Show timeline' })
        ).toHaveCount(0);
        const bounds = await page.locator('#golden-crown-return').boundingBox();
        const settings = await page.locator('#camera-shortcut').boundingBox();
        expect(bounds.y).toBe(settings.y);
        expect(settings.x - bounds.x - bounds.width).toBe(8);
        const speed = page.getByRole('slider', { name: 'Formation speed' });
        const f4Thrust = await page.evaluate(
            () => window.goldenCrownTest.planeState.thrust
        );
        await speed.fill('40');
        expect(
            await page.evaluate(
                () => window.goldenCrownTest.snapshot().speedTarget
            )
        ).toBeCloseTo(129);
        expect(
            await page.evaluate(() => window.goldenCrownTest.planeState.thrust)
        ).toBe(f4Thrust);
        await expect(page.locator('#mini-map')).toBeVisible();
        for (const view of ['Cockpit', 'Orbit', 'Chase']) {
            await page
                .getByRole('button', { name: 'Switch camera view' })
                .tap();
            await expect(page.locator('#flight-feedback')).toHaveText(
                'Camera: ' + view
            );
            await expect(page.locator('#flight-feedback')).toBeVisible();
        }
        await page.screenshot({
            path: info.outputPath('mobile-camera-toast.png')
        });
        await expect(page.locator('#bomb-readout')).toBeHidden();
        await expect(
            page.getByRole('button', {
                name: 'Formation maneuver',
                exact: true
            })
        ).toContainText('Release solos', { timeout: 20000 });
        await page
            .getByRole('button', { name: 'Formation maneuver', exact: true })
            .tap();
        await expect
            .poll(() =>
                page.evaluate(() => window.goldenCrownTest.snapshot().soloOut)
            )
            .toBe(true);
        await page.screenshot({ path: info.outputPath('mobile-leader.png') });
    });
});
