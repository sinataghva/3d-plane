import { groundLevel } from './geography.js';
export const GROUND_LEVEL = 0.5;
export const INTERNAL_SPEED_TO_KMH = 90;
export const INTERNAL_VERTICAL_SPEED_TO_MS = 60;
export const STALL_SPEED = 0.85;
export const FLAP_STALL_REDUCTION = 0.18;
export const PITCH_PATH_FACTOR = 0.22;

/** @param {import('./physics.js').PlaneState} state */
export function getVerticalSpeed(state) {
    return state.isAirborne && !state.isCrashed
        ? state.verticalSpeed +
              Math.sin(state.pitchAngle) * state.speed * PITCH_PATH_FACTOR
        : 0;
}

/** @param {import('./physics.js').PlaneState} state @param {number} [stallSpeed] @param {number} [flapReduction] */
export function getEffectiveStallSpeed(
    state,
    stallSpeed = STALL_SPEED,
    flapReduction = FLAP_STALL_REDUCTION
) {
    return stallSpeed - state.flapDeployment * flapReduction;
}

/** @param {import('./physics.js').PlaneState} state */
export function getAltitude(state) {
    return Math.max(
        0,
        state.position.y - groundLevel(state.position.x, state.position.z)
    );
}
