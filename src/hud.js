/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 * @typedef {import('./camera.js').CameraMode} CameraMode
 */

const RADIANS_TO_DEGREES = 180 / Math.PI;
const INTERNAL_SPEED_TO_KMH = 90;
const INTERNAL_VERTICAL_SPEED_TO_MS = 60;

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

/**
 * @param {number} speed
 * @returns {string}
 */
export function formatSpeedKmh(speed) {
    return Math.max(0, Math.round(speed * INTERNAL_SPEED_TO_KMH)).toString();
}

/**
 * @param {number} altitude
 * @returns {string}
 */
export function formatAltitudeMeters(altitude) {
    return Math.max(0, Math.round(altitude)).toString();
}

/**
 * @param {number} verticalSpeed
 * @returns {string}
 */
export function formatVerticalSpeedMs(verticalSpeed) {
    const metersPerSecond = Math.round(
        verticalSpeed * INTERNAL_VERTICAL_SPEED_TO_MS
    );

    if (metersPerSecond > 0) {
        return `+${metersPerSecond}`;
    }

    return metersPerSecond.toString();
}

/**
 * @param {PlaneState} planeState
 * @returns {{ flightLabel: string, energyLabel: string, level: string }}
 */
export function getFlightCondition(planeState) {
    const effectiveStallSpeed = 0.85 - planeState.flapDeployment * 0.16;

    if (planeState.isCrashed) {
        return {
            flightLabel: 'Impact',
            energyLabel: 'Impact',
            level: 'danger'
        };
    }

    if (planeState.isStalling) {
        return {
            flightLabel: 'Stall',
            energyLabel: 'Stall',
            level: 'danger'
        };
    }

    if (!planeState.isAirborne) {
        return {
            flightLabel: 'Ground',
            energyLabel: planeState.thrust > 0.65 ? 'Takeoff roll' : 'Idle',
            level: 'neutral'
        };
    }

    const stallMargin = planeState.speed / effectiveStallSpeed;
    if (stallMargin < 1.18) {
        return {
            flightLabel: 'Airborne',
            energyLabel: 'Low energy',
            level: 'caution'
        };
    }

    if (planeState.verticalSpeed > 0.08) {
        return {
            flightLabel: 'Airborne',
            energyLabel: 'Climb',
            level: 'info'
        };
    }

    if (planeState.verticalSpeed < -0.08) {
        return {
            flightLabel: 'Airborne',
            energyLabel: 'Descent',
            level: 'info'
        };
    }

    return {
        flightLabel: 'Airborne',
        energyLabel: 'Cruise',
        level: 'info'
    };
}

export function createHud() {
    const speedValueElement = document.getElementById('speed-value');
    const altitudeValueElement = document.getElementById('altitude-value');
    const thrustValueElement = document.getElementById('thrust-value');
    const thrustBarElement = document.getElementById('thrust-bar');
    const headingValueElement = document.getElementById('heading-value');
    const pitchValueElement = document.getElementById('pitch-value');
    const rollValueElement = document.getElementById('roll-value');
    const verticalSpeedValueElement = document.getElementById(
        'vertical-speed-value'
    );
    const energyStateValueElement =
        document.getElementById('energy-state-value');
    const flightStateValueElement =
        document.getElementById('flight-state-value');
    const cameraModeValueElement = document.getElementById('camera-mode-value');

    if (
        !speedValueElement ||
        !altitudeValueElement ||
        !thrustValueElement ||
        !thrustBarElement ||
        !headingValueElement ||
        !pitchValueElement ||
        !rollValueElement ||
        !verticalSpeedValueElement ||
        !energyStateValueElement ||
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
            const flightCondition = getFlightCondition(planeState);
            const cameraLabel = formatCameraMode(cameraMode.getMode());
            const thrustPercent = Math.round(planeState.thrust * 100);

            speedValueElement.textContent = formatSpeedKmh(planeState.speed);
            altitudeValueElement.textContent = formatAltitudeMeters(altitude);
            thrustValueElement.textContent = thrustPercent.toString();
            thrustBarElement.style.width = `${thrustPercent}%`;
            headingValueElement.textContent = formatHeading(
                planeState.yawAngle
            );
            pitchValueElement.textContent = `${toSignedDegrees(
                planeState.pitchAngle
            )}°`;
            rollValueElement.textContent = `${toSignedDegrees(
                planeState.rollAngle
            )}°`;
            verticalSpeedValueElement.textContent = `${formatVerticalSpeedMs(
                planeState.verticalSpeed
            )} m/s`;
            energyStateValueElement.textContent = flightCondition.energyLabel;
            flightStateValueElement.textContent = flightCondition.flightLabel;
            flightStateValueElement.dataset.state = flightCondition.level;
            cameraModeValueElement.textContent = cameraLabel;
        }
    };
}
