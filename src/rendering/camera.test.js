import { expect, it } from 'vitest';
import * as THREE from 'three';
import { updateCamera } from './camera.js';

it('keeps chase and orbit distance stable during straight flight', () => {
    for (const mode of ['chase', 'orbit']) {
        const camera = new THREE.PerspectiveCamera();
        const airplane = new THREE.Object3D();
        camera.position.set(-10, 4, 0);
        const cameraMode = {
            getMode: () => mode,
            isOrbitMode: () => mode === 'orbit',
            setMode() {}
        };
        const controls =
            /** @type {import('three/addons/controls/OrbitControls.js').OrbitControls} */ (
                /** @type {unknown} */ ({
                    target: new THREE.Vector3(),
                    update() {}
                })
            );
        updateCamera({ camera, airplane, cameraMode, controls });
        const initialOffset = camera.position.clone().sub(airplane.position);
        for (let tick = 0; tick < 120; tick++) {
            airplane.position.x += 2;
            updateCamera({
                camera,
                airplane,
                cameraMode,
                controls,
                delta: 1 / 60
            });
        }
        expect(
            camera.position
                .clone()
                .sub(airplane.position)
                .distanceTo(initialOffset)
        ).toBeLessThan(0.00001);
    }
});

it('jet chase stays upright while banked and lags a heading change', () => {
    const camera = new THREE.PerspectiveCamera();
    const airplane = new THREE.Object3D();
    airplane.userData.jet = true;
    const mode = {
        getMode: () => 'chase',
        isOrbitMode: () => false,
        setMode() {}
    };
    const controls =
        /** @type {import('three/addons/controls/OrbitControls.js').OrbitControls} */ (
            /** @type {unknown} */ ({
                target: new THREE.Vector3(),
                update() {}
            })
        );
    updateCamera({ camera, airplane, cameraMode: mode, controls });
    airplane.rotation.set(1.2, 0, 0, 'YZX');
    updateCamera({
        camera,
        airplane,
        cameraMode: mode,
        controls,
        delta: 1 / 60
    });
    expect(camera.up.toArray()).toEqual([0, 1, 0]);
    expect(camera.position.y).toBeCloseTo(8);
    airplane.rotation.set(1.2, Math.PI / 2, 0, 'YZX');
    updateCamera({
        camera,
        airplane,
        cameraMode: mode,
        controls,
        delta: 1 / 60
    });
    expect(camera.position.x).toBeLessThan(-20);
    expect(camera.position.z).toBeGreaterThan(0);
    for (let i = 0; i < 180; i++)
        updateCamera({
            camera,
            airplane,
            cameraMode: mode,
            controls,
            delta: 1 / 60
        });
    expect(camera.position.z).toBeCloseTo(23, 1);
});
