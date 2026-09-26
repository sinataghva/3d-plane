// Capture the actual game scene; no external artwork or photography.
import { chromium } from '@playwright/test';
import process from 'node:process';
const browser = await chromium.launch({ headless: true });
try {
    const page = await browser.newPage({
        viewport: { width: 900, height: 510 },
        deviceScaleFactor: 2
    });
    for (const mission of process.argv[2]
        ? [process.argv[2]]
        : ['saint-cyr', 'luxeuil', 'tehran']) {
        await page.goto(
            `${process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:5174'}/3d-plane/?mission=${mission}&visual=card`
        );
        await page.waitForSelector('html[data-visual-ready=true]', {
            timeout: 60000,
            state: 'attached'
        });
        await page.addStyleTag({
            content:
                'body > :not(#canvas-container) { visibility:hidden!important } #canvas-container > :not(canvas) { visibility:hidden!important }'
        });
        await page
            .locator('#canvas-container canvas')
            .screenshot({ path: `public/previews/${mission}.png` });
    }
} finally {
    await browser.close();
}
