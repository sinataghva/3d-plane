import { expect, test } from '@playwright/test';
import { MISSIONS } from '../../src/ui/missions.js';

/** Hold the scenery download so the loading UI can be inspected reliably. */
async function holdScenery(page, region = 'tehran') {
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    await page.route(`**/data/${region}/map.json`, async (route) => {
        await gate;
        await route.continue();
    });
    return release;
}

for (const mission of Object.values(MISSIONS)) {
    const region = mission.id;
    const destination = mission.title.split(' · ')[0];

    test(`${destination} rotates photographs, pauses, reports real stages and exits on the first frame`, async ({
        page
    }, info) => {
        test.setTimeout(60000);
        const photographs = [];
        page.on('request', (request) => {
            if (/previews\/.+-loading\//.test(request.url()))
                photographs.push(request.url());
        });
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.addInitScript(() => {
            Math.random = () => 0;
            window.loadingStages = [];
            new MutationObserver(() => {
                const text = document.querySelector(
                    '#scenery-loading [role="status"]'
                )?.textContent;
                if (text && window.loadingStages.at(-1) !== text)
                    window.loadingStages.push(text);
            }).observe(document, { childList: true, subtree: true });
        });
        const release = await holdScenery(page, region);
        try {
            await page.goto(`/3d-plane/?mission=${region}`);
            const loading = page.locator('#scenery-loading');
            await expect(loading.getByRole('status')).toHaveText(
                `Loading ${destination} scenery…`
            );
            await expect
                .poll(() =>
                    page
                        .locator('.flight-loading-slide img')
                        .evaluateAll(
                            (images) =>
                                images.filter(
                                    (img) =>
                                        img.complete && img.naturalWidth > 0
                                ).length
                        )
                )
                .toBe(3);
            await expect(
                loading.getByRole('button', { name: 'Pause slideshow' })
            ).toBeVisible();
            await loading
                .getByRole('button', { name: 'Pause slideshow' })
                .click();
            await page.evaluate(() => {
                window.loaderAnimations = [
                    ...document.querySelectorAll('.flight-loading-slide')
                ].flatMap((slide) => slide.getAnimations());
                for (const animation of window.loaderAnimations)
                    animation.currentTime = 500;
            });
            await expect(
                page.locator('.flight-loading-slide').nth(0)
            ).toHaveCSS('opacity', '1');
            expect(
                await page.evaluate(() =>
                    window.loaderAnimations.every(
                        (a) => a.playState === 'paused'
                    )
                )
            ).toBe(true);
            await page.screenshot({
                path: info.outputPath(`${region}-loading-first-desktop.png`)
            });
            // A real three-second interval must advance the photographs.
            await loading
                .getByRole('button', { name: 'Play slideshow' })
                .click();
            await expect(
                page.locator('.flight-loading-slide').nth(1)
            ).toHaveCSS('opacity', '1', { timeout: 4500 });
            await loading
                .getByRole('button', { name: 'Pause slideshow' })
                .click();
            await page.screenshot({
                path: info.outputPath(`${region}-loading-second-desktop.png`)
            });
            expect(photographs.length).toBe(3);
            expect(
                photographs.every((url) =>
                    url.includes(`/previews/${region}-loading/`)
                )
            ).toBe(true);
            release();
            await expect(loading).toHaveCount(0, { timeout: 45000 });
            expect(await page.evaluate(() => window.loadingStages)).toEqual([
                `Loading ${destination} scenery…`,
                'Preparing terrain and aircraft…',
                'Preparing your flight…'
            ]);
            expect(
                await page.evaluate(() =>
                    window.loaderAnimations.every((a) => a.playState === 'idle')
                )
            ).toBe(true);
            await expect(page.locator('#canvas-container canvas')).toHaveCount(
                1
            );
            expect(errors).toEqual([]);
        } finally {
            release();
        }
    });

    test(`${destination} mobile loading respects reduced motion and fits landscape and portrait`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: { width: 844, height: 390 },
            isMobile: true,
            hasTouch: true,
            reducedMotion: 'reduce'
        });
        const page = await context.newPage();
        await page.addInitScript(() => {
            Math.random = () => 0;
        });
        const release = await holdScenery(page, region);
        try {
            await page.goto(`/3d-plane/?mission=${region}`);
            await expect(
                page.locator('.flight-loading-slide.is-first')
            ).toBeVisible();
            await expect(page.locator('.flight-loading-pause')).toBeHidden();
            expect(
                await page
                    .locator('#scenery-loading')
                    .evaluate(
                        (el) => el.getAnimations({ subtree: true }).length
                    )
            ).toBe(0);
            for (const [name, viewport] of [
                ['landscape', { width: 844, height: 390 }],
                ['portrait', { width: 390, height: 844 }]
            ]) {
                await page.setViewportSize(viewport);
                for (const selector of [
                    '.flight-loading-heading',
                    '.flight-loading-slide.is-first figcaption',
                    '.flight-loading-footer'
                ]) {
                    const box = await page.locator(selector).boundingBox();
                    expect(box.x).toBeGreaterThanOrEqual(0);
                    expect(box.y).toBeGreaterThanOrEqual(0);
                    expect(box.x + box.width).toBeLessThanOrEqual(
                        viewport.width
                    );
                    expect(box.y + box.height).toBeLessThanOrEqual(
                        viewport.height
                    );
                }
                await page.screenshot({
                    path: info.outputPath(
                        `${region}-loading-mobile-${name}.png`
                    )
                });
            }
        } finally {
            release();
            await context.close();
        }
    });

    test(`${destination} touch loading can pause and resume the slideshow`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: { width: 844, height: 390 },
            isMobile: true,
            hasTouch: true
        });
        const page = await context.newPage();
        const release = await holdScenery(page, region);
        try {
            await page.goto(`/3d-plane/?mission=${region}`);
            await page.getByRole('button', { name: 'Pause slideshow' }).tap();
            await expect(
                page.getByRole('button', { name: 'Play slideshow' })
            ).toBeVisible();
            await page.getByRole('button', { name: 'Play slideshow' }).tap();
            await expect(
                page.getByRole('button', { name: 'Pause slideshow' })
            ).toBeVisible();
            await page.screenshot({
                path: info.outputPath(`${region}-loading-touch.png`)
            });
        } finally {
            release();
            await context.close();
        }
    });
}

test('failed photography cannot block a flight', async ({ page }) => {
    test.setTimeout(60000);
    await page.route('**/previews/tehran-loading/*.webp', (route) =>
        route.abort()
    );
    const release = await holdScenery(page);
    try {
        await page.goto('/3d-plane/?mission=tehran');
        await expect(
            page.getByRole('heading', {
                name: 'Tehran · Mehrabad',
                exact: true
            })
        ).toBeVisible();
        await expect(
            page.locator('#scenery-loading').getByRole('status')
        ).toHaveText('Loading Tehran scenery…');
        release();
        await expect(page.locator('#scenery-loading')).toHaveCount(0, {
            timeout: 45000
        });
        await expect(page.locator('#runtime-fallback')).toBeHidden();
    } finally {
        release();
    }
});

test('scenery failures reveal the runtime fallback instead of leaving the gallery open', async ({
    page
}) => {
    await page.route('**/data/tehran/map.json', (route) =>
        route.fulfill({ status: 503, body: 'Unavailable' })
    );
    await page.goto('/3d-plane/?mission=tehran');
    await expect(page.locator('#runtime-fallback')).toBeVisible();
    await expect(page.locator('#scenery-loading')).toHaveCount(0);
});
