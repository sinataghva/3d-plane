import * as THREE from 'three';

// Match the existing HUD's fixed arcade speed-of-sound reference.
export { MACH_REFERENCE_SPEED as SOUND_SPEED } from './jetAerodynamics.js';
import { MACH_REFERENCE_SPEED as SOUND_SPEED } from './jetAerodynamics.js';
export const MACH_EFFECT_SECONDS = 1.4;

/** Rising-edge detector with hysteresis and a simulation-time cooldown. */
export function createMachTransition() {
    let previous = 0,
        armed = false,
        cooldown = 0,
        count = 0;
    return {
        get count() {
            return count;
        },
        reset() {
            count = 0;
            previous = 0;
            armed = false;
            cooldown = 0;
        },
        /** @param {import('./physics.js').PlaneState} state @param {number} delta */
        update(state, delta) {
            cooldown = Math.max(0, cooldown - Math.max(0, delta));
            const mach = (state.speed * 60) / SOUND_SPEED;
            if (
                state.aircraft !== 'mirage' ||
                !state.isAirborne ||
                state.isCrashed
            ) {
                previous = mach;
                armed = false;
                return false;
            }
            if (mach <= 0.96 && cooldown === 0) armed = true;
            const triggered = armed && previous < 1 && mach >= 1;
            previous = mach;
            if (triggered) {
                count++;
                armed = false;
                cooldown = 6;
            }
            return triggered;
        }
    };
}

/** A transient, stylized condensation shell; not a physical humidity model.
 * @param {THREE.Object3D} airplane */
export function createMachEffect(airplane) {
    const geometry = new THREE.ConeGeometry(4.7, 6, 40, 8, true);
    const material = new THREE.MeshBasicMaterial({
        color: 0xe6f3fa,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    material.forceSinglePass = true;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = 'varying vec2 vMachUV;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            '#include <begin_vertex>\nvMachUV = uv;'
        );
        shader.fragmentShader =
            'varying vec2 vMachUV;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float edge = smoothstep(0.0, 0.22, vMachUV.y) * (1.0 - smoothstep(0.50, 0.94, vMachUV.y));
            float wisps = 0.87 + 0.08 * sin(vMachUV.x * 94.248 + vMachUV.y * 17.0) + 0.05 * sin(vMachUV.x * 157.08 - vMachUV.y * 29.0);
            diffuseColor.a *= edge * wisps;`
        );
    };
    material.customProgramCacheKey = () => 'mach-condensation-v1';
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Mach transition vapor';
    mesh.rotation.z = -Math.PI / 2;
    mesh.position.set(-1, 0.85, 0);
    mesh.renderOrder = 1;
    mesh.visible = false;
    airplane.add(mesh);
    let age = MACH_EFFECT_SECONDS;
    return {
        mesh,
        trigger() {
            age = 0;
        },
        reset() {
            age = MACH_EFFECT_SECONDS;
            mesh.visible = false;
            material.opacity = 0;
        },
        /** @param {number} delta */
        advance(delta) {
            age = Math.min(MACH_EFFECT_SECONDS, age + Math.max(0, delta));
        },
        /** @param {boolean} cockpit @param {boolean} crashed */
        render(cockpit = false, crashed = false) {
            const t = age / MACH_EFFECT_SECONDS;
            const envelope = Math.min(1, t / 0.12) * Math.pow(1 - t, 1.4);
            material.opacity = 0.38 * envelope;
            mesh.scale.setScalar(0.9 + 0.17 * t);
            mesh.visible =
                !cockpit &&
                !crashed &&
                age < MACH_EFFECT_SECONDS &&
                material.opacity > 0.001;
        },
        dispose() {
            airplane.remove(mesh);
            geometry.dispose();
            material.dispose();
        }
    };
}
