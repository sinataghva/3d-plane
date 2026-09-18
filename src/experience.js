import { getGeography } from './geography.js';
import { getAltitude } from './flightMetrics.js';
import { getVerticalSpeed } from './flightMetrics.js';

/** @param {import('./physics.js').PlaneState} state */
export function isOnRunway(state) {
    const world = getGeography();
    if (world) return world.onRunway(state.position.x, state.position.z);
    return (
        Math.abs(state.position.x) <= 10 && Math.abs(state.position.z) <= 150
    );
}

/**
 * @param {import('./physics.js').PlaneState} before
 * @param {import('./physics.js').PlaneState} after
 */
export function describeTouchdown(before, after) {
    const sink = Math.max(0, -getVerticalSpeed(before) * 60);
    if (after.crashReason === 'water')
        return 'Water landing. Return to the grass runway for a safe touchdown.';
    if (after.crashReason === 'building')
        return 'Building impact. Climb above rooftops before crossing the town.';
    if (after.isCrashed) {
        return Math.abs(before.rollAngle) > 1.35
            ? 'Wings struck the ground. Level your bank before touchdown.'
            : Math.abs(before.pitchAngle) > 0.85
              ? 'Pitch was too steep at impact. Ease the nose toward the horizon.'
              : 'Descent was too fast. Add thrust and gently raise the nose earlier.';
    }
    return `${isOnRunway(after) ? 'Runway landing' : 'Off-field landing'} · ${sink < 2 ? 'Smooth' : sink < 5 ? 'Firm' : 'Hard'} touchdown · ${sink.toFixed(1)} m/s descent. Reduce thrust to stop, or take off again.`;
}

/**
 * @param {{planeState: import('./physics.js').PlaneState,
 * cameraMode: import('./camera.js').CameraMode,
 * onRestart: () => void, onTakeControl: () => void}} options
 */
export function createExperience({
    planeState,
    cameraMode,
    onRestart,
    onTakeControl
}) {
    const guide = /** @type {HTMLSelectElement} */ (
        document.getElementById('guide-mode')
    );
    const card = /** @type {HTMLElement} */ (
        document.getElementById('guide-card')
    );
    const message = /** @type {HTMLElement} */ (
        document.getElementById('guide-message')
    );
    const feedback = /** @type {HTMLElement} */ (
        document.getElementById('flight-feedback')
    );
    const pause = /** @type {HTMLButtonElement} */ (
        document.getElementById('pause-button')
    );
    const camera = /** @type {HTMLButtonElement} */ (
        document.getElementById('camera-button')
    );
    const throttle = /** @type {HTMLInputElement} */ (
        document.getElementById('touch-throttle')
    );
    let paused = false;
    let feedbackUntil = 0;
    let maxAltitude = 0;
    let startYaw = planeState.yawAngle;
    let completed = false;
    let landingArmed = false;
    const resetProgress = () => {
        maxAltitude = 0;
        startYaw = planeState.yawAngle;
        completed = false;
        landingArmed = false;
        feedback.hidden = true;
    };
    guide.onchange = resetProgress;
    document.getElementById('dismiss-guide')?.addEventListener('click', () => {
        guide.value = 'free';
        card.hidden = true;
    });
    pause.onclick = () => {
        onTakeControl();
        paused = !paused;
        pause.textContent = paused ? 'Resume' : 'Pause';
        pause.setAttribute('aria-pressed', String(paused));
        document
            .getElementById('pause-overlay')
            ?.toggleAttribute('hidden', !paused);
    };
    const restart = () => {
        onTakeControl();
        onRestart();
        paused = false;
        pause.textContent = 'Pause';
        pause.setAttribute('aria-pressed', 'false');
        document.getElementById('pause-overlay')?.setAttribute('hidden', '');
        feedback.hidden = true;
        resetProgress();
    };
    document
        .getElementById('restart-button')
        ?.addEventListener('click', restart);
    document.getElementById('crash-retry')?.addEventListener('click', restart);
    camera.onclick = () => {
        const modes = ['chase', 'cockpit', 'orbit'];
        cameraMode.setMode(
            modes[(modes.indexOf(cameraMode.getMode()) + 1) % modes.length]
        );
    };
    throttle.oninput = () => {
        onTakeControl();
        planeState.thrust = Number(throttle.value) / 100;
    };
    return {
        get paused() {
            return paused;
        },
        reset: resetProgress,
        /** @param {import('./physics.js').PlaneState} before */
        afterStep(before) {
            maxAltitude = Math.max(maxAltitude, getAltitude(planeState));
            if (getAltitude(planeState) >= 2) landingArmed = true;
            if (
                before.isAirborne &&
                !planeState.isAirborne &&
                (landingArmed || planeState.isCrashed)
            ) {
                landingArmed = false;
                const result = describeTouchdown(before, planeState);
                if (planeState.isCrashed) {
                    const reason = document.getElementById('crash-reason');
                    if (reason) reason.textContent = result;
                } else {
                    const turn = Math.abs(planeState.yawAngle - startYaw);
                    const headingError = Math.abs(
                        Math.atan2(Math.sin(turn), Math.cos(turn))
                    );
                    completed =
                        guide.value === 'circuit' &&
                        maxAltitude >= 50 &&
                        turn >= Math.PI * 1.9 &&
                        headingError < 0.2 &&
                        isOnRunway(planeState);
                    feedback.textContent =
                        (completed ? 'Circuit complete! ' : '') + result;
                    feedback.hidden = false;
                    feedbackUntil = performance.now() + 12000;
                }
            }
        },
        update() {
            const mode = cameraMode.getMode();
            camera.textContent = `Camera: ${mode[0].toUpperCase() + mode.slice(1)}`;
            throttle.value = String(Math.round(planeState.thrust * 100));
            const output = document.getElementById('touch-thrust-value');
            if (output) output.textContent = `${throttle.value}%`;
            if (performance.now() > feedbackUntil) feedback.hidden = true;
            card.hidden =
                guide.value === 'free' ||
                planeState.isCrashed ||
                !feedback.hidden;
            const distance = Math.round(
                Math.hypot(
                    planeState.position.x - (getGeography()?.spawn.x || 0),
                    planeState.position.z - (getGeography()?.spawn.z || 0)
                )
            );
            let hint;
            if (guide.value === 'landing') {
                hint = `Airfield ${distance} m away. Return whenever you like. Align with the runway, ease thrust, and keep wings level during a gentle descent.`;
            } else if (!planeState.isAirborne) {
                hint = completed
                    ? 'Circuit complete. Keep exploring or select another guide.'
                    : 'Set full thrust, build speed to 135 km/h, then gently pitch up (↓ or pull the stick).';
            } else if (guide.value === 'takeoff') {
                hint =
                    'You’re flying! Ease pitch as you climb. Bank to turn; release to level your wings. Explore as long as you like.';
            } else {
                hint =
                    maxAltitude < 50
                        ? 'Optional circuit: climb to at least 50 m before turning.'
                        : '50 m reached. When ready, bank through a full circuit and return to the runway in your takeoff direction. No time limit.';
            }
            if (message.textContent !== hint) message.textContent = hint;
        }
    };
}
