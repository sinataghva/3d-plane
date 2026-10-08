import * as THREE from 'three';
/** Hold the handoff velocity, preserving the parked/airborne distinction.
 * @param {import('./physics.js').PlaneState} state
 * @param {{height:(x:number,z:number)=>number, obstacle:(x:number,z:number,y:number)=>string|null}} world */
export function createUnattendedFlight(state, world) {
    const q = state.attitude
        ? new THREE.Quaternion().copy(state.attitude)
        : new THREE.Quaternion().setFromEuler(
              new THREE.Euler(
                  state.rollAngle,
                  state.yawAngle,
                  state.pitchAngle,
                  'YZX'
              )
          );
    const velocity = new THREE.Vector3(state.speed * 60, 0, 0).applyQuaternion(
        q
    );
    velocity.y = state.isAirborne ? state.verticalSpeed * 60 : 0;
    return {
        /** @param {number} dt */
        update(dt) {
            if (state.isCrashed || velocity.lengthSq() < 0.0001) return;
            const steps = Math.max(1, Math.ceil(velocity.length() * dt));
            for (let i = 0; i < steps; i++) {
                state.position.x += (velocity.x * dt) / steps;
                state.position.y += (velocity.y * dt) / steps;
                state.position.z += (velocity.z * dt) / steps;
                const p = state.position;
                const ground = world.height(p.x, p.z) + 0.5;
                const obstacle = world.obstacle(p.x, p.z, p.y);
                if (obstacle || (state.isAirborne && p.y < ground)) {
                    state.isCrashed = true;
                    state.crashReason = obstacle || 'terrain';
                    state.speed = 0;
                    state.thrust = 0;
                    state.isAirborne = false;
                    state.verticalSpeed = 0;
                    state.afterburner = false;
                    break;
                }
                if (!state.isAirborne) p.y = ground;
            }
        }
    };
}
