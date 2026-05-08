/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 * @typedef {import('./camera.js').CameraMode} CameraMode
 */

const LOW_SPEED_MARGIN = 1.12;
const TERRAIN_WARNING_ALTITUDE = 15;
const TERRAIN_WARNING_SINK_RATE = -0.05;
const TRANSIENT_DURATION = 1.35;

/**
 * @typedef {object} WarningState
 * @property {string} level
 * @property {string} label
 * @property {string} message
 */

/**
 * @param {string} mode
 * @returns {string}
 */
function formatMode(mode) {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
}

/**
 * @param {object} args
 * @param {PlaneState} args.planeState
 * @param {number} args.stallSpeed
 * @returns {WarningState | null}
 */
export function getActiveFlightWarning({ planeState, stallSpeed }) {
    const altitude = Math.max(0, planeState.position.y - 0.5);

    if (planeState.isCrashed) {
        return null;
    }

    if (planeState.isStalling) {
        return {
            level: 'danger',
            label: 'Stall',
            message: 'Lower nose and add thrust'
        };
    }

    if (
        planeState.isAirborne &&
        altitude < TERRAIN_WARNING_ALTITUDE &&
        planeState.verticalSpeed < TERRAIN_WARNING_SINK_RATE
    ) {
        return {
            level: 'danger',
            label: 'Terrain',
            message: 'Pull up'
        };
    }

    if (
        planeState.isAirborne &&
        planeState.speed < stallSpeed * LOW_SPEED_MARGIN
    ) {
        return {
            level: 'caution',
            label: 'Low speed',
            message: 'Add thrust or lower nose'
        };
    }

    return null;
}

export function createWarningBanner() {
    const bannerElement = document.getElementById('warning-banner');
    const labelElement = document.getElementById('warning-label');
    const messageElement = document.getElementById('warning-message');

    if (
        !(bannerElement instanceof HTMLElement) ||
        !(labelElement instanceof HTMLElement) ||
        !(messageElement instanceof HTMLElement)
    ) {
        throw new Error('Missing warning banner elements');
    }
    const banner = bannerElement;
    const label = labelElement;
    const message = messageElement;

    let previousCameraMode = '';
    let previousThrustPercent = 0;
    let transientWarning = /** @type {WarningState | null} */ (null);
    let transientTimeRemaining = 0;

    /**
     * @param {WarningState | null} warning
     */
    function render(warning) {
        if (!warning) {
            banner.hidden = true;
            banner.dataset.level = '';
            return;
        }

        banner.hidden = false;
        banner.dataset.level = warning.level;
        label.textContent = warning.label;
        message.textContent = warning.message;
    }

    return {
        /**
         * @param {object} args
         * @param {PlaneState} args.planeState
         * @param {CameraMode} args.cameraMode
         * @param {number} args.stallSpeed
         * @param {number} args.delta
         */
        update({ planeState, cameraMode, stallSpeed, delta }) {
            const cameraModeName = cameraMode.getMode();
            const thrustPercent = Math.round(planeState.thrust * 100);

            if (!previousCameraMode) {
                previousCameraMode = cameraModeName;
                previousThrustPercent = thrustPercent;
            }

            if (cameraModeName !== previousCameraMode) {
                transientWarning = {
                    level: 'info',
                    label: 'Camera',
                    message: `${formatMode(cameraModeName)} view`
                };
                transientTimeRemaining = TRANSIENT_DURATION;
                previousCameraMode = cameraModeName;
            } else if (Math.abs(thrustPercent - previousThrustPercent) >= 10) {
                transientWarning = {
                    level: 'info',
                    label: 'Thrust',
                    message: `${thrustPercent}%`
                };
                transientTimeRemaining = TRANSIENT_DURATION;
                previousThrustPercent = thrustPercent;
            }

            const flightWarning = getActiveFlightWarning({
                planeState,
                stallSpeed
            });
            if (flightWarning) {
                render(flightWarning);
                return;
            }

            if (transientWarning && transientTimeRemaining > 0) {
                transientTimeRemaining -= delta;
                render(transientWarning);
                return;
            }

            transientWarning = null;
            render(null);
        }
    };
}
