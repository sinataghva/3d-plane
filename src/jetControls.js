import { MACH_REFERENCE_SPEED } from './jetAerodynamics.js';
import { clearAfterburner } from './jetPhysics.js';
import { isEditableTarget } from './input.js';
/** @param {import('./physics.js').PlaneState} state @param {() => void} takeover */
export function createJetControls(state, takeover) {
    if (state.aircraft !== 'mirage') return { update() {} };
    document.body.classList.add('jet-flight');
    const panel = document.createElement('div');
    panel.id = 'jet-controls';
    panel.innerHTML =
        '<button id="gear-button">Gear: down [G]</button><button id="airbrake-button">Airbrake: off</button><button id="boost-button" aria-label="Hold afterburner">Hold boost</button><output id="jet-readout" aria-live="off"></output>';
    document.body.append(panel);
    document
        .getElementById('flight-data')
        ?.append(
            /** @type {HTMLOutputElement} */ (panel.querySelector('output'))
        );
    const gear = /** @type {HTMLButtonElement} */ (
        panel.querySelector('#gear-button')
    );
    const brake = /** @type {HTMLButtonElement} */ (
        panel.querySelector('#airbrake-button')
    );
    const boost = /** @type {HTMLButtonElement} */ (
        panel.querySelector('#boost-button')
    );
    // Dedicated pointer hold uses the same keyboard controller via synthetic control events.
    let pointer = /** @type {number|null} */ (null);
    boost.onpointerdown = (e) => {
        e.preventDefault();
        takeover();
        pointer = e.pointerId;
        boost.setPointerCapture(e.pointerId);
        window.dispatchEvent(new CustomEvent('jet-boost', { detail: true }));
    };
    const release = () => {
        pointer = null;
        window.dispatchEvent(new CustomEvent('jet-boost', { detail: false }));
        clearAfterburner(state);
    };
    boost.onpointerup = release;
    boost.onpointercancel = release;
    boost.onlostpointercapture = release;
    gear.onclick = () => {
        takeover();
        if (state.isAirborne) state.gearDown = !state.gearDown;
    };
    brake.onpointerdown = (e) => {
        e.preventDefault();
        takeover();
        brake.setPointerCapture(e.pointerId);
        window.dispatchEvent(new CustomEvent('jet-brake', { detail: true }));
    };
    const releaseBrake = () => {
        window.dispatchEvent(new CustomEvent('jet-brake', { detail: false }));
        state.airbrake = false;
    };
    brake.onpointerup = releaseBrake;
    brake.onpointercancel = releaseBrake;
    brake.onlostpointercapture = releaseBrake;
    window.addEventListener('flight-input-clear', releaseBrake);
    window.addEventListener('blur', releaseBrake);
    window.addEventListener('keydown', (e) => {
        if (
            document.body.classList.contains('settings-open') ||
            e.repeat ||
            isEditableTarget(e.target) ||
            e.ctrlKey ||
            e.metaKey ||
            e.altKey
        )
            return;
        if (e.key.toLowerCase() === 'g') gear.click();
    });
    window.addEventListener('keyup', (e) => {
        if (e.key.toLowerCase() === 's') releaseBrake();
        if (e.key.toLowerCase() === 'w' && pointer === null)
            clearAfterburner(state);
    });
    for (const event of ['blur', 'flight-input-clear'])
        window.addEventListener(event, release);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) release();
    });
    return {
        update() {
            const extension = state.gearExtension ?? (state.gearDown ? 1 : 0);
            gear.textContent = `Gear: ${extension > 0.001 && extension < 0.999 ? (state.gearDown ? 'extending' : 'retracting') : state.gearDown ? 'down' : 'up'} [G]`;
            gear.setAttribute('aria-pressed', String(state.gearDown));
            brake.textContent = `Airbrake: ${state.airbrake ? 'on' : 'off'}`;
            brake.setAttribute('aria-pressed', String(state.airbrake));
            boost.dataset.active = String(Boolean(state.afterburner));
            const out = document.getElementById('jet-readout');
            if (out)
                out.textContent = `Mach ${((state.speed * 60) / MACH_REFERENCE_SPEED).toFixed(2)} · ${(state.gForce ?? 1).toFixed(1)} G · ${gear.textContent?.replace(' [G]', '')}${state.airbrake ? ' · BRAKING' : ''}${state.afterburner ? ' · AFTERBURNER' : state.gearDown && state.speed > 2 ? ' · RETRACT GEAR' : extension < 0.98 && state.isAirborne && state.speed < 1.7 ? ' · GEAR UP — CHECK LANDING' : ''}`;
        }
    };
}
