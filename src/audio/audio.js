import { aircraftCapabilities, isJet } from '../aircraft/capabilities.js';
import { synthesizeSonicBoom } from './sonicBoom.js';
/** Audio mix derived from flight state; speed is metres per 60 Hz tick.
 * @param {import('../flight/physics.js').PlaneState} state */
export function flightMix(state, cockpit = false) {
    const power = Math.max(
        0,
        Math.min(
            1,
            isJet(state.aircraft)
                ? (state.enginePower ?? state.thrust)
                : state.thrust
        )
    );
    return {
        engine: 0.12 + power * 0.28,
        rate: (isJet(state.aircraft) ? 0.8 : 0.65) + power * 0.55,
        wind: Math.min(0.22, Math.max(0, state.speed * 60) / 1600),
        boost: state.afterburner ? 0.23 : 0,
        cutoff: cockpit ? 1400 : 14000,
        cabin: cockpit ? 0.65 : 1
    };
}

/** One persistent audio graph, with bounded loops and short event voices. */
export function createFlightAudio() {
    /** @type {AudioContext} */
    let context;
    /** @type {GainNode} */
    let master;
    /** @type {BiquadFilterNode} */
    let filter;
    let compressor;
    let disposed = false;
    let active = false;
    let volume = 0.55;
    let muted = false;
    let gear = 1;
    let gearSoundUntil = 0;
    let nextShot = 0;
    let boomUntil = 0;
    /** @type {AudioBuffer} */
    let boom;
    /** @type {AudioBuffer} */
    let shot;
    /** @type {AudioBuffer} */
    let impact;
    const loops = new Map();
    const voices = new Set();
    const abort = new AbortController();
    try {
        const saved = JSON.parse(localStorage.getItem('flight-audio') || '{}');
        if (Number.isFinite(saved.volume))
            volume = Math.max(0, Math.min(1, saved.volume));
        muted = saved.muted === true;
    } catch {
        /* Storage can be unavailable in private browsing. */
    }
    const save = () => {
        try {
            localStorage.setItem(
                'flight-audio',
                JSON.stringify({ volume, muted })
            );
        } catch {
            /* Optional persistence. */
        }
    };
    /** @param {AudioParam} param @param {number} value */
    const ramp = (param, value, time = 0.08) =>
        param.setTargetAtTime(value, context.currentTime, time);
    /** @param {number} seconds */
    function noise(seconds) {
        const buffer = context.createBuffer(
            1,
            context.sampleRate * seconds,
            context.sampleRate
        );
        const data = buffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < data.length; i++) {
            previous = (previous + (Math.random() * 2 - 1) * 0.12) / 1.12;
            data[i] = previous * 3;
        }
        return buffer;
    }
    /** @param {string} name @param {AudioBuffer} buffer @param {number} frequency */
    function loop(name, buffer, frequency) {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        const gain = context.createGain();
        gain.gain.value = 0;
        const tone = context.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = frequency;
        source.connect(tone).connect(gain).connect(filter);
        source.start();
        loops.set(name, { source, gain, tone });
    }
    /** @param {string} file */
    async function sample(file) {
        const response = await fetch(
            `${import.meta.env.BASE_URL}audio/${file}`,
            { signal: abort.signal }
        );
        if (!response.ok) throw new Error(`Audio unavailable: ${file}`);
        return context.decodeAudioData(await response.arrayBuffer());
    }
    async function load() {
        for (const [name, file] of [
            ['propeller', 'propeller.wav'],
            ['jet', 'jet.wav'],
            ['gun', 'gunfire.wav']
        ]) {
            try {
                const buffer = await sample(file);
                if (disposed) return;
                if (name === 'gun') {
                    shot = buffer;
                    continue;
                }
                loop(name, buffer, 12000);
            } catch (error) {
                if (!disposed)
                    console.warn(
                        'Audio sample could not load; generated sound remains available.',
                        error
                    );
            }
        }
    }
    function unlock() {
        if (disposed) return;
        if (!context) {
            context = new AudioContext();
            master = context.createGain();
            master.gain.value = 0;
            filter = context.createBiquadFilter();
            filter.type = 'lowpass';
            compressor = context.createDynamicsCompressor();
            compressor.threshold.value = -10;
            compressor.ratio.value = 12;
            compressor.attack.value = 0.003;
            filter
                .connect(compressor)
                .connect(master)
                .connect(context.destination);
            impact = noise(0.35);
            const boomData = synthesizeSonicBoom(context.sampleRate);
            boom = context.createBuffer(1, boomData.length, context.sampleRate);
            boom.copyToChannel(boomData, 0);
            loop('wind', noise(3), 2400);
            loop('boost', noise(3), 900);
            const motor = noise(2);
            const motorData = motor.getChannelData(0);
            for (let i = 0; i < motorData.length; i++) {
                const t = i / context.sampleRate;
                motorData[i] =
                    motorData[i] * 0.5 +
                    0.28 * Math.sin(2 * Math.PI * 420 * t) +
                    0.12 * Math.sin(2 * Math.PI * 840 * t);
            }
            loop('gear', motor, 1800);
            loop('fallback', noise(3), 500);
            void load();
        }
        if (context.state !== 'running' && context.state !== 'closed')
            void context.resume().catch(() => {});
    }
    window.addEventListener('pointerdown', unlock, {
        capture: true,
        signal: abort.signal
    });
    window.addEventListener('keydown', unlock, {
        capture: true,
        signal: abort.signal
    });
    const stopVoices = () => {
        for (const voice of voices) voice.stop();
        voices.clear();
        boomUntil = 0;
    };
    const silence = () => {
        stopVoices();
        active = false;
        if (context) {
            master.gain.cancelScheduledValues(context.currentTime);
            master.gain.setValueAtTime(0, context.currentTime);
        }
    };
    window.addEventListener('blur', silence, { signal: abort.signal });
    document.addEventListener(
        'visibilitychange',
        () => {
            if (document.hidden) silence();
        },
        { signal: abort.signal }
    );
    /** @param {AudioBuffer} buffer @param {number} gainValue @param {number} duration */
    function burst(buffer, gainValue, duration, rate = 1, hold = 0) {
        if (!context || !active || muted || voices.size >= 16) return;
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const gain = context.createGain();
        gain.gain.setValueAtTime(gainValue, context.currentTime);
        gain.gain.setValueAtTime(gainValue, context.currentTime + hold);
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            context.currentTime + duration
        );
        source.connect(gain).connect(filter);
        voices.add(source);
        source.onended = () => {
            source.disconnect();
            gain.disconnect();
            voices.delete(source);
        };
        source.start();
        source.stop(context.currentTime + duration);
    }
    return {
        mount() {
            const panel = document.createElement('fieldset');
            panel.className = 'audio-settings';
            panel.innerHTML =
                '<legend>Sound</legend><label><input id="audio-muted" type="checkbox"> Mute</label><label for="audio-volume">Volume</label><input id="audio-volume" type="range" min="0" max="100" step="1">';
            const dialog = document.getElementById('settings-dialog');
            dialog?.insertBefore(
                panel,
                dialog.querySelector('.settings-actions')
            );
            const mute = /** @type {HTMLInputElement} */ (
                panel.querySelector('#audio-muted')
            );
            const slider = /** @type {HTMLInputElement} */ (
                panel.querySelector('#audio-volume')
            );
            mute.checked = muted;
            slider.value = String(Math.round(volume * 100));
            mute.onchange = () => {
                muted = mute.checked;
                save();
            };
            slider.oninput = () => {
                volume = Number(slider.value) / 100;
                save();
            };
        },
        /** @param {import('../flight/physics.js').PlaneState} state @param {import('../flight/input.js').KeyboardState} keyboard @param {boolean} paused @param {boolean} cockpit */
        update(state, keyboard, paused, cockpit) {
            if (!context) return;
            const nextActive = !paused && !document.hidden && !state.isCrashed;
            if ((active && !nextActive) || muted) stopVoices();
            active = nextActive;
            const mix = flightMix(state, cockpit);
            if (Math.abs((state.gearExtension ?? 1) - gear) > 0.00001)
                gearSoundUntil = context.currentTime + 0.12;
            const gearMoving = context.currentTime < gearSoundUntil;
            const firing =
                keyboard.space &&
                aircraftCapabilities(state.aircraft).weapon === 'gun';
            // Leave room for foreground effects without changing the volume setting.
            const background =
                context.currentTime < boomUntil
                    ? 0.3
                    : firing
                      ? 0.4
                      : gearMoving
                        ? 0.6
                        : 1;
            ramp(master.gain, active && !muted ? volume * mix.cabin : 0, 0.025);
            ramp(filter.frequency, mix.cutoff);
            const engine = isJet(state.aircraft) ? 'jet' : 'propeller';
            for (const [name, layer] of loops) {
                const level =
                    name === engine
                        ? mix.engine * background
                        : name === 'wind'
                          ? mix.wind * background
                          : name === 'boost'
                            ? mix.boost * background
                            : name === 'fallback' && !loops.has(engine)
                              ? mix.engine * background
                              : name === 'gear' && gearMoving
                                ? 0.5
                                : 0;
                ramp(layer.gain.gain, level);
                if (name === engine)
                    ramp(layer.source.playbackRate, mix.rate, 0.25);
            }
            gear = state.gearExtension ?? 1;
            if (active && firing && context.currentTime >= nextShot) {
                burst(
                    shot || impact,
                    isJet(state.aircraft) ? 0.85 : 0.75,
                    0.13,
                    isJet(state.aircraft) ? 0.85 : 1.1,
                    0.025
                );
                nextShot =
                    context.currentTime +
                    (isJet(state.aircraft) ? 0.055 : 0.15);
            }
        },
        sonicBoom() {
            if (!context || !active || muted || document.hidden) return;
            boomUntil = context.currentTime + 0.9;
            burst(boom, 0.95, 1.25, 1, 0.16);
        },
        reset() {
            stopVoices();
            nextShot = 0;
            gearSoundUntil = 0;
        },
        /** @param {number} sink */
        touchdown(sink) {
            if (context)
                burst(
                    impact,
                    Math.min(0.5, 0.15 + Math.abs(sink) * 0.04),
                    0.35
                );
        },
        dispose() {
            disposed = true;
            abort.abort();
            for (const layer of loops.values()) layer.source.stop();
            for (const voice of voices) voice.stop();
            if (context) void context.close();
        }
    };
}
