import { test, expect } from '@playwright/test';
for (const mobile of [false, true])
    test(`Mach vapor ${mobile ? 'mobile' : 'desktop'}`, async ({
        browser
    }, info) => {
        const context = await browser.newContext({
            viewport: mobile
                ? { width: 844, height: 390 }
                : { width: 1280, height: 720 },
            isMobile: mobile,
            hasTouch: mobile
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => {
            if (m.type() === 'error') errors.push(m.text());
        });
        await page.goto('/3d-plane/?mission=luxeuil&visual=mach');
        await page.waitForFunction(
            () => document.documentElement.dataset.visualReady === 'true'
        );
        await page.screenshot({ path: info.outputPath('mach.png') });
        expect(errors).toEqual([]);
        await context.close();
    });

test('Mirage takeoff accelerates across Mach 1 exactly once', async ({
    page
}, info) => {
    test.setTimeout(90000);
    await page.addInitScript(() => {
        window.boomStarts = 0;
        const start = AudioBufferSourceNode.prototype.start;
        AudioBufferSourceNode.prototype.start = function (...args) {
            if (
                !this.loop &&
                Math.abs((this.buffer?.duration || 0) - 1.25) < 0.001
            )
                window.boomStarts++;
            return start.apply(this, args);
        };
    });
    await page.goto('/3d-plane/?mission=luxeuil&automation=1');
    await page.waitForFunction(() => Boolean(window.planeAutomation));
    await page.keyboard.press('Shift');
    const flight = await page.evaluate(() => {
        const a = window.planeAutomation;
        a.setControls({ throttle: 1, boost: true });
        a.step({ seconds: 10 });
        a.setControls({ pitch: 0.18 });
        a.step({ seconds: 3 });
        a.setControls({ gearDown: false });
        let crossed = false;
        for (let i = 0; i < 650; i++) {
            const s = a.getState().plane;
            if (s.isCrashed) break;
            a.setControls({
                pitch: Math.max(-0.2, Math.min(0.3, (0.1 - s.pitchAngle) * 4))
            });
            a.step({ seconds: 0.1 });
            if (a.getState().plane.speed * 60 >= 343) {
                crossed = true;
                break;
            }
        }
        // Allow the newly triggered shell to fade in, without advancing out of it.
        if (crossed) a.step({ seconds: 0.2 });
        return { crossed, state: a.getState() };
    });
    expect(flight.crossed).toBe(true);
    expect(flight.state.plane.isCrashed).toBe(false);
    await page.waitForFunction(
        () =>
            JSON.parse(document.documentElement.dataset.sceneryStats || '{}')
                .machTransitions === 1
    );
    await page.screenshot({
        path: info.outputPath('mach-crossing-flight.png')
    });
    await page.evaluate(() => window.planeAutomation.step({ seconds: 3 }));
    await page.waitForTimeout(1200);
    expect(
        await page.evaluate(
            () =>
                JSON.parse(document.documentElement.dataset.sceneryStats)
                    .machTransitions
        )
    ).toBe(1);
    const fast = await page.evaluate(() => {
        window.planeAutomation.step({ seconds: 10 });
        return window.planeAutomation.getState().plane;
    });
    expect(fast.speed * 60).toBeGreaterThan(390);
    expect(fast.isCrashed).toBe(false);
    await page.screenshot({ path: info.outputPath('beyond-former-cap.png') });
});

test('sonic boom creates a bounded audible voice and respects pause, mute and reset', async ({
    page
}) => {
    await page.route('**/boom-harness', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<button>Start</button><div id="settings-dialog"></div>'
        })
    );
    await page.goto('/boom-harness');
    await page.evaluate(async () => {
        window.sources = [];
        const original = AudioContext.prototype.createBufferSource;
        AudioContext.prototype.createBufferSource = function () {
            const s = original.call(this);
            window.sources.push(s);
            return s;
        };
        const connect = AudioNode.prototype.connect;
        AudioNode.prototype.connect = function (...args) {
            if (args[0] instanceof AudioDestinationNode) {
                window.meter = this.context.createAnalyser();
                connect.call(this, window.meter);
            }
            return connect.apply(this, args);
        };
        const { createFlightAudio } = await import('/3d-plane/src/audio.js');
        const { createPlaneState } = await import('/3d-plane/src/physics.js');
        window.sound = createFlightAudio();
        window.sound.mount();
        window.state = {
            ...createPlaneState(),
            aircraft: 'mirage',
            thrust: 1,
            enginePower: 1
        };
    });
    await page.getByRole('button', { name: 'Start' }).click();
    const result = await page.evaluate(async () => {
        const sound = window.sound,
            state = window.state,
            keys = { space: false };
        sound.update(state, keys, false, false);
        sound.sonicBoom();
        const oneShot = () => window.sources.filter((s) => !s.loop);
        const count = oneShot().length;
        const buffer = oneShot()[0].buffer;
        let peak = 0;
        for (let i = 0; i < 20; i++) {
            sound.update(state, keys, false, false);
            await new Promise((r) => setTimeout(r, 16));
            const data = new Float32Array(2048);
            window.meter.getFloatTimeDomainData(data);
            peak = Math.max(peak, ...data.map(Math.abs));
        }
        sound.update(state, keys, true, false);
        sound.sonicBoom();
        const paused = oneShot().length;
        sound.update(state, keys, false, false);
        sound.reset();
        document.querySelector('#audio-muted').checked = true;
        document
            .querySelector('#audio-muted')
            .dispatchEvent(new Event('change'));
        sound.update(state, keys, false, false);
        sound.sonicBoom();
        const muted = oneShot().length;
        sound.dispose();
        await new Promise((r) => setTimeout(r, 60));
        return {
            count,
            paused,
            muted,
            peak,
            duration: buffer.duration,
            context: oneShot()[0].context.state
        };
    });
    expect(result.count).toBe(1);
    expect(result.paused).toBe(1);
    expect(result.muted).toBe(1);
    expect(result.duration).toBeCloseTo(1.25);
    expect(result.peak).toBeGreaterThan(0.01);
    expect(result.peak).toBeLessThan(1);
    expect(result.context).toBe('closed');
});
