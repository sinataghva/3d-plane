import { updateCamera } from '../rendering/camera.js';

/** Pause the scene and frame it with the existing orbit controls.
 * @param {{camera: import('three').PerspectiveCamera,
 * controls: import('three/addons/controls/OrbitControls.js').OrbitControls,
 * airplane: import('three').Object3D, canvas: HTMLCanvasElement,
 * onPause: (active: boolean) => void}} options */
export function createPhotoMode({
    camera,
    controls,
    airplane,
    canvas,
    onPause
}) {
    const button = document.createElement('button');
    button.id = 'photo-button';
    button.setAttribute('aria-label', 'Photo mode');
    button.innerHTML =
        '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M3 6h4l2-3h6l2 3h4v15H3Z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const panel = document.createElement('section');
    panel.id = 'photo-controls';
    panel.setAttribute('aria-label', 'Photo mode controls');
    panel.innerHTML =
        '<span>Photo mode · paused</span><span class="photo-help">Drag to orbit · scroll/pinch to zoom · right-drag/two fingers to pan. Tap the scene to restore hidden controls; Esc returns to flying.</span><div><button id="photo-reset">Reset view</button><button id="photo-hide">Hide controls</button><button id="photo-exit">Return to flying</button></div>';
    document.body.append(button, panel);
    let active = false;
    const snapshot = () => ({
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        up: camera.up.clone(),
        target: controls.target.clone(),
        fov: camera.fov,
        mode: camera.userData.flightMode,
        maxDistance: controls.maxDistance,
        damping: controls.enableDamping
    });
    let saved = snapshot();
    const framePlane = () => {
        camera.userData.flightMode = '';
        updateCamera({
            camera,
            controls,
            airplane,
            cameraMode: {
                getMode: () => 'orbit',
                isOrbitMode: () => true,
                setMode: () => {}
            }
        });
    };
    function exit() {
        if (!active) return;
        active = false;
        document.body.classList.remove('photo-mode', 'photo-controls-hidden');
        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = saved.damping;
        controls.maxDistance = saved.maxDistance;
        controls.target.copy(saved.target);
        camera.position.copy(saved.position);
        camera.quaternion.copy(saved.quaternion);
        camera.up.copy(saved.up);
        camera.fov = saved.fov;
        camera.updateProjectionMatrix();
        camera.userData.flightMode = saved.mode;
        onPause(false);
        window.dispatchEvent(new Event('flight-input-clear'));
    }
    button.onclick = () => {
        if (active || document.querySelector('dialog[open]')) return;
        saved = snapshot();
        active = true;
        onPause(true);
        window.dispatchEvent(new Event('flight-input-clear'));
        document.body.classList.add('photo-mode');
        controls.maxDistance = 600;
        framePlane();
    };
    panel.querySelector('#photo-exit')?.addEventListener('click', exit);
    panel.querySelector('#photo-reset')?.addEventListener('click', framePlane);
    panel.querySelector('#photo-hide')?.addEventListener('click', () => {
        document.body.classList.add('photo-controls-hidden');
        canvas.focus();
    });
    canvas.tabIndex = -1;
    /** @type {{x: number, y: number} | null} */
    let start = null;
    let moved = false;
    canvas.addEventListener('pointerdown', (e) => {
        if (start) moved = true;
        else {
            start = { x: e.clientX, y: e.clientY };
            moved = false;
        }
    });
    canvas.addEventListener('pointermove', (e) => {
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
            moved = true;
    });
    canvas.addEventListener('pointerup', () => {
        if (active && start && !moved)
            document.body.classList.remove('photo-controls-hidden');
        start = null;
    });
    canvas.addEventListener('pointercancel', () => {
        start = null;
    });
    const key = (/** @type {KeyboardEvent} */ e) => {
        if (!active || e.metaKey || e.ctrlKey || e.altKey) return;
        if (e.key === 'Escape') exit();
        // Stop flight shortcuts, including map, gear, fire and camera cycling.
        if (e.key !== 'Tab' && e.key !== 'Enter') {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    };
    window.addEventListener('keydown', key, { capture: true });
    return {
        get active() {
            return active;
        },
        update() {
            if (active) controls.update();
        },
        dispose() {
            exit();
            window.removeEventListener('keydown', key, true);
            button.remove();
            panel.remove();
        }
    };
}
