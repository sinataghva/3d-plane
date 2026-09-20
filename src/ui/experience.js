import { isEditableTarget } from '../flight/input.js';
import { jetWaypoints } from '../flight/jetNavigation.js';
import { getGeography } from '../scenery/geography.js';
import { getAltitude } from '../flight/flightMetrics.js';
import { getVerticalSpeed } from '../flight/flightMetrics.js';

/** Show a short, nonblocking landing notification; repeated landings reset it. */
const landingTimers = new WeakMap();
/** @param {HTMLElement} element @param {string} message */
export function showLandingFeedback(element, message) {
    clearTimeout(landingTimers.get(element));
    element.textContent = message;
    element.hidden = false;
    for (const animation of element.getAnimations()) animation.cancel();
    element.animate(
        [
            { opacity: 1, offset: 0 },
            { opacity: 1, offset: 0.85 },
            { opacity: 0, offset: 1 }
        ],
        { duration: 3000, fill: 'forwards' }
    );
    landingTimers.set(
        element,
        setTimeout(() => {
            element.hidden = true;
        }, 3000)
    );
}

/** @param {import('../flight/physics.js').PlaneState} state */
export function isOnRunway(state) {
    const world = getGeography();
    if (world) return world.onRunway(state.position.x, state.position.z);
    return (
        Math.abs(state.position.x) <= 10 && Math.abs(state.position.z) <= 150
    );
}

/**
 * @param {import('../flight/physics.js').PlaneState} before
 * @param {import('../flight/physics.js').PlaneState} after
 */
export function describeTouchdown(before, after) {
    if (after.crashReason === 'gear')
        return 'Gear-up touchdown. Extend the landing gear before landing.';
    if (after.crashReason === 'jet-touchdown')
        return 'Landing limits exceeded. Approach at 260–340 km/h, wings level, with gear down and less than 5 m/s descent.';
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
    return `${isOnRunway(after) ? 'Runway landing' : 'Off-field landing'} · ${sink < 2 ? 'Smooth' : sink < 5 ? 'Firm' : 'Hard'} touchdown · ${sink.toFixed(1)} m/s descent.`;
}

/**
 * @param {{planeState: import('../flight/physics.js').PlaneState,
 * cameraMode: import('../rendering/camera.js').CameraMode,
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
    document.getElementById('pause-button')?.remove();
    document.getElementById('pause-overlay')?.remove();
    const menu = document.createElement('button');
    menu.id = 'settings-button';
    menu.textContent = '⚙';
    menu.setAttribute('aria-label', 'Settings (P)');
    menu.setAttribute('aria-haspopup', 'dialog');
    const dialog = document.createElement('dialog');
    dialog.id = 'settings-dialog';
    dialog.setAttribute('aria-labelledby', 'settings-title');
    dialog.innerHTML =
        '<header><h2 id="settings-title">Flight settings</h2><button id="close-settings" aria-label="Close settings">×</button></header><p>Flight paused · P or Esc to resume</p>';
    for (const selector of ['.flight-toolbar', '.graphics-settings']) {
        const element = document.querySelector(selector);
        if (element) dialog.append(element);
    }
    const missions = document.getElementById('missions-button');
    if (missions) dialog.append(missions);
    document.body.append(menu, dialog);
    const camera = /** @type {HTMLButtonElement} */ (
        document.getElementById('camera-button')
    );
    const throttle = /** @type {HTMLInputElement} */ (
        document.getElementById('touch-throttle')
    );
    const jet = planeState.aircraft === 'mirage';
    const world = getGeography();
    const waypoints = jet && world ? jetWaypoints(world) : [];
    let waypoint = 0;
    let paused = false;
    let maxAltitude = 0;
    let startYaw = planeState.yawAngle;
    let completed = false;
    let landingArmed = false;
    const resetProgress = () => {
        waypoint = 0;
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
    const setPaused = (/** @type {boolean} */ value) => {
        if (value) onTakeControl();
        window.dispatchEvent(new Event('flight-input-clear'));
        paused = value;
        document.body.classList.toggle('settings-open', value);
        menu.setAttribute('aria-expanded', String(value));
        if (value && !dialog.open) dialog.showModal();
        if (!value && dialog.open) dialog.close();
        if (!value) menu.blur();
    };
    menu.onclick = () => setPaused(!paused);
    dialog
        .querySelector('#close-settings')
        ?.addEventListener('click', () => setPaused(false));
    dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        setPaused(false);
    });
    window.addEventListener('keydown', (e) => {
        if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
        if (
            e.key.toLowerCase() === 'p' &&
            (paused || !isEditableTarget(e.target))
        ) {
            e.preventDefault();
            setPaused(!paused);
        }
    });
    const restart = () => {
        onTakeControl();
        onRestart();
        setPaused(false);
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
    throttle.min = jet ? '-15' : '0';
    throttle.max = jet ? '115' : '100';
    let throttleHeld = false;
    /** @param {boolean} boost @param {boolean} brake */
    const momentary = (boost, brake) => {
        window.dispatchEvent(new CustomEvent('jet-boost', { detail: boost }));
        window.dispatchEvent(new CustomEvent('jet-brake', { detail: brake }));
    };
    const releaseThrottle = () => {
        throttleHeld = false;
        if (jet) {
            momentary(false, false);
            planeState.afterburner = false;
            planeState.airbrake = false;
            planeState.thrust = Math.max(0, Math.min(1, planeState.thrust));
        }
        throttle.value = String(Math.round(planeState.thrust * 100));
    };
    throttle.onpointerdown = (e) => {
        throttleHeld = true;
        throttle.setPointerCapture(e.pointerId);
    };
    throttle.onpointerup = releaseThrottle;
    throttle.onpointercancel = releaseThrottle;
    throttle.onlostpointercapture = releaseThrottle;
    window.addEventListener('blur', releaseThrottle);
    window.addEventListener('flight-input-clear', releaseThrottle);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) releaseThrottle();
    });
    throttle.oninput = () => {
        onTakeControl();
        const value = Number(throttle.value);
        planeState.thrust = Math.max(0, Math.min(100, value)) / 100;
        if (jet)
            momentary(throttleHeld && value > 100, throttleHeld && value < 0);
    };
    return {
        get paused() {
            return paused;
        },
        reset: resetProgress,
        /** @param {import('../flight/physics.js').PlaneState} before */
        afterStep(before) {
            if (
                jet &&
                guide.value === 'circuit' &&
                waypoint < waypoints.length &&
                getAltitude(planeState) > 150 &&
                Math.hypot(
                    planeState.position.x - waypoints[waypoint].x,
                    planeState.position.z - waypoints[waypoint].z
                ) < 650
            )
                waypoint++;
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
                        maxAltitude >= (jet ? 150 : 50) &&
                        (jet
                            ? waypoint === waypoints.length
                            : turn >= Math.PI * 1.9) &&
                        headingError < 0.2 &&
                        isOnRunway(planeState);
                    showLandingFeedback(
                        feedback,
                        (completed ? 'Circuit complete! ' : '') + result
                    );
                }
            }
        },
        update() {
            const mode = cameraMode.getMode();
            camera.textContent = `Camera: ${mode[0].toUpperCase() + mode.slice(1)}`;
            if (!throttleHeld)
                throttle.value = String(
                    Math.round(Math.min(1, planeState.thrust) * 100)
                );
            const output = document.getElementById('touch-thrust-value');
            if (output)
                output.textContent = `${Math.round(planeState.thrust * 100)}%`;
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
                    : planeState.aircraft === 'mirage'
                      ? 'Set full thrust; hold W for afterburner. At 260 km/h gently pitch up, then retract gear (G). Mobile: full slider + hold boost.'
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
            if (jet && planeState.isAirborne && guide.value === 'circuit') {
                const target = waypoints[waypoint];
                const heading = target
                    ? (((90 -
                          (Math.atan2(
                              -(target.z - planeState.position.z),
                              target.x - planeState.position.x
                          ) *
                              180) /
                              Math.PI) %
                          360) +
                          360) %
                      360
                    : 0;
                hint = target
                    ? `Optional circuit: climb above 150 m AGL; slow to about 400 km/h for turns. ${waypoint + 1}/4 ${target.name} · heading ${Math.round(heading)}° · ${(Math.hypot(target.x - planeState.position.x, target.z - planeState.position.z) / 1000).toFixed(1)} km. Waypoints shown on map; explore freely.`
                    : 'Waypoints complete. Return in your takeoff direction. Gear down, airbrake as needed, approach at 260–340 km/h and descend gently. No time limit.';
            }
            if (message.textContent !== hint) message.textContent = hint;
        }
    };
}
