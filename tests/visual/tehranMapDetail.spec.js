import { test, expect } from '@playwright/test';
test.setTimeout(120000);
test('Darband northern extension is rendered in flight and both map levels', async ({
    page
}, info) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/3d-plane/?mission=tehran&visual=tehran-north');
    await expect(page.locator('html')).toHaveAttribute(
        'data-visual-ready',
        'true',
        { timeout: 60000 }
    );
    await page.screenshot({ path: info.outputPath('darband-flight.png') });
    await page.getByRole('button', { name: 'Open full map' }).click();
    await page.locator('#map-fit').click();
    await page.screenshot({ path: info.outputPath('expanded-full-map.png') });
    await zoom(page, 8);
    const box = await page.locator('#world-map-canvas').boundingBox();
    // Pan toward the northern edge using the same pointer controls as the player.
    for (let i = 0; i < 5; i++) {
        await page.mouse.move(box.x + box.width / 2, box.y + 70);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height - 70, {
            steps: 8
        });
        await page.mouse.up();
    }
    await page.mouse.move(box.x + box.width - 80, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, {
        steps: 8
    });
    await page.mouse.up();
    await ready(page);
    await page.screenshot({ path: info.outputPath('darband-detail-map.png') });
    expect(errors).toEqual([]);
});
async function open(page) {
    await page.goto('/3d-plane/?mission=tehran&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.getByRole('button', { name: 'Open full map' }).click();
}

test('third-level public labels stay readable across city, parks, foothills and desert', async ({
    page
}, info) => {
    await open(page);
    const canvas = page.locator('#world-map-canvas');
    const map = await page.evaluate(async () => {
        const { bounds, origin } = await (
            await fetch('/3d-plane/data/tehran/map.json')
        ).json();
        return { bounds, origin };
    });
    const [s, w, n, e] = map.bounds;
    const mx = 111320 * Math.cos((map.origin[0] * Math.PI) / 180);
    for (const [name, lat, lon] of [
        ['civic-center', 35.689, 51.412],
        ['public-parks', 35.752, 51.35],
        ['northern-public-places', 35.807, 51.438],
        ['desert', 35.575, 51.585]
    ]) {
        await page.locator('#map-fit').click();
        await zoom(page, 12);
        const box = await canvas.boundingBox();
        const scale =
            Math.min(
                (box.width - 24) / ((e - w) * mx),
                (box.height - 32) / ((n - s) * 111320)
            ) * 12;
        let dx = -((lon - (w + e) / 2) * mx) * scale;
        let dy = -(((s + n) / 2 - lat) * 111320) * scale;
        while (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            const sx = Math.max(-box.width / 3, Math.min(box.width / 3, dx));
            const sy = Math.max(-box.height / 3, Math.min(box.height / 3, dy));
            await page.mouse.move(
                box.x + box.width / 2,
                box.y + box.height / 2
            );
            await page.mouse.down();
            await page.mouse.move(
                box.x + box.width / 2 + sx,
                box.y + box.height / 2 + sy,
                { steps: 3 }
            );
            await page.mouse.up();
            dx -= sx;
            dy -= sy;
        }
        for (const value of [8, 8.01, 10, 12]) {
            await zoom(page, value);
            await ready(page);
            const metrics = JSON.parse(
                await canvas.getAttribute('data-detail-metrics')
            );
            expect(metrics.resolution).toBe(value > 8 ? 8192 : 4096);
            expect(metrics.backingBytes).toBeLessThanOrEqual(
                24 * 516 * 516 * 4
            );
            await page.screenshot({
                path: info.outputPath(`${name}-${value * 100}.png`)
            });
        }
    }
});
async function zoom(page, value) {
    await page.locator('#world-map-canvas').evaluate((canvas, value) => {
        const rect = canvas.getBoundingClientRect();
        const current = Number(canvas.dataset.zoom);
        // Exercise the same pinch handler used by Safari.
        canvas.dispatchEvent(new Event('gesturestart', { cancelable: true }));
        const event = new Event('gesturechange', { cancelable: true });
        Object.assign(event, {
            scale: value / current,
            clientX: rect.x + rect.width / 2,
            clientY: rect.y + rect.height / 2
        });
        canvas.dispatchEvent(event);
    }, value);
    await expect
        .poll(async () =>
            Number(
                await page
                    .locator('#world-map-canvas')
                    .getAttribute('data-zoom')
            )
        )
        .toBeCloseTo(value);
}
async function ready(page) {
    await expect
        .poll(
            async () =>
                JSON.parse(
                    (await page
                        .locator('#world-map-canvas')
                        .getAttribute('data-detail-metrics')) || '{}'
                ).pending,
            { timeout: 60000 }
        )
        .toBe(0);
}
test('Tehran detail transition, POIs, panning, cap and cache lifecycle', async ({
    page
}, info) => {
    const errors = [],
        external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => {
        if (
            /^https?:/.test(r.url()) &&
            !r.url().startsWith('http://127.0.0.1:5173/')
        )
            external.push(r.url());
    });
    await open(page);
    await zoom(page, 4);
    await expect(page.locator('#world-map-canvas')).toHaveAttribute(
        'data-detail-level',
        '0'
    );
    await page.screenshot({ path: info.outputPath('tehran-400.png') });
    for (const value of [4.2, 6, 8, 8.01, 10, 12]) {
        await zoom(page, value);
        await ready(page);
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'data-detail-level',
            value > 8 ? '2' : '1'
        );
        await page.screenshot({
            path: info.outputPath(`tehran-${value * 100}.png`)
        });
    }
    await expect(page.locator('#map-zoom-in')).toBeDisabled();
    const canvas = page.locator('#world-map-canvas'),
        box = await canvas.boundingBox();
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    const destination = await canvas.getAttribute('data-destination');
    for (const dx of [500, -1000, 500]) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
            box.x + box.width / 2 + dx,
            box.y + box.height / 2 + 80,
            { steps: 8 }
        );
        await page.mouse.up();
    }
    await ready(page);
    expect(await canvas.getAttribute('data-destination')).toBe(destination);
    const metrics = JSON.parse(
        await canvas.getAttribute('data-detail-metrics')
    );
    expect(metrics.tiles).toBeLessThanOrEqual(24);
    await info.attach('detail-metrics', {
        body: JSON.stringify(metrics),
        contentType: 'application/json'
    });
    await page.screenshot({ path: info.outputPath('tehran-panned.png') });
    await page.locator('#close-world-map').click();
    await page.getByRole('button', { name: 'Open full map' }).click();
    await ready(page);
    await expect(canvas).toHaveAttribute('data-zoom', '12');
    for (let i = 0; i < 2; i++) {
        await zoom(page, 4);
        await zoom(page, 4.2);
        await ready(page);
        await zoom(page, 8);
        await zoom(page, 8.01);
        await zoom(page, 12);
        await ready(page);
        expect(
            JSON.parse(await canvas.getAttribute('data-detail-metrics'))
                .resolution
        ).toBe(8192);
    }
    await page.locator('#map-fit').click();
    await expect(canvas).toHaveAttribute('data-zoom', '1');
    await expect(canvas).toHaveAttribute('data-detail-level', '0');
    expect(
        JSON.parse(await canvas.getAttribute('data-detail-metrics')).tiles
    ).toBe(0);
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
});
test.describe('phone detail', () => {
    test.use({
        hasTouch: true,
        isMobile: true,
        viewport: { width: 844, height: 390 },
        deviceScaleFactor: 2
    });
    test('touch pinch crosses both boundaries, remains readable at 1200%, and fit resets', async ({
        page
    }, info) => {
        await open(page);
        await zoom(page, 4.2);
        await ready(page);
        expect(
            JSON.parse(
                await page
                    .locator('#world-map-canvas')
                    .getAttribute('data-detail-metrics')
            ).tiles
        ).toBeLessThanOrEqual(24);
        await zoom(page, 4);
        const box = await page.locator('#world-map-canvas').boundingBox();
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
                { x: x - 65, y, id: 1 },
                { x: x + 65, y, id: 2 }
            ]
        });
        await touch.send('Input.dispatchTouchEvent', {
            type: 'touchEnd',
            touchPoints: []
        });
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'data-detail-level',
            '2'
        );
        await zoom(page, 12);
        await ready(page);
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'data-destination',
            ''
        );
        await page.screenshot({
            path: info.outputPath('tehran-mobile-1200.png')
        });
        await page.locator('#map-fit').tap();
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'data-zoom',
            '1'
        );
    });
});

for (const mission of ['saint-cyr', 'luxeuil']) {
    test(`${mission} retains its 400% cap and overview`, async ({ page }) => {
        await page.goto(`/3d-plane/?mission=${mission}&automation=1`);
        await page.waitForFunction(() => Boolean(window.planeAutomation));
        await page.locator('#mini-map').click();
        await zoom(page, 4);
        await expect(page.locator('#map-zoom-in')).toBeDisabled();
        await expect(page.locator('#world-map-canvas')).toHaveAttribute(
            'data-detail-level',
            '0'
        );
    });
}
