const KEY = 'open-skies-flight-recovery-v1';
const MAX_AGE = 10 * 60 * 1000;
const FIELDS = /** @type {const} */ ([
    'speed',
    'thrust',
    'yawAngle',
    'pitchAngle',
    'rollAngle',
    'lift',
    'flapDeployment',
    'verticalSpeed',
    'isAirborne',
    'isStalling',
    'propellerRotation',
    'gearDown',
    'gearExtension',
    'airbrake',
    'airbrakeExtension',
    'enginePower',
    'gForce',
    'smokeOn'
]);

/** Keep only simulation values; never persist input, WebGL or scenery objects.
 * @param {import('./physics.js').PlaneState} planeState
 * @param {string} mission
 * @param {number} now */
export function flightSnapshot(planeState, mission, now = Date.now()) {
    /** @type {Partial<import('./physics.js').PlaneState>} */
    const state = { position: { ...planeState.position } };
    Object.assign(
        state,
        Object.fromEntries(FIELDS.map((field) => [field, planeState[field]]))
    );
    if (planeState.attitude) state.attitude = { ...planeState.attitude };
    return { mission, savedAt: now, state };
}

/** @param {unknown} snapshot
 * @param {import('./physics.js').PlaneState} planeState
 * @param {Pick<import('../scenery/geography.js').Geography, 'minX'|'maxX'|'minZ'|'maxZ'|'height'>} world
 * @param {string} mission
 * @param {number} now */
export function restoreFlightSnapshot(
    snapshot,
    planeState,
    world,
    mission,
    now = Date.now()
) {
    const data =
        /** @type {{mission?:unknown,savedAt?:unknown,state?:Partial<import('./physics.js').PlaneState>}} */ (
            snapshot
        );
    if (
        !snapshot ||
        typeof snapshot !== 'object' ||
        data.mission !== mission ||
        !Number.isFinite(data.savedAt) ||
        now - Number(data.savedAt) < 0 ||
        now - Number(data.savedAt) > MAX_AGE
    )
        return false;
    const state = data.state;
    const p = state?.position;
    if (
        !p ||
        ![p.x, p.y, p.z].every(Number.isFinite) ||
        p.x < world.minX ||
        p.x > world.maxX ||
        p.z < world.minZ ||
        p.z > world.maxZ ||
        p.y < world.height(p.x, p.z) ||
        p.y > 20000
    )
        return false;
    for (const field of FIELDS) {
        if (typeof planeState[field] === 'boolean') {
            if (typeof state[field] !== 'boolean') return false;
        } else if (!Number.isFinite(state[field])) return false;
    }
    const attitude = state.attitude;
    if (
        attitude &&
        ![attitude.x, attitude.y, attitude.z, attitude.w].every(Number.isFinite)
    )
        return false;
    planeState.position = { ...p };
    Object.assign(
        planeState,
        Object.fromEntries(FIELDS.map((field) => [field, state[field]]))
    );
    if (attitude) planeState.attitude = { ...attitude };
    return true;
}

export function isIosHomeScreen() {
    const standaloneNavigator =
        /** @type {Navigator & {standalone?:boolean}} */ (navigator);
    return (
        (standaloneNavigator.standalone === true ||
            matchMedia('(display-mode: standalone)').matches) &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
    );
}

/** iOS may terminate a Home Screen web process without firing pagehide.
 * @param {import('./physics.js').PlaneState} planeState
 * @param {Pick<import('../scenery/geography.js').Geography, 'minX'|'maxX'|'minZ'|'maxZ'|'height'|'spawn'>} world
 * @param {string} mission */
export function createFlightRecovery(planeState, world, mission) {
    const enabled =
        isIosHomeScreen() &&
        !new URLSearchParams(location.search).has('visual') &&
        !new URLSearchParams(location.search).has('automation');
    if (!enabled)
        return { restore: () => false, save: () => {}, clear: () => {} };
    const clear = () => {
        try {
            localStorage.removeItem(KEY);
        } catch {
            /* Storage is optional. */
        }
    };
    return {
        restore() {
            try {
                const raw = localStorage.getItem(KEY);
                return raw
                    ? restoreFlightSnapshot(
                          JSON.parse(raw),
                          planeState,
                          world,
                          mission
                      )
                    : false;
            } catch {
                return false;
            }
        },
        save() {
            if (planeState.isCrashed) return clear();
            const distance = Math.hypot(
                planeState.position.x - world.spawn.x,
                planeState.position.z - world.spawn.z
            );
            if (!planeState.isAirborne && distance < 50) return clear();
            try {
                localStorage.setItem(
                    KEY,
                    JSON.stringify(flightSnapshot(planeState, mission))
                );
            } catch {
                /* Storage is optional. */
            }
        },
        clear
    };
}
