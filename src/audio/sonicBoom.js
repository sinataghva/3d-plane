/** Original procedural game cue: two pressure cracks followed by a low rumble.
 * No downloaded samples. Deterministic and peak-limited before the master mix.
 * @param {number} sampleRate */
export function synthesizeSonicBoom(sampleRate) {
    const data = new Float32Array(Math.ceil(sampleRate * 1.25));
    let seed = 1701,
        low = 0,
        peak = 0;
    for (let i = 0; i < data.length; i++) {
        const t = i / sampleRate;
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = (seed / 4294967296) * 2 - 1;
        low +=
            (noise - low) * (1 - Math.exp((-2 * Math.PI * 180) / sampleRate));
        let value = 0;
        for (const [start, strength] of [
            [0.015, 1],
            [0.13, 0.72]
        ]) {
            const u = t - start;
            if (u < 0) continue;
            const attack = Math.min(1, u / 0.002);
            value +=
                strength *
                attack *
                (noise * 0.22 * Math.exp(-u / 0.025) +
                    low * 1.6 * Math.exp(-u / 0.16) +
                    Math.sin(2 * Math.PI * 65 * u) *
                        0.48 *
                        Math.exp(-u / 0.095));
        }
        value += low * 0.5 * Math.min(1, t / 0.03) * Math.exp(-t / 0.32);
        value *= Math.min(1, (1.25 - t) / 0.12);
        data[i] = value;
        peak = Math.max(peak, Math.abs(value));
    }
    const gain = 0.85 / (peak || 1);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
    return data;
}
