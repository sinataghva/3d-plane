// Capture actual game renders, including the development-only formation viewer.
// Requires cwebp (libwebp). No external artwork or geographic downloads.
/* global localStorage, window, document */
import { chromium } from '@playwright/test';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:5173';
const SHOTS = {
    'saint-cyr': [
        { name: 'versailles', visual: 'card', time: 'day' },
        { name: 'cockpit', visual: 'cockpit', time: 'day' },
        { name: 'evening', visual: 'orbit', time: 'sunset' }
    ],
    luxeuil: [
        { name: 'countryside', visual: 'card', time: 'day' },
        { name: 'afterburner', visual: 'afterburner', time: 'day' },
        { name: 'evening', visual: 'card', time: 'sunset' }
    ],
    tehran: [
        { name: 'azadi', visual: 'card', time: 'day' },
        { name: 'mountains', time: 'sunset' },
        { name: 'golden-crown', time: 'day' }
    ]
};
const temporary = await mkdtemp(join(tmpdir(), 'flight-loading-'));
const browser = await chromium.launch();
try {
    for (const mission of process.argv.length > 2
        ? process.argv.slice(2)
        : Object.keys(SHOTS)) {
        if (!SHOTS[mission]) throw new Error(`Unknown flight: ${mission}`);
        const output = `public/previews/${mission}-loading`;
        await mkdir(output, { recursive: true });
        for (const shot of SHOTS[mission]) {
            const page = await browser.newPage({
                viewport: { width: 1600, height: 900 },
                deviceScaleFactor: 1
            });
            await page.addInitScript((time) => {
                localStorage.setItem('plane-time-of-day', time);
                localStorage.setItem('plane-graphics-quality', 'high');
            }, shot.time);
            const query = shot.visual
                ? `visual=${shot.visual}&time=${shot.time}`
                : shot.name === 'mountains'
                  ? 'automation=1'
                  : 'goldenCrown=review';
            await page.goto(`${origin}/3d-plane/?mission=${mission}&${query}`);
            await page.locator('#scenery-loading').waitFor({
                state: 'detached',
                timeout: 60000
            });
            if (shot.name === 'mountains') {
                await page.evaluate(async () => {
                    const { applyVisualScenario } =
                        await import('/3d-plane/src/automation/visualScenarios.js');
                    applyVisualScenario({
                        planeState: window.goldenCrownTest.planeState,
                        cameraMode: { setMode() {} },
                        visualScenario: {
                            name: 'tehran-north',
                            cameraMode: 'chase',
                            plane: {}
                        }
                    });
                });
                await page
                    .getByRole('button', { name: 'Photo mode', exact: true })
                    .click();
            } else if (!shot.visual) {
                await page
                    .getByRole('combobox', { name: 'Display view' })
                    .selectOption('wide');
                await page
                    .getByRole('slider', { name: 'Show timeline' })
                    .fill('48');
                await page.waitForFunction(() =>
                    document
                        .querySelector('#golden-crown-review output')
                        ?.textContent?.startsWith('48.0')
                );
            }
            await page.addStyleTag({
                content:
                    'body > :not(#canvas-container) { visibility: hidden !important; }'
            });
            const png = join(temporary, `${shot.name}.png`);
            await page
                .locator('#canvas-container canvas')
                .screenshot({ path: png });
            execFileSync('cwebp', [
                '-quiet',
                '-q',
                '82',
                png,
                '-o',
                `${output}/${shot.name}.webp`
            ]);
            await page.close();
        }
    }
} finally {
    await browser.close();
    await rm(temporary, { recursive: true, force: true });
}
