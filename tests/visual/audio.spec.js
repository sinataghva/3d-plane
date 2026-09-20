import { test, expect } from '@playwright/test';
test.setTimeout(90000);

for (const mobile of [false, true]) {
    test(`audio playback and settings ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: mobile
                ? { width: 852, height: 393 }
                : { width: 1280, height: 720 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript(() => {
            window.audioProbes = [];
            const connect = AudioNode.prototype.connect;
            AudioNode.prototype.connect = function (...args) {
                if (args[0] instanceof AudioDestinationNode) {
                    const analyser = this.context.createAnalyser();
                    analyser.fftSize = 2048;
                    connect.call(this, analyser);
                    window.audioProbes.push({
                        analyser,
                        context: this.context
                    });
                }
                return connect.apply(this, args);
            };
        });
        await page.goto('/3d-plane/?mission=luxeuil');
        await expect(page.locator('#settings-button')).toBeVisible();
        // A trusted gesture unlocks the real audio context.
        await page.locator('#settings-button').click();
        await expect(page.locator('#audio-volume')).toHaveValue('55');
        await page.locator('#audio-volume').scrollIntoViewIfNeeded();
        await page.screenshot({ path: info.outputPath('audio-settings.png') });
        await page.locator('#close-settings').click();
        const rms = () =>
            page.evaluate(() => {
                const probe = window.audioProbes[0];
                if (!probe) return 0;
                const samples = new Float32Array(2048);
                probe.analyser.getFloatTimeDomainData(samples);
                return Math.sqrt(
                    samples.reduce((s, n) => s + n * n, 0) / samples.length
                );
            });
        await expect.poll(rms).toBeGreaterThan(0.001);
        await page.locator('#settings-button').click();
        await expect.poll(rms).toBeLessThan(0.0001);
        await page.locator('#audio-muted').check();
        await page.locator('#audio-volume').fill('30');
        await page.locator('#close-settings').click();
        await expect.poll(rms).toBeLessThan(0.0001);
        await page.reload();
        await page.locator('#settings-button').click();
        await expect(page.locator('#audio-muted')).toBeChecked();
        await expect(page.locator('#audio-volume')).toHaveValue('30');
        // Decode every bundled file, including the other mission's engine.
        const samples = await page.evaluate(async () => {
            const ctx = new OfflineAudioContext(1, 1, 44100);
            return Promise.all(
                ['propeller.wav', 'jet.wav', 'gunfire.wav'].map(
                    async (name) => {
                        const response = await fetch(`/3d-plane/audio/${name}`);
                        const buffer = await ctx.decodeAudioData(
                            await response.arrayBuffer()
                        );
                        return {
                            name,
                            duration: buffer.duration,
                            peak: buffer
                                .getChannelData(0)
                                .reduce((m, v) => Math.max(m, Math.abs(v)), 0)
                        };
                    }
                )
            );
        });
        for (const sample of samples) {
            expect(sample.duration).toBeGreaterThan(0.1);
            expect(sample.peak).toBeGreaterThan(0.1);
        }
        expect(errors).toEqual([]);
        await context.close();
    });
}

test('effect voices follow flight events and dispose cleanly', async ({
    page
}) => {
    await page.route('**/audio-harness', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<button>Start audio</button>'
        })
    );
    await page.goto('/audio-harness');
    await page.evaluate(async () => {
        window.sources = [];
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const source = original.call(this);
            window.sources.push(source);
            return source;
        };
        const { createFlightAudio } = await import('/3d-plane/src/audio/audio.js');
        const { createPlaneState } = await import('/3d-plane/src/flight/physics.js');
        window.sound = createFlightAudio();
        window.state = createPlaneState();
        window.state.aircraft = 'mirage';
    });
    await page.getByRole('button').click();
    await expect
        .poll(() =>
            page.evaluate(() => window.sources.filter((s) => s.loop).length)
        )
        .toBe(6);
    const result = await page.evaluate(async () => {
        const sound = window.sound;
        const state = window.state;
        sound.update(state, { space: false }, false, false);
        const count = () => window.sources.filter((s) => !s.loop).length;
        sound.touchdown(2);
        const touchdown = count();
        sound.update(state, { space: true }, false, false);
        const cannon = count();
        sound.update(state, { space: true }, true, false);
        sound.touchdown(2);
        const paused = count();
        sound.update(state, { space: false }, false, false);
        sound.update(
            { ...state, isCrashed: true },
            { space: true },
            false,
            false
        );
        const crashed = count();
        sound.dispose();
        await new Promise((r) => setTimeout(r, 100));
        return {
            touchdown,
            cannon,
            paused,
            crashed,
            context: window.sources[0].context.state
        };
    });
    expect(result).toEqual({
        touchdown: 1,
        cannon: 2,
        paused: 2,
        crashed: 2,
        context: 'closed'
    });
});

test('foreground effects remain audible at full engine power without clipping', async ({
    page
}) => {
    await page.route('**/audio-harness', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<button>Start</button>'
        })
    );
    await page.goto('/audio-harness');
    await page.evaluate(async () => {
        localStorage.setItem(
            'flight-audio',
            JSON.stringify({ volume: 1, muted: false })
        );
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (...args) {
            if (args[0] instanceof AudioDestinationNode) {
                window.meter = this.context.createAnalyser();
                connect.call(this, window.meter);
            }
            return connect.apply(this, args);
        };
        const { createFlightAudio } = await import('/3d-plane/src/audio/audio.js');
        const { createPlaneState } = await import('/3d-plane/src/flight/physics.js');
        window.sound = createFlightAudio();
        window.state = createPlaneState();
        window.state.thrust = 1;
        window.state.enginePower = 1;
    });
    const loaded = page.waitForResponse('**/audio/gunfire.wav');
    await page.getByRole('button').click();
    await loaded;
    const readings = await page.evaluate(async () => {
        const readings = [];
        for (const aircraft of ['cessna', 'mirage']) {
            window.state.aircraft = aircraft;
            for (const effect of ['engine', 'gun', 'gear']) {
                let peak = 0,
                    energy = 0,
                    count = 0;
                for (let frame = 0; frame < 60; frame++) {
                    if (effect === 'gear')
                        window.state.gearExtension = 1 - frame / 60;
                    window.sound.update(
                        window.state,
                        { space: effect === 'gun' },
                        false,
                        false
                    );
                    await new Promise((r) => setTimeout(r, 16));
                    if (frame < 20) continue;
                    const data = new Float32Array(2048);
                    window.meter.getFloatTimeDomainData(data);
                    for (const value of data) {
                        peak = Math.max(peak, Math.abs(value));
                        energy += value * value;
                        count++;
                    }
                }
                readings.push({
                    aircraft,
                    effect,
                    peak,
                    rms: Math.sqrt(energy / count)
                });
            }
        }
        window.sound.dispose();
        return readings;
    });
    for (const reading of readings) {
        expect(reading.peak).toBeLessThan(0.99);
        expect(reading.rms).toBeGreaterThan(0.005);
    }
    for (const aircraft of ['cessna', 'mirage']) {
        const engine = readings.find(
            (r) => r.aircraft === aircraft && r.effect === 'engine'
        );
        const gun = readings.find(
            (r) => r.aircraft === aircraft && r.effect === 'gun'
        );
        // Firing ducks the engine to 40%; require the combined signal to be
        // at least twice that background level, rather than louder than an unducked engine.
        expect(gun.rms).toBeGreaterThan(engine.rms * 0.8);
    }
});
