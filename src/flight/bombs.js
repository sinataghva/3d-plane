import * as THREE from 'three';

// Deliberately arcade constants, not a real-world weapon performance model.
export const BOMB_CONFIG = Object.freeze({
    minimumReleaseHeight: 10,
    reloadSeconds: 30,
    gravity: 9.81,
    drag: 0.08,
    upwardVelocityInheritance: 0.25,
    step: 1 / 60,
    lifetime: 120,
    maxActive: 30
});
export const BOMB_MOUNTS = [
    [-2.4, 0.05, -2],
    [-2.4, 0.05, 2],
    [-2.4, 0.05, -2.6],
    [-2.4, 0.05, 2.6],
    [-2.4, 0.05, -3.2],
    [-2.4, 0.05, 3.2]
];
/** @typedef {{position:THREE.Vector3,velocity:THREE.Vector3,age:number}} Bomb */
/** @param {import('./physics.js').PlaneState} state @param {number} mount */
export function bombLaunch(state, mount) {
    const q = state.attitude
        ? new THREE.Quaternion(
              state.attitude.x,
              state.attitude.y,
              state.attitude.z,
              state.attitude.w
          )
        : new THREE.Quaternion().setFromEuler(
              new THREE.Euler(
                  state.rollAngle,
                  state.yawAngle,
                  state.pitchAngle,
                  'YZX'
              )
          );
    const position = new THREE.Vector3(...BOMB_MOUNTS[mount])
        .applyQuaternion(q)
        .add(
            new THREE.Vector3(
                state.position.x,
                state.position.y,
                state.position.z
            )
        );
    const velocity = new THREE.Vector3(1, 0, 0)
        .applyQuaternion(q)
        .multiplyScalar(state.speed * 60);
    velocity.y = state.verticalSpeed * 60;
    // Arcade tuning: retain downward motion, but suppress the climbing lob.
    if (velocity.y > 0) velocity.y *= BOMB_CONFIG.upwardVelocityInheritance;
    return { position, velocity, age: 0 };
}
/** Shared fixed-step integrator used by live bombs and previews.
 * @param {Bomb} bomb @param {number} dt */
export function advanceBomb(bomb, dt = BOMB_CONFIG.step) {
    const decay = Math.exp(-BOMB_CONFIG.drag * dt);
    const distance = (1 - decay) / BOMB_CONFIG.drag;
    bomb.position.addScaledVector(bomb.velocity, distance);
    bomb.position.y -=
        (BOMB_CONFIG.gravity / BOMB_CONFIG.drag) * (dt - distance);
    bomb.velocity.multiplyScalar(decay);
    bomb.velocity.y -= BOMB_CONFIG.gravity * distance;
    bomb.age += dt;
}
/** @param {(a:THREE.Vector3,b:THREE.Vector3)=>({position:THREE.Vector3,kind:string}|null)} sweep
 * @param {(p:THREE.Vector3)=>boolean} inside
 * @param {Partial<typeof BOMB_CONFIG>} [options] */
export function createBombSimulation(sweep, inside, options = {}) {
    const config = { ...BOMB_CONFIG, ...options };
    /** @type {Bomb[]} */ const active = [];
    const previous = new THREE.Vector3();
    let remaining = 6,
        reload = 0,
        held = false;
    return {
        active,
        get remaining() {
            return remaining;
        },
        get reload() {
            return reload;
        },
        reset() {
            active.length = 0;
            remaining = 6;
            reload = 0;
            held = false;
        },
        clearInput() {
            held = false;
        },
        /** @param {import('./physics.js').PlaneState} state @param {boolean} pressed @param {number} agl @param {number} dt @param {boolean} [pulse] */
        step(state, pressed, agl, dt = BOMB_CONFIG.step, pulse = false) {
            /** @type {{position:THREE.Vector3,kind:string}[]} */ const impacts =
                [];
            if (dt <= 0) return impacts;
            if (state.isCrashed) {
                active.length = 0;
                remaining = 0;
                reload = 0;
                held = pressed;
                return impacts;
            }
            if (reload > 0) {
                reload = Math.max(0, reload - dt);
                if (reload < 1e-8) {
                    reload = 0;
                    remaining = 6;
                }
            }
            const release = pulse || (pressed && !held);
            held = pressed;
            if (
                release &&
                remaining > 0 &&
                agl >= config.minimumReleaseHeight &&
                active.length < config.maxActive
            ) {
                active.push(bombLaunch(state, 6 - remaining));
                remaining--;
                if (!remaining) reload = config.reloadSeconds;
            }
            for (let i = active.length - 1; i >= 0; i--) {
                const bomb = active[i];
                previous.copy(bomb.position);
                advanceBomb(bomb, dt);
                const hit = sweep(previous, bomb.position);
                if (hit) impacts.push(hit);
                if (
                    hit ||
                    bomb.age >= config.lifetime ||
                    !inside(bomb.position)
                )
                    active.splice(i, 1);
            }
            return impacts;
        }
    };
}
