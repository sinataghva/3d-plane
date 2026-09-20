/**
 * @param {string} message
 */
export function showRuntimeFallback(message) {
    const fallbackElement = document.getElementById('runtime-fallback');
    const messageElement = document.getElementById('runtime-fallback-message');

    if (!fallbackElement || !messageElement) {
        return;
    }

    messageElement.textContent = message;
    fallbackElement.hidden = false;
    document.body.classList.add('has-runtime-error');
}

/**
 * @returns {boolean}
 */
export function isWebGLAvailable() {
    const canvas = document.createElement('canvas');
    return Boolean(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
}
