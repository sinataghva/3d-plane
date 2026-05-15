/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 * @typedef {import('./camera.js').CameraMode} CameraMode
 */

const RADIANS_TO_DEGREES = 180 / Math.PI;
const MAX_GAUGE_ROTATION = 135;
const MAX_AIRSPEED_KMH = 220;
const MAX_ALTITUDE_METERS = 220;
const INTERNAL_SPEED_TO_KMH = 90;

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

/**
 * @param {HTMLElement} needle
 * @param {number} value
 * @param {number} maxValue
 */
function updateNeedle(needle, value, maxValue) {
    const progress = clamp(value / maxValue, 0, 1);
    const degrees = -MAX_GAUGE_ROTATION + progress * MAX_GAUGE_ROTATION * 2;
    needle.style.transform = `rotate(${degrees}deg)`;
}

export function createCockpitOverlay() {
    const overlay = document.getElementById('cockpit-overlay');
    const speedNeedle = document.getElementById('cockpit-speed-needle');
    const altitudeNeedle = document.getElementById('cockpit-altitude-needle');
    const horizon = document.getElementById('cockpit-horizon');

    if (
        !(overlay instanceof HTMLElement) ||
        !(speedNeedle instanceof HTMLElement) ||
        !(altitudeNeedle instanceof HTMLElement) ||
        !(horizon instanceof HTMLElement)
    ) {
        throw new Error('Missing cockpit overlay elements');
    }

    return {
        /**
         * @param {{ planeState: PlaneState, cameraMode: CameraMode }} args
         */
        update({ planeState, cameraMode }) {
            const isCockpit = cameraMode.getMode() === 'cockpit';
            overlay.hidden = !isCockpit;

            if (!isCockpit) return;

            const altitude = Math.max(0, planeState.position.y - 0.5);
            const speedKmh = Math.max(
                0,
                planeState.speed * INTERNAL_SPEED_TO_KMH
            );
            const pitchDegrees = planeState.pitchAngle * RADIANS_TO_DEGREES;
            const rollDegrees = planeState.rollAngle * RADIANS_TO_DEGREES;
            const pitchOffset = clamp(pitchDegrees * 1.3, -32, 32);

            updateNeedle(speedNeedle, speedKmh, MAX_AIRSPEED_KMH);
            updateNeedle(altitudeNeedle, altitude, MAX_ALTITUDE_METERS);
            horizon.style.transform = `translateY(${pitchOffset}px) rotate(${-rollDegrees}deg)`;
        }
    };
}
