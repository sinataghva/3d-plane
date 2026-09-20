/* global console, process, window, document */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const output = 'note/traffic-benchmark';
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
const results = [];
try {
    for (const mission of ['saint-cyr', 'luxeuil']) {
        const page = await browser.newPage({
            viewport: { width: 1280, height: 720 },
            deviceScaleFactor: 2
        });
        await page.goto(
            `http://127.0.0.1:5173/3d-plane/?mission=${mission}&automation=1&trafficBenchmark=1`
        );
        await page.waitForFunction(() => window.trafficBenchmark);
        const gpu = await page
            .evaluate(() => {
                const gl = document
                    .querySelector('#canvas-container canvas')
                    .getContext('webgl2');
                const ext = gl.getExtension('WEBGL_debug_renderer_info');
                return ext
                    ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
                    : gl.getParameter(gl.RENDERER);
            })
            .catch(() => 'unavailable');
        console.log(JSON.stringify({ mission, gpu }));
        for (const quality of ['balanced', 'high']) {
            await page
                .locator('#graphics-quality')
                .selectOption(quality, { force: true });
            // Warm terrain caches on the exact flyover before recording cases.
            await page.evaluate(() => window.trafficBenchmark.run(40, 20));
            for (const count of process.env.QUICK
                ? [0, 20, 40, 80]
                : [0, 20, 40, 80, 0, 80, 40, 20, 0]) {
                const samples = await page.evaluate(
                    (count) => window.trafficBenchmark.run(count, 180),
                    count
                );
                const percentile = (key, p) => {
                    const a = samples.map((s) => s[key]).sort((a, b) => a - b);
                    return a[Math.floor((a.length - 1) * p)];
                };
                const row = {
                    mission,
                    quality,
                    count,
                    gpu,
                    medianMs: percentile('frameMs', 0.5),
                    p95Ms: percentile('frameMs', 0.95),
                    trafficMeanMs:
                        samples.reduce((n, s) => n + s.trafficMs, 0) /
                        samples.length,
                    trafficP95Ms: percentile('trafficMs', 0.95),
                    cars: percentile('cars', 0.5),
                    calls: percentile('calls', 0.5),
                    triangles: percentile('triangles', 0.5)
                };
                results.push(row);
                console.log(JSON.stringify(row));
                fs.writeFileSync(
                    output + '/results.json',
                    JSON.stringify(results, null, 2)
                );
                if (count === 40)
                    await page.screenshot({
                        path: `${output}/${mission}-${quality}.png`
                    });
            }
        }
        await page.close();
    }
} finally {
    await browser.close();
}
