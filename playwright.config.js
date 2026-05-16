import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/visual',
    snapshotPathTemplate: '{testDir}/baselines/{arg}{ext}',
    fullyParallel: false,
    use: {
        baseURL: 'http://127.0.0.1:5173'
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                viewport: { width: 1280, height: 720 },
                deviceScaleFactor: 1
            }
        }
    ],
    webServer: {
        command: 'npm run dev -- --host 127.0.0.1',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: true,
        timeout: 120000
    }
});
