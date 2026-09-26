import * as THREE from 'three';
import {
    BOMB_CONFIG,
    BOMB_MOUNTS,
    bombLaunch,
    advanceBomb,
    createBombSimulation
} from '../flight/bombs.js';
import { createBombSurfaces } from '../scenery/bombSurfaces.js';
import { createBombMarker } from './bombMarker.js';
import { createBombGeometry } from '../aircraft/bombModel.js';

/** @param {THREE.Scene} scene @param {THREE.Group} airplane
 * @param {import('../scenery/geography.js').Geography} world
 * @param {(kind:string,distance:number)=>void} sound */
export function createBombing(scene, airplane, world, sound) {
    const surfaces = createBombSurfaces(world);
    const sim = createBombSimulation(surfaces.sweep, surfaces.inside);
    const group = new THREE.Group();
    group.name = 'Bombs and impact effects';
    scene.add(group);
    const geometry = createBombGeometry(),
        material = new THREE.MeshStandardMaterial({
            color: 0x81834e,
            emissive: 0x151707,
            roughness: 0.8
        });
    const stores = BOMB_MOUNTS.map((p) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(.../** @type {[number,number,number]} */ (p));
        airplane.add(mesh);
        return mesh;
    });
    const pylonGeometry = new THREE.BoxGeometry(0.6, 0.4, 0.1);
    const pylons = BOMB_MOUNTS.map((p) => {
        const mesh = new THREE.Mesh(pylonGeometry, material);
        mesh.position.set(p[0], 0.4, p[2]);
        airplane.add(mesh);
        return mesh;
    });
    const falling = Array.from({ length: BOMB_CONFIG.maxActive }, () => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        group.add(mesh);
        return mesh;
    });
    const marker = createBombMarker(scene, surfaces);
    const effectLifetime = 2.4;
    const sphere = new THREE.SphereGeometry(1, 10, 6),
        wave = new THREE.RingGeometry(0.8, 1, 24);
    wave.rotateX(-Math.PI / 2);
    const effects = Array.from({ length: 16 }, () => {
        const cloud = new THREE.Mesh(
            sphere,
            new THREE.MeshBasicMaterial({
                color: 0xffa637,
                transparent: true,
                depthWrite: false
            })
        );
        const ripple = new THREE.Mesh(
            wave,
            new THREE.MeshBasicMaterial({
                color: 0xffd17a,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        cloud.visible = ripple.visible = false;
        group.add(cloud, ripple);
        return { cloud, ripple, age: 3, water: false };
    });
    const hud = document.createElement('div');
    hud.id = 'bomb-readout';
    hud.className = 'bomb-readout';
    hud.setAttribute('aria-label', 'Bomb loadout');
    document.getElementById('flight-data')?.append(hud);
    if (!hud.isConnected) document.querySelector('#jet-readout')?.after(hud);
    const forward = new THREE.Vector3(1, 0, 0),
        direction = new THREE.Vector3(),
        previous = new THREE.Vector3();
    /** @type {ReturnType<typeof bombLaunch>|null} */ let preview = null;
    /** @type {{position:THREE.Vector3,kind:string}|null} */ let prediction =
        null;
    let elapsed = 0,
        nextPreview = 0,
        previewAge = 0,
        workMs = 0,
        peakWorkMs = 0;
    const abort = new AbortController();
    window.addEventListener('flight-input-clear', () => sim.clearInput(), {
        signal: abort.signal
    });
    /** @param {import('../flight/physics.js').PlaneState} state */
    function publish(state) {
        state.bombs = {
            remaining: sim.remaining,
            reloadSeconds: sim.reload,
            active: sim.active.length,
            prediction: prediction
                ? { ...prediction.position, kind: prediction.kind }
                : null
        };
        const readout =
            sim.reload > 0
                ? `Bombs 0/6 · Reloading ${Math.ceil(sim.reload)} s`
                : `Bombs ${sim.remaining}/6${state.position.y - surfaces.height(state.position.x, state.position.z) < BOMB_CONFIG.minimumReleaseHeight ? ' · Below release height' : ''}`;
        if (hud.textContent !== readout) hud.textContent = readout;
        stores.forEach(
            (mesh, i) =>
                (mesh.visible = !state.isCrashed && i >= 6 - sim.remaining)
        );
    }
    /** @param {import('../flight/physics.js').PlaneState} [state] */
    function clear(state) {
        sim.reset();
        preview = null;
        prediction = null;
        nextPreview = elapsed = 0;
        marker.hide();
        for (const mesh of falling) mesh.visible = false;
        for (const e of effects) {
            e.age = 3;
            e.cloud.visible = e.ripple.visible = false;
        }
        stores.forEach((mesh) => (mesh.visible = true));
        if (state) publish(state);
    }
    return {
        sim,
        reset: clear,
        /** @param {import('../flight/physics.js').PlaneState} state @param {boolean} pressed @param {number} dt @param {boolean} [pulse] */
        step(state, pressed, dt, pulse = false) {
            elapsed += dt;
            for (const hit of sim.step(
                state,
                pressed,
                state.position.y -
                    surfaces.height(state.position.x, state.position.z),
                dt,
                pulse
            )) {
                const e =
                    effects.find((e) => e.age >= effectLifetime) ||
                    effects.reduce((a, b) => (a.age > b.age ? a : b));
                e.age = 0;
                e.water = hit.kind === 'water';
                e.cloud.position.copy(hit.position);
                e.cloud.position.y += e.water ? 2 : 4;
                e.ripple.position.copy(hit.position);
                e.ripple.position.y += 0.15;
                e.cloud.material.color.setHex(e.water ? 0xc1e7ef : 0xff6d19);
                e.ripple.material.color.setHex(e.water ? 0xaadce8 : 0xffcc72);
                sound(
                    hit.kind,
                    hit.position.distanceTo(
                        new THREE.Vector3(
                            state.position.x,
                            state.position.y,
                            state.position.z
                        )
                    )
                );
            }
            for (const e of effects) e.age += dt;
            if (state.isCrashed) {
                prediction = preview = null;
                for (const e of effects) e.age = 3;
            }
            publish(state);
        },
        /** Prediction work is bounded per rendered frame; no whole-flight blocking loop.
         * @param {import('../flight/physics.js').PlaneState} state @param {boolean} [cockpit] */
        render(state, cockpit = false) {
            stores.forEach(
                (mesh, i) =>
                    (mesh.visible =
                        !cockpit && !state.isCrashed && i >= 6 - sim.remaining)
            );
            falling.forEach((mesh, i) => {
                const bomb = sim.active[i];
                mesh.visible = Boolean(bomb);
                if (bomb) {
                    mesh.position.copy(bomb.position);
                    direction.copy(bomb.velocity).normalize();
                    mesh.quaternion.setFromUnitVectors(forward, direction);
                }
            });
            for (const e of effects) {
                const t = e.age / effectLifetime,
                    visible = t < 1 && !state.isCrashed;
                e.cloud.visible = e.ripple.visible = visible;
                if (!visible) continue;
                e.cloud.scale.set(
                    4 + t * 10,
                    e.water ? 3 + t * 14 : 4 + t * 8,
                    4 + t * 10
                );
                e.cloud.material.opacity = (1 - t) * 0.95;
                e.ripple.scale.setScalar(4 + t * 22);
                e.ripple.material.opacity = (1 - t) * 0.65;
            }
            if (state.isCrashed) {
                marker.hide();
                publish(state);
                return;
            }
            if (!preview && elapsed >= nextPreview) {
                preview = bombLaunch(
                    state,
                    sim.remaining ? 6 - sim.remaining : 0
                );
                previewAge = elapsed;
                nextPreview = elapsed + 0.1;
            }
            const start = performance.now();
            let steps = 0;
            while (preview && steps++ < 180 && performance.now() - start < 2) {
                previous.copy(preview.position);
                advanceBomb(preview);
                const hit = surfaces.sweep(previous, preview.position);
                if (
                    hit ||
                    preview.age >= BOMB_CONFIG.lifetime ||
                    !surfaces.inside(preview.position)
                ) {
                    prediction = hit;
                    preview = null;
                    break;
                }
            }
            workMs = performance.now() - start;
            peakWorkMs = Math.max(peakWorkMs, workMs);
            publish(state);
            // publish() updates store visibility for simulation; respect cockpit hiding again.
            if (cockpit) stores.forEach((mesh) => (mesh.visible = false));
        },
        /** @param {import('three').Camera} camera @param {import('../flight/physics.js').PlaneState} state */
        projectMarker(camera, state) {
            const belowReleaseHeight =
                state.position.y -
                    surfaces.height(state.position.x, state.position.z) <
                BOMB_CONFIG.minimumReleaseHeight;
            marker.update(
                !state.isCrashed &&
                    !belowReleaseHeight &&
                    elapsed - previewAge < 2
                    ? (prediction?.position ?? null)
                    : null,
                camera,
                sim.reload > 0,
                state.position.y -
                    surfaces.height(state.position.x, state.position.z) <
                    BOMB_CONFIG.minimumReleaseHeight,
                prediction?.kind ?? 'ground',
                state.yawAngle
            );
        },
        stats() {
            return {
                ...marker.stats(),
                bombsActive: sim.active.length,
                bombsRemaining: sim.remaining,
                bombReloadSeconds: sim.reload,
                bombPredictionKind: prediction?.kind ?? null,
                bombSplashCount: effects.filter(
                    (e) => e.age < effectLifetime && e.water
                ).length,
                bombEffects: effects.filter((e) => e.age < effectLifetime)
                    .length,
                bombPredictionMs: workMs,
                bombPredictionPeakMs: peakWorkMs
            };
        },
        dispose() {
            abort.abort();
            hud.remove();
            scene.remove(group);
            stores.forEach((mesh) => airplane.remove(mesh));
            pylons.forEach((mesh) => airplane.remove(mesh));
            pylonGeometry.dispose();
            geometry.dispose();
            material.dispose();
            marker.dispose();
            sphere.dispose();
            wave.dispose();
            effects.forEach((e) => {
                e.cloud.material.dispose();
                e.ripple.material.dispose();
            });
        }
    };
}
