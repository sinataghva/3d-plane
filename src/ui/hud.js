import { isJet } from '../aircraft/capabilities.js';
import {
    getAltitude,
    INTERNAL_SPEED_TO_KMH,
    INTERNAL_VERTICAL_SPEED_TO_MS,
    getVerticalSpeed,
    getEffectiveStallSpeed
} from '../flight/flightMetrics.js';
/**
 * @typedef {import('../flight/physics.js').PlaneState} PlaneState
 * @typedef {import('../rendering/camera.js').CameraMode} CameraMode
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
export function formatHeading(yawAngle) {
    const heading =
        ((Math.round(90 - yawAngle * RADIANS_TO_DEGREES) % 360) + 360) % 360;
    return heading.toString().padStart(3, '0');
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
    const effectiveStallSpeed = getEffectiveStallSpeed(planeState);

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

    if (getVerticalSpeed(planeState) > 0.08) {
        return {
            flightLabel: 'Airborne',
            energyLabel: 'Climb',
            level: 'info'
        };
    }

    if (getVerticalSpeed(planeState) < -0.08) {
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

/** @param {HTMLElement} element @param {string} value */
function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
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
            const altitude = getAltitude(planeState);
            const flightCondition = getFlightCondition(planeState);
            const cameraLabel = formatCameraMode(cameraMode.getMode());
            const thrustPercent = Math.round(planeState.thrust * 100);

            setText(
                speedValueElement,
                formatSpeedKmh(
                    planeState.speed * (isJet(planeState.aircraft) ? 2.4 : 1)
                )
            );
            setText(altitudeValueElement, formatAltitudeMeters(altitude));
            setText(thrustValueElement, thrustPercent.toString());
            const width = `${Math.min(100, thrustPercent)}%`;
            if (thrustBarElement.style.width !== width)
                thrustBarElement.style.width = width;
            setText(headingValueElement, formatHeading(planeState.yawAngle));
            setText(
                pitchValueElement,
                `${toSignedDegrees(planeState.pitchAngle)}°`
            );
            setText(
                rollValueElement,
                `${toSignedDegrees(planeState.rollAngle)}°`
            );
            setText(
                verticalSpeedValueElement,
                `${formatVerticalSpeedMs(getVerticalSpeed(planeState))} m/s`
            );
            setText(energyStateValueElement, flightCondition.energyLabel);
            setText(flightStateValueElement, flightCondition.flightLabel);
            if (flightStateValueElement.dataset.state !== flightCondition.level)
                flightStateValueElement.dataset.state = flightCondition.level;
            setText(cameraModeValueElement, cameraLabel);
        }
    };
}
