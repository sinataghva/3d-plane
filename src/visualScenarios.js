/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 * @typedef {import('./camera.js').CameraMode} CameraMode
 */

/**
 * @typedef {object} VisualScenario
 * @property {string} name
 * @property {string} cameraMode
 * @property {Partial<PlaneState> & { position?: Partial<PlaneState['position']> }} plane
 * @property {{ x: number, y: number, z: number }} [cameraPosition]
 * @property {boolean} [showCrash]
 */

/** @type {Record<string, VisualScenario>} */
const VISUAL_SCENARIOS = {
    chase: {
        name: 'chase',
        cameraMode: 'chase',
        plane: {
            position: { x: 0, y: 0.5, z: -112 },
            speed: 0,
            thrust: 0,
            yawAngle: -Math.PI / 2,
            pitchAngle: 0,
            rollAngle: 0,
            flapDeployment: 1,
            isAirborne: false
        }
    },
    cockpit: {
        name: 'cockpit',
        cameraMode: 'cockpit',
        plane: {
            position: { x: 52, y: 74, z: -42 },
            speed: 1.8,
            thrust: 1,
            yawAngle: Math.PI,
            pitchAngle: 0.06,
            rollAngle: 0.12,
            flapDeployment: 0,
            verticalSpeed: 0.04,
            isAirborne: true
        }
    },
    orbit: {
        name: 'orbit',
        cameraMode: 'orbit',
        cameraPosition: { x: -18, y: 8, z: -110 },
        plane: {
            position: { x: 0, y: 0.5, z: -112 },
            speed: 0,
            thrust: 0,
            yawAngle: -Math.PI / 2,
            pitchAngle: 0,
            rollAngle: 0,
            flapDeployment: 1,
            isAirborne: false
        }
    },
    warning: {
        name: 'warning',
        cameraMode: 'chase',
        plane: {
            position: { x: 10, y: 10, z: -40 },
            speed: 0.92,
            thrust: 0.35,
            yawAngle: -Math.PI / 2,
            pitchAngle: -0.04,
            rollAngle: 0,
            flapDeployment: 0.6,
            verticalSpeed: -0.12,
            isAirborne: true
        }
    },
    crash: {
        name: 'crash',
        cameraMode: 'chase',
        showCrash: true,
        plane: {
            position: { x: 0, y: 0.5, z: -70 },
            speed: 0,
            thrust: 0,
            yawAngle: -Math.PI / 2,
            pitchAngle: -0.48,
            rollAngle: 0.34,
            flapDeployment: 0,
            verticalSpeed: 0,
            isAirborne: false,
            isCrashed: true,
            crashImpact: 0.5
        }
    }
};

/**
 * @returns {VisualScenario | null}
 */
export function getVisualScenario() {
    const params = new URLSearchParams(window.location.search);
    const scenarioName = params.get('visual');

    if (!scenarioName) {
        return null;
    }

    return VISUAL_SCENARIOS[scenarioName] || VISUAL_SCENARIOS.chase;
}

/**
 * @param {object} args
 * @param {PlaneState} args.planeState
 * @param {CameraMode} args.cameraMode
 * @param {VisualScenario} args.visualScenario
 */
export function applyVisualScenario({
    planeState,
    cameraMode,
    visualScenario
}) {
    const { position, ...planeValues } = visualScenario.plane;
    Object.assign(planeState, planeValues);

    if (position) {
        Object.assign(planeState.position, position);
    }

    cameraMode.setMode(visualScenario.cameraMode);
}

/**
 * @param {number} seed
 * @returns {() => void}
 */
export function useSeededRandom(seed) {
    const originalRandom = Math.random;
    let state = seed >>> 0;

    Math.random = () => {
        state = (state * 1664525 + 1013904223) >>> 0;
        return state / 0x100000000;
    };

    return () => {
        Math.random = originalRandom;
    };
}
