/* global console, process, window, performance, requestAnimationFrame, document */
// Run against the local dev server. Headless timings are comparative, not hardware FPS.
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const name = (process.argv[2] || 'current').replace(/[^a-zA-Z0-9_-]/g, '');
const output = 'test-results/ground-benchmark';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const mission of ['saint-cyr', 'luxeuil']) {
    const page = await browser.newPage({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1
    });
    await page.goto(
        `http://127.0.0.1:5173/3d-plane/?mission=${mission}&automation=1`
    );
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    for (const quality of ['low', 'balanced', 'high']) {
        await page.locator('#settings-button').click();
        await page.locator('#graphics-quality').selectOption(quality);
        await page.waitForTimeout(1800);
        const samples = await page.evaluate(
            () =>
                new Promise((resolve) => {
                    const values = [];
                    let previous = performance.now();
                    function frame(now) {
                        values.push(now - previous);
                        previous = now;
                        if (values.length < 90) requestAnimationFrame(frame);
                        else resolve(values.slice(5));
                    }
                    requestAnimationFrame(frame);
                })
        );
        const sorted = samples.sort((a, b) => a - b);
        results.push({
            mission,
            quality,
            medianMs: sorted[Math.floor(sorted.length / 2)],
            p95Ms: sorted[Math.floor(sorted.length * 0.95)],
            stats: await page.evaluate(() =>
                JSON.parse(
                    document.documentElement.dataset.sceneryStats || '{}'
                )
            )
        });
        await page.locator('#close-settings').click();
        if (quality === 'high')
            await page.screenshot({
                path: `${output}/ground-${name}-${mission}.png`
            });
    }
    await page.close();
}
fs.writeFileSync(
    `${output}/ground-${name}.json`,
    JSON.stringify(results, null, 2)
);
console.log(JSON.stringify(results));
await browser.close();
