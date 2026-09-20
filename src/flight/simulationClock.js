export const FIXED_STEP = 1 / 60;

/** Fixed 60 Hz simulation, independent of render refresh rate. */
export function createSimulationClock() {
    let accumulated = 0;
    return {
        reset() {
            accumulated = 0;
        },
        /** @param {number} delta @param {(delta: number) => void} advance */
        update(delta, advance) {
            if (!Number.isFinite(delta) || delta <= 0) return;
            // Avoid an unbounded catch-up after suspension; ordinary slow frames
            // (down to 4 FPS) still receive their full simulation time.
            accumulated += Math.min(delta, 0.25);
            while (accumulated + 1e-10 >= FIXED_STEP) {
                accumulated = Math.max(0, accumulated - FIXED_STEP);
                advance(FIXED_STEP);
            }
        }
    };
}
