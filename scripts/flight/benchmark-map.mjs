/* global window, document, performance, requestAnimationFrame, Event */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import console from 'node:console';
import process from 'node:process';
const browser = await chromium.launch({
    args: process.platform === 'darwin' ? ['--use-angle=metal'] : []
});
fs.mkdirSync('note/map-detail', { recursive: true });
const results = [];
try {
    for (const mobile of [false, true]) {
        const page = await browser.newPage({
            viewport: mobile
                ? { width: 844, height: 390 }
                : { width: 1280, height: 720 },
            deviceScaleFactor: mobile ? 2 : 1,
            isMobile: mobile,
            hasTouch: mobile
        });
        await page.goto(
            'http://127.0.0.1:5173/3d-plane/?mission=tehran&automation=1'
        );
        await page.waitForFunction(() => window.planeAutomation);
        const gpu = await page.evaluate(() => {
            const gl = document
                .querySelector('#canvas-container canvas')
                .getContext('webgl2');
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            return ext
                ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                : gl.getParameter(gl.RENDERER);
        });
        await page.locator('#mini-map').click();
        for (const zoom of [4, 4.2, 8, 8.01, 10, 12]) {
            const started = await page
                .locator('#world-map-canvas')
                .evaluate((canvas, zoom) => {
                    canvas.dispatchEvent(
                        new Event('gesturestart', { cancelable: true })
                    );
                    const rect = canvas.getBoundingClientRect(),
                        event = new Event('gesturechange', {
                            cancelable: true
                        });
                    Object.assign(event, {
                        scale: zoom / Number(canvas.dataset.zoom),
                        clientX: rect.x + rect.width / 2,
                        clientY: rect.y + rect.height / 2
                    });
                    const start = performance.now();
                    canvas.dispatchEvent(event);
                    return start;
                }, zoom);
            await page.waitForFunction(
                () => {
                    const c = document.querySelector('#world-map-canvas');
                    if (Number(c.dataset.zoom) <= 4) return true;
                    const metrics = JSON.parse(c.dataset.detailMetrics || '{}');
                    return metrics.ready && metrics.pending === 0;
                },
                null,
                { timeout: 60000 }
            );
            const readyMs = await page.evaluate(
                (start) => performance.now() - start,
                started
            );
            const sample = await page.evaluate(
                () =>
                    new Promise((resolve) => {
                        const frames = [];
                        let previous = performance.now();
                        function tick(now) {
                            frames.push(now - previous);
                            previous = now;
                            if (frames.length < 120)
                                requestAnimationFrame(tick);
                            else {
                                frames.sort((a, b) => a - b);
                                resolve({
                                    medianMs: frames[60],
                                    p95Ms: frames[114],
                                    heapBytes:
                                        performance.memory?.usedJSHeapSize,
                                    detail: JSON.parse(
                                        document.querySelector(
                                            '#world-map-canvas'
                                        ).dataset.detailMetrics || '{}'
                                    ),
                                    scenery: JSON.parse(
                                        document.documentElement.dataset
                                            .sceneryStats || '{}'
                                    )
                                });
                            }
                        }
                        requestAnimationFrame(tick);
                    })
            );
            const result = { mobile, gpu, zoom, readyMs, ...sample };
            results.push(result);
            console.log(JSON.stringify(result));
            await page.screenshot({
                path: `note/map-detail/${mobile ? 'phone' : 'desktop'}-${zoom * 100}.png`
            });
        }
        if (!mobile) {
            const c = page.locator('#world-map-canvas'),
                box = await c.boundingBox();
            for (const [name, dx, dy] of [
                ['north', -150, 450],
                ['southeast', -600, -900],
                ['desert', -1900, -800]
            ]) {
                await page.mouse.move(
                    box.x + box.width / 2,
                    box.y + box.height / 2
                );
                await page.mouse.down();
                await page.mouse.move(
                    box.x + box.width / 2 + dx,
                    box.y + box.height / 2 + dy,
                    { steps: 12 }
                );
                await page.mouse.up();
                await page.waitForFunction(
                    () =>
                        JSON.parse(
                            document.querySelector('#world-map-canvas').dataset
                                .detailMetrics
                        ).pending === 0
                );
                await page.screenshot({
                    path: `note/map-detail/${name}-1200.png`
                });
            }
        }
        await page.close();
    }
    fs.writeFileSync(
        'note/map-detail/measurements.json',
        JSON.stringify(results, null, 2) + '\n'
    );
} finally {
    await browser.close();
}
