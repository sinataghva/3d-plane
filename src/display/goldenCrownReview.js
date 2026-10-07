import * as THREE from 'three';
import { DISPLAY_PHASES } from './goldenCrownFlight.js';
import './goldenCrownReview.css';

/** @param {{display:ReturnType<import('./goldenCrownDisplay.js').createGoldenCrownDisplay>, camera:THREE.PerspectiveCamera, controls:import('three/addons/controls/OrbitControls.js').OrbitControls, world:{height:(x:number,z:number)=>number}}} options */
export function createGoldenCrownReview({ display, camera, controls, world }) {
    const button = document.createElement('button');
    button.id = 'golden-crown-watch';
    button.textContent = 'Watch Golden Crown';
    document.body.append(button);
    const panel = document.createElement('section');
    panel.id = 'golden-crown-review';
    panel.setAttribute('aria-label', 'Golden Crown display review');
    panel.innerHTML = `<div class="gc-heading"><strong>GOLDEN CROWN <small>Mehrabad · six-aircraft display</small></strong><button data-action="exit">Return to F-4</button></div>
    <output aria-live="off"></output><label>Show timeline <input aria-label="Show timeline" type="range" min="0" max="239.9" step="0.1" value="8"></label>
    <div class="gc-buttons"><button data-action="play">Pause</button><button data-action="back">−1 second</button><button data-action="next">+1 second</button>
    <label>View <select aria-label="Display view"><option value="aerial">Aerial orbit</option><option value="wide">Wide formation</option><option value="solo">Solo pair</option><option value="ground">Ground observer · telephoto</option></select></label>
    <label>Maneuver <select aria-label="Display maneuver">${DISPLAY_PHASES.map((p) => `<option value="${p.time}">${p.label}</option>`).join('')}</select></label>
    <label>Smoke <select aria-label="Smoke colors"><option value="tricolor">Iran colors · stylized</option><option value="white">White</option></select></label></div>
    <small>Drag to orbit · scroll or pinch to zoom. The F-4 is paused while reviewing. Historically inspired choreography.</small>`;
    const collapse = document.createElement('button');
    collapse.className = 'gc-collapse';
    /** @param {boolean} collapsed */
    function setCollapsed(collapsed) {
        panel.classList.toggle('gc-collapsed', collapsed);
        collapse.setAttribute('aria-expanded', String(!collapsed));
        collapse.setAttribute('aria-label', collapsed ? 'Show display controls' : 'Hide display controls');
        collapse.title = collapsed ? 'Show controls' : 'Hide controls';
        collapse.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="${collapsed ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
    collapse.onclick = () => setCollapsed(!panel.classList.contains('gc-collapsed'));
    panel.append(collapse);
    setCollapsed(false);
    document.body.append(panel);
    const slider = /** @type {HTMLInputElement} */ (
        panel.querySelector('input')
    );
    const view = /** @type {HTMLSelectElement} */ (
        panel.querySelector('[aria-label="Display view"]')
    );
    const phases = /** @type {HTMLSelectElement} */ (
        panel.querySelector('[aria-label="Display maneuver"]')
    );
    const play = /** @type {HTMLButtonElement} */ (
        panel.querySelector('[data-action="play"]')
    );
    const smokeStyle = /** @type {HTMLSelectElement} */ (
        panel.querySelector('[aria-label="Smoke colors"]')
    );
    smokeStyle.onchange = () => display.setSmokeStyle(smokeStyle.value);
    let active = false;
    let saved = {
        position: camera.position.clone(),
        target: controls.target.clone(),
        fov: camera.fov,
        min: controls.minDistance,
        max: controls.maxDistance,
        enabled: controls.enabled,
        polar: controls.maxPolarAngle
    };
    let lastTarget = new THREE.Vector3();
    function framing() {
        const indices =
            view.value === 'solo'
                ? [4, 5]
                : view.value === 'wide' || view.value === 'ground'
                  ? [0, 1, 2, 3, 4, 5]
                  : [0, 1, 2, 3];
        const points = indices.map((i) => display.target(i));
        const target = points
            .reduce((sum, p) => sum.add(p), new THREE.Vector3())
            .divideScalar(points.length);
        const radius = Math.max(
            45,
            ...points.map((p) => p.distanceTo(target) + 12)
        );
        if (view.value !== 'ground') target.y -= radius * 0.25;
        return { target, radius };
    }
    function frame() {
        const { target, radius } = framing();
        controls.target.copy(target);
        lastTarget.copy(target);
        camera.fov = view.value === 'ground' ? 7 : 42;
        camera.updateProjectionMatrix();
        if (view.value === 'ground') {
            display.root.updateMatrixWorld(true);
            const ground = display.root.localToWorld(
                new THREE.Vector3(0, 0, 700)
            );
            ground.y = world.height(ground.x, ground.z) + 5;
            camera.position.copy(ground);
        } else {
            const distance =
                (radius / Math.sin(THREE.MathUtils.degToRad(21))) * 1.45;
            camera.position
                .copy(target)
                .add(
                    new THREE.Vector3(
                        1,
                        view.value === 'wide' ? -0.25 : 0.3,
                        1.3
                    )
                        .normalize()
                        .multiplyScalar(distance)
                );
        }
        camera.lookAt(target);
        controls.update();
    }
    function enter() {
        if (active) return;
        saved = {
            position: camera.position.clone(),
            target: controls.target.clone(),
            fov: camera.fov,
            min: controls.minDistance,
            max: controls.maxDistance,
            enabled: controls.enabled,
            polar: controls.maxPolarAngle
        };
        active = true;
        document.body.classList.add('golden-crown-reviewing');
        window.dispatchEvent(new Event('flight-input-clear'));
        controls.enabled = true;
        controls.minDistance = 20;
        controls.maxDistance = 10000;
        controls.maxPolarAngle = Math.PI;
        frame();
    }
    function exit() {
        active = false;
        document.body.classList.remove('golden-crown-reviewing');
        camera.position.copy(saved.position);
        controls.target.copy(saved.target);
        camera.fov = saved.fov;
        camera.updateProjectionMatrix();
        controls.minDistance = saved.min;
        controls.maxDistance = saved.max;
        controls.maxPolarAngle = saved.polar;
        controls.enabled = saved.enabled;
        camera.userData.flightMode = '';
        controls.update();
        display.paused = false;
        window.dispatchEvent(new Event('flight-input-clear'));
    }
    slider.oninput = () => {
        display.paused = true;
        display.seek(Number(slider.value));
        frame();
    };
    phases.onchange = () => {
        display.paused = true;
        display.seek(Number(phases.value));
        frame();
    };
    view.onchange = frame;
    button.onclick = enter;
    panel
        .querySelector('[data-action="exit"]')
        ?.addEventListener('click', exit);
    play.onclick = () => {
        display.paused = !display.paused;
    };
    for (const [action, delta] of [
        ['back', -1],
        ['next', 1]
    ]) {
        panel
            .querySelector(`[data-action="${action}"]`)
            ?.addEventListener('click', () => {
                display.paused = true;
                display.seek(display.time + Number(delta));
                frame();
            });
    }
    /** @param {KeyboardEvent} event */
    function reviewKeys(event) {
        if (event.metaKey || event.ctrlKey) return;
        if (
            !active ||
            (event.target instanceof Node && panel.contains(event.target))
        )
            return;
        if (event.key === 'Escape' && event.type === 'keydown') exit();
        event.stopImmediatePropagation();
        event.preventDefault();
    }
    window.addEventListener('keydown', reviewKeys, true);
    window.addEventListener('keyup', reviewKeys, true);
    // Keep flying shortcuts from consuming slider arrows or camera selections.
    panel.addEventListener('keydown', (e) => e.stopPropagation());
    panel.addEventListener('keyup', (e) => e.stopPropagation());
    if (new URLSearchParams(location.search).get('goldenCrown') === 'review') {
        enter();
        display.paused = true;
    }
    return {
        get active() {
            return active;
        },
        update() {
            if (!active) return;
            const { target } = framing();
            if (view.value !== 'ground')
                camera.position.add(target.clone().sub(lastTarget));
            controls.target.copy(target);
            lastTarget.copy(target);
            controls.update();
            slider.value = String(display.time);
            phases.value = String(
                DISPLAY_PHASES.reduce(
                    (last, p) => (display.time >= p.time ? p : last),
                    DISPLAY_PHASES[0]
                ).time
            );
            play.textContent = display.paused ? 'Play' : 'Pause';
            play.setAttribute('aria-pressed', String(!display.paused));
            panel.getElementsByTagName('output')[0].textContent =
                `${display.time.toFixed(1)} / 240 s · ${display.phase}`;
            panel.dataset.ready = 'true';
        },
        dispose() {
            window.removeEventListener('keydown', reviewKeys, true);
            window.removeEventListener('keyup', reviewKeys, true);
            button.remove();
            panel.remove();
            document.body.classList.remove('golden-crown-reviewing');
        }
    };
}
