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
