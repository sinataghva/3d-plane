import * as THREE from 'three';
import { azadiFlagGeometry } from './azadiFlags.js';

// Shift the rim positions clear of the scoreboards and diagonal floodlights.
export const STADIUM_FLAG_ANGLES = Array.from({ length: 36 }, (_, index) => {
    // Eighteen positions per half, leaving clear space at the two boards.
    return (index >= 18 ? 180 : 0) + 13 + ((index % 18) * 154) / 17;
});

/** Decorative only: the stadium's simplified collision envelope is unchanged. */
export function createStadiumDecorations() {
    const group = new THREE.Group();
    group.name = 'Azadi Stadium flags and portraits';
    const metal = new THREE.MeshLambertMaterial({ color: 0xd7dcda });
    const poles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.13, 0.22, 10, 8),
        metal,
        STADIUM_FLAG_ANGLES.length
    );
    const caps = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.25, 8, 6),
        metal,
        STADIUM_FLAG_ANGLES.length
    );
    /** @param {string} url */
    const load = (url) => {
        if (typeof document === 'undefined') return null;
        const texture = new THREE.TextureLoader().load(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        return texture;
    };
    const cloth = azadiFlagGeometry();
    cloth.scale(1 / 3, 1 / 3, 1 / 3);
    const flags = new THREE.InstancedMesh(
        cloth,
        new THREE.MeshLambertMaterial({
            map: load(
                new URL(
                    '../assets/lion-sun-flag-reference.jpg',
                    import.meta.url
                ).href
            ),
            side: THREE.DoubleSide
        }),
        STADIUM_FLAG_ANGLES.length
    );
    poles.name = 'Stadium flag poles';
    flags.name = 'Stadium Lion and Sun flags';
    const transform = new THREE.Object3D();
    STADIUM_FLAG_ANGLES.forEach((degrees, i) => {
        const a = THREE.MathUtils.degToRad(degrees);
        const x = Math.sin(a) * 121,
            z = Math.cos(a) * 138;
        transform.rotation.set(0, 0, 0);
        transform.position.set(x, 43, z);
        transform.updateMatrix();
        poles.setMatrixAt(i, transform.matrix);
        transform.position.y = 48.25;
        transform.updateMatrix();
        caps.setMatrixAt(i, transform.matrix);
        transform.position.y = 45.5;
        transform.rotation.y = -0.4;
        transform.updateMatrix();
        flags.setMatrixAt(i, transform.matrix);
    });
    // Static cloth: no animation allocations or individual-pixel meshes.
    group.add(poles, caps, flags);
    const display = new THREE.PlaneGeometry(42, (42 * 6.8) / 19);
    const portraits = new THREE.MeshBasicMaterial({
        map: load(
            new URL('../assets/stadium-portraits.png', import.meta.url).href
        )
    });
    for (const side of [-1, 1]) {
        const screen = new THREE.Mesh(display, portraits);
        screen.name = `Stadium portrait display ${side}`;
        // Existing screen backing ends at |z|=133.8; leave a real 20 cm gap.
        screen.position.set(0, 52.5, side * 133.6);
        screen.rotation.y = side > 0 ? Math.PI : 0;
        group.add(screen);
    }
    return group;
}
