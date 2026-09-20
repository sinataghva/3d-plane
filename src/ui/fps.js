/** Count rendered frame intervals, averaging over half a second.
 * Reset on visibility changes so background throttling is not reported as flight FPS. */
export function createFpsSampler() {
    let start = -1,
        frames = 0;
    return {
        reset() {
            start = -1;
            frames = 0;
        },
        /** @param {number} timestamp */
        update(timestamp) {
            if (start < 0) {
                start = timestamp;
                return null;
            }
            frames++;
            const elapsed = timestamp - start;
            if (elapsed < 500) return null;
            const fps = Math.round((frames * 1000) / elapsed);
            start = timestamp;
            frames = 0;
            return fps;
        }
    };
}
export function createFpsCounter() {
    const element = document.createElement('div');
    element.id = 'fps-counter';
    element.textContent = '— FPS';
    element.setAttribute('aria-label', 'Rendering frames per second');
    document.body.append(element);
    const sampler = createFpsSampler();
    const reset = () => {
        sampler.reset();
        element.textContent = '— FPS';
    };
    document.addEventListener('visibilitychange', reset);
    return {
        /** @param {number} timestamp */
        update(timestamp) {
            if (document.hidden) return;
            const fps = sampler.update(timestamp);
            if (fps !== null) element.textContent = `${fps} FPS`;
        },
        dispose() {
            document.removeEventListener('visibilitychange', reset);
            element.remove();
        }
    };
}
