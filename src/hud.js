/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 * @typedef {import('./camera.js').CameraMode} CameraMode
 */

const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * @param {number} angle
 * @returns {number}
 */
function toSignedDegrees(angle) {
    return Math.round(angle * RADIANS_TO_DEGREES);
}

/**
 * @param {number} yawAngle
 * @returns {string}
 */
function formatHeading(yawAngle) {
    const heading = (90 - yawAngle * RADIANS_TO_DEGREES + 360) % 360;
    return Math.round(heading).toString().padStart(3, '0');
}

/**
 * @param {string} mode
 * @returns {string}
 */
function formatCameraMode(mode) {
    return mode.charAt(0).toUpperCase() + mode.slice(1);
}

export function createHud() {
    const speedValueElement = document.getElementById('speed-value');
    const altitudeValueElement = document.getElementById('altitude-value');
    const thrustValueElement = document.getElementById('thrust-value');
    const headingValueElement = document.getElementById('heading-value');
    const pitchValueElement = document.getElementById('pitch-value');
    const rollValueElement = document.getElementById('roll-value');
    const flightStateValueElement =
        document.getElementById('flight-state-value');
    const cameraModeValueElement = document.getElementById('camera-mode-value');

    if (
        !speedValueElement ||
        !altitudeValueElement ||
        !thrustValueElement ||
        !headingValueElement ||
        !pitchValueElement ||
        !rollValueElement ||
        !flightStateValueElement ||
        !cameraModeValueElement
    ) {
        throw new Error('Missing flight data HUD elements');
    }

    return {
        /**
         * @param {{ planeState: PlaneState, cameraMode: CameraMode }} args
         */
        update({ planeState, cameraMode }) {
            const altitude = Math.max(0, planeState.position.y - 0.5);
            const flightState = planeState.isAirborne ? 'Airborne' : 'Ground';
            const cameraLabel = formatCameraMode(cameraMode.getMode());

            speedValueElement.textContent = planeState.speed.toFixed(2);
            altitudeValueElement.textContent = altitude.toFixed(2);
            thrustValueElement.textContent = Math.round(
                planeState.thrust * 100
            ).toString();
            headingValueElement.textContent = formatHeading(
                planeState.yawAngle
            );
            pitchValueElement.textContent = `${toSignedDegrees(
                planeState.pitchAngle
            )}°`;
            rollValueElement.textContent = `${toSignedDegrees(
                planeState.rollAngle
            )}°`;
            flightStateValueElement.textContent = flightState;
            cameraModeValueElement.textContent = cameraLabel;
        }
    };
}
