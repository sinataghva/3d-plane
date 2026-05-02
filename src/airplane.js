import * as THREE from 'three';

/**
 * @returns {{ airplane: THREE.Group, propeller: THREE.Mesh }}
 */
export function createAirplane() {
    const airplane = new THREE.Group();

    const bodyMaterial = new THREE.MeshPhongMaterial({
        color: 0x3366cc,
        specular: 0x111111,
        shininess: 30
    });
    const detailMaterial = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        specular: 0x111111,
        shininess: 30
    });

    const fuselageGeometry = new THREE.CylinderGeometry(0.8, 0.8, 6, 16);
    fuselageGeometry.rotateZ(Math.PI / 2);
    const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    airplane.add(fuselage);

    const noseGeometry = new THREE.ConeGeometry(0.8, 2, 16);
    noseGeometry.rotateZ(-Math.PI / 2);
    const nose = new THREE.Mesh(noseGeometry, bodyMaterial);
    nose.position.set(4, 0, 0);
    nose.castShadow = true;
    nose.receiveShadow = true;
    airplane.add(nose);

    const tailGeometry = new THREE.ConeGeometry(0.8, 1, 16);
    tailGeometry.rotateZ(Math.PI / 2);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(-3.5, 0, 0);
    tail.castShadow = true;
    tail.receiveShadow = true;
    airplane.add(tail);

    const wingGeometry = new THREE.BoxGeometry(3, 0.2, 10);
    const wings = new THREE.Mesh(wingGeometry, bodyMaterial);
    wings.castShadow = true;
    wings.receiveShadow = true;
    airplane.add(wings);

    const tailWingGeometry = new THREE.BoxGeometry(1.5, 0.2, 3);
    const tailWing = new THREE.Mesh(tailWingGeometry, bodyMaterial);
    tailWing.position.set(-3, 0, 0);
    tailWing.castShadow = true;
    tailWing.receiveShadow = true;
    airplane.add(tailWing);

    const stabilizerGeometry = new THREE.BoxGeometry(1.5, 2, 0.2);
    const stabilizer = new THREE.Mesh(stabilizerGeometry, bodyMaterial);
    stabilizer.position.set(-3, 1, 0);
    stabilizer.castShadow = true;
    stabilizer.receiveShadow = true;
    airplane.add(stabilizer);

    const cockpitGeometry = new THREE.SphereGeometry(
        0.8,
        16,
        16,
        0,
        Math.PI * 2,
        0,
        Math.PI / 2
    );
    const cockpit = new THREE.Mesh(cockpitGeometry, detailMaterial);
    cockpit.position.set(1.5, 0.6, 0);
    cockpit.rotation.x = Math.PI;
    cockpit.rotation.y = Math.PI / 2;
    cockpit.castShadow = true;
    cockpit.receiveShadow = true;
    airplane.add(cockpit);

    const propellerGeometry = new THREE.BoxGeometry(0.2, 0.1, 3);
    const propeller = new THREE.Mesh(propellerGeometry, detailMaterial);
    propeller.position.set(5, 0, 0);
    propeller.castShadow = true;
    propeller.receiveShadow = true;
    airplane.add(propeller);

    return { airplane, propeller };
}
