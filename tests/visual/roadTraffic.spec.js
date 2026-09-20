import { test, expect } from '@playwright/test';
for (const mission of ['saint-cyr', 'luxeuil']) {
    test(`${mission} road traffic aligns with roads`, async ({
        page
    }, info) => {
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.goto(`/?mission=${mission}&visual=traffic-detail`);
        await page.waitForFunction(
            () => document.documentElement.dataset.visualReady === 'true'
        );
        const stats = await page.evaluate(() =>
            JSON.parse(document.documentElement.dataset.sceneryStats)
        );
        expect(stats.trafficCars).toBeGreaterThan(0);
        expect(stats.trafficCars).toBeLessThanOrEqual(
            mission === 'luxeuil' ? 20 : 40
        );
        await page.screenshot({ path: info.outputPath('traffic.png') });
        expect(errors).toEqual([]);
    });
}

for (const mission of ['saint-cyr', 'luxeuil']) {
    test(`${mission} flyover retains nearby cars and introduces distant cars`, async ({
        page
    }, info) => {
        test.setTimeout(120000);
        await page.goto(`/?mission=${mission}&automation=1&trafficBenchmark=1`);
        await page.waitForFunction(() => window.trafficBenchmark);
        const samples = await page.evaluate(() =>
            window.trafficBenchmark.run(40, 180, 8)
        );
        let introduced = 0,
            moved = 0;
        for (let i = 1; i < samples.length; i++) {
            const previous = samples[i - 1].population,
                current = samples[i].population,
                camera = samples[i].camera;
            for (const car of previous) {
                const next = current.find((p) => p.id === car.id);
                if (Math.hypot(car.x - camera.x, car.z - camera.z) < 1500)
                    expect(next).toBeTruthy();
                if (next) {
                    const distance = Math.hypot(next.x - car.x, next.z - car.z);
                    expect(distance).toBeLessThan(1.21);
                    if (distance > 0.001) moved++;
                }
            }
            for (const car of current.filter(
                (p) => !previous.some((q) => q.id === p.id)
            )) {
                expect(
                    Math.hypot(car.x - camera.x, car.z - camera.z)
                ).toBeGreaterThan(1500);
                introduced++;
            }
        }
        expect(moved).toBeGreaterThan(100);
        expect(introduced).toBeGreaterThan(0);
        await page.screenshot({ path: info.outputPath('flyover.png') });
    });
}
