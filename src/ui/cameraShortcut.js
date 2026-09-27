/** Mobile-only shortcut sharing the keyboard camera cycle.
 * @param {import('../rendering/camera.js').CameraMode} cameraMode */
export function createCameraShortcut(cameraMode) {
    const button = document.createElement('button');
    button.id = 'camera-shortcut';
    button.type = 'button';
    button.setAttribute('aria-label', 'Switch camera view');
    button.title = 'Switch camera view';
    button.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="2" y="5" width="13" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="m15 9 7-4v14l-7-4Z" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    button.onclick = () => {
        cameraMode.cycle?.();
        button.blur();
    };
    document.body.append(button);
    return {
        dispose() {
            button.remove();
        }
    };
}
