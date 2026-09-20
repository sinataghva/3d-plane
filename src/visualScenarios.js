import { getGeography } from './geography.js';
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
    exhaust: {
        name: 'exhaust',
        cameraMode: 'chase',
        plane: {
            position: { x: 0, y: 8, z: -112 },
            yawAngle: -Math.PI / 2,
            pitchAngle: 0,
            rollAngle: 0,
            afterburner: false,
            gearDown: false,
            gearExtension: 0,
            isAirborne: true
        }
    },
    exhaustBoost: {
        name: 'exhaust',
        cameraMode: 'chase',
        plane: {
            position: { x: 0, y: 8, z: -112 },
            yawAngle: -Math.PI / 2,
            pitchAngle: 0,
            rollAngle: 0,
            thrust: 1.1,
            afterburner: true,
            gearDown: false,
            gearExtension: 0,
            isAirborne: true
        }
    },
    afterburner: {
        name: 'afterburner',
        cameraMode: 'chase',
        plane: {
            position: { x: 0, y: 8, z: -112 },
            yawAngle: -Math.PI / 2,
            pitchAngle: 0,
            rollAngle: 0,
            thrust: 1.1,
            afterburner: true,
            gearDown: false,
            gearExtension: 0,
            isAirborne: true
        }
    },
    card: {
        name: 'card',
        cameraMode: 'orbit',
        plane: {
            isAirborne: true,
            gearDown: false,
            gearExtension: 0,
            thrust: 1,
            pitchAngle: 0.04,
            rollAngle: -0.15,
            speed: 2
        }
    },
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

    if (
        ['rail-detail', 'water-detail', 'river-detail'].includes(
            scenarioName || ''
        )
    )
        return {
            name: scenarioName || '',
            cameraMode: 'chase',
            plane: { isAirborne: true }
        };
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

    const world = getGeography();
    if (world) {
        const dx = planeState.position.x,
            dz = planeState.position.z + 120;
        const fx = Math.cos(world.spawn.yaw),
            fz = -Math.sin(world.spawn.yaw);
        planeState.position.x = world.spawn.x + dx * fz + dz * fx;
        planeState.position.z = world.spawn.z - dx * fx + dz * fz;
        planeState.position.y += world.height(
            planeState.position.x,
            planeState.position.z
        );
        planeState.yawAngle += world.spawn.yaw + Math.PI / 2;
    }
    if (world && visualScenario.name === 'card') {
        const palace = world.data.features.find((f) => f.palace);
        const p =
            planeState.aircraft === 'mirage'
                ? [900, -1250]
                : palace?.points[0] || [world.spawn.x, world.spawn.z];
        planeState.position = {
            x: p[0] - 80,
            y: world.height(p[0], p[1]) + 110,
            z: p[1] + 100
        };
        planeState.yawAngle = 0.4;
    }
    if (world && visualScenario.name.endsWith('-detail')) {
        const kind =
            visualScenario.name === 'rail-detail'
                ? 'rail'
                : visualScenario.name === 'river-detail'
                  ? 'waterway'
                  : 'water';
        const feature = world.data.features
            .filter(
                (f) =>
                    f.kind === kind &&
                    !f.tunnel &&
                    !f.covered &&
                    f.points.length > 3
            )
            .sort((a, b) => {
                const score = (
                    /** @type {import('./geography.js').GeoFeature} */ f
                ) =>
                    kind === 'water'
                        ? f.name === 'Grand Canal' ||
                          f.name === 'Lac des Sept Chevaux'
                            ? 0
                            : 1e8
                        : kind === 'waterway'
                          ? f.name === 'La Lanterne' || f.name === 'Ru de Gally'
                              ? 0
                              : 1e8
                          : 0;
                return (
                    score(a) -
                    score(b) +
                    Math.hypot(
                        a.points[0][0] - world.spawn.x,
                        a.points[0][1] - world.spawn.z
                    ) -
                    Math.hypot(
                        b.points[0][0] - world.spawn.x,
                        b.points[0][1] - world.spawn.z
                    )
                );
            })[0];
        if (feature) {
            const p = feature.points[Math.floor(feature.points.length / 2)];
            planeState.position = {
                x: p[0],
                y: world.height(p[0], p[1]) + 8,
                z: p[1]
            };
            planeState.yawAngle = 0;
        }
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
