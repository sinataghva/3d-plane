import * as THREE from 'three';

export const SMOKE_LIFETIME = 8;
export const SMOKE_SOLID_TIME = 2;
const EMISSION_INTERVAL = 1 / 60;
const MAX_PUFFS = 512;
const EMITTER_OFFSET = new THREE.Vector3(-3.2, 0.15, 0);

/** @param {THREE.Scene} scene */
export function createBlueSmoke(scene) {
    const positions = new Float32Array(MAX_PUFFS * 3);
    const colors = new Float32Array(MAX_PUFFS * 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geometry.setDrawRange(0, MAX_PUFFS);

    const textureData = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++) {
        for (let x = 0; x < 32; x++) {
            const radius = Math.hypot(x - 15.5, y - 15.5) / 15.5;
            const offset = (y * 32 + x) * 4;
            textureData[offset] =
                textureData[offset + 1] =
                textureData[offset + 2] =
                    255;
            textureData[offset + 3] = Math.round(
                255 * Math.max(0, 1 - radius * radius) ** 2
            );
        }
    }
    const texture = new THREE.DataTexture(
        textureData,
        32,
        32,
        THREE.RGBAFormat
    );
    texture.needsUpdate = true;
    const material = new THREE.PointsMaterial({
        color: 0xffffff,
        map: texture,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        size: 3.5,
        sizeAttenuation: true
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);

    /** @type {{position: THREE.Vector3, age: number}[]} */
    const puffs = [];
    const quaternion = new THREE.Quaternion();
    const emitter = new THREE.Vector3();
    let emissionTime = 0;

    return {
        puffs,
        /** @param {import('../flight/physics.js').PlaneState} planeState @param {number} delta */
        update(planeState, delta) {
            if (delta <= 0) return;
            for (let i = puffs.length - 1; i >= 0; i--) {
                puffs[i].age += delta;
                if (puffs[i].age >= SMOKE_LIFETIME) puffs.splice(i, 1);
            }
            if (planeState.smokeOn && !planeState.isCrashed) {
                if (planeState.attitude) {
                    const q = planeState.attitude;
                    quaternion.set(q.x, q.y, q.z, q.w);
                } else {
                    quaternion.setFromEuler(
                        new THREE.Euler(
                            planeState.rollAngle,
                            planeState.yawAngle,
                            planeState.pitchAngle,
                            'YZX'
                        )
                    );
                }
                emitter
                    .copy(EMITTER_OFFSET)
                    .applyQuaternion(quaternion)
                    .add(
                        new THREE.Vector3(
                            planeState.position.x,
                            planeState.position.y,
                            planeState.position.z
                        )
                    );
                emissionTime += delta;
                while (emissionTime >= EMISSION_INTERVAL) {
                    emissionTime -= EMISSION_INTERVAL;
                    if (puffs.length >= MAX_PUFFS) puffs.shift();
                    puffs.push({ position: emitter.clone(), age: 0 });
                }
            } else {
                emissionTime = 0;
            }
            for (let i = 0; i < MAX_PUFFS; i++) {
                const puff = puffs[i];
                const p = i * 3;
                const c = i * 4;
                if (puff) {
                    positions[p] = puff.position.x;
                    positions[p + 1] = puff.position.y + puff.age * 0.35;
                    positions[p + 2] = puff.position.z;
                    const fade = Math.min(
                        1,
                        (SMOKE_LIFETIME - puff.age) /
                            (SMOKE_LIFETIME - SMOKE_SOLID_TIME)
                    );
                    colors[c] = 0.025;
                    colors[c + 1] = 0.16;
                    colors[c + 2] = 0.9;
                    colors[c + 3] = fade * 0.85;
                } else {
                    colors[c + 3] = 0;
                }
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.color.needsUpdate = true;
        },
        reset() {
            puffs.length = 0;
            emissionTime = 0;
            colors.fill(0);
            geometry.attributes.color.needsUpdate = true;
        },
        dispose() {
            this.reset();
            scene.remove(points);
            geometry.dispose();
            material.dispose();
            texture.dispose();
        }
    };
}
