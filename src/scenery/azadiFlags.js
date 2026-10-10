import * as THREE from 'three';
import { createRenderedHeight } from './groundDetail.js';

// Three evenly spread positions along each outer garden's arc.
// Coordinates use the same local map origin as the cached ways.
export const AZADI_FLAGS = [
    { garden: 'w545300305-0', x: -4060, z: -2825 },
    { garden: 'w545300305-0', x: -3995, z: -2905 },
    { garden: 'w545300305-0', x: -3880, z: -2940 },
    { garden: 'w545300307-0', x: -3745, z: -2940 },
    { garden: 'w545300307-0', x: -3645, z: -2900 },
    { garden: 'w545300307-0', x: -3595, z: -2825 },
    { garden: 'w545300123-0', x: -4060, z: -2680 },
    { garden: 'w545300123-0', x: -3980, z: -2590 },
    { garden: 'w545300123-0', x: -3860, z: -2570 },
    { garden: 'w545300308-0', x: -3730, z: -2580 },
    { garden: 'w545300308-0', x: -3640, z: -2620 },
    { garden: 'w545300308-0', x: -3590, z: -2695 }
];
export const AZADI_FLAG_HEIGHT = 36;

/** Shared cloth in a light breeze; the hoist remains attached to the pole.
 * Static folds avoid a per-frame update for distant scenery. */
export function azadiFlagGeometry() {
    const geometry = new THREE.PlaneGeometry(4.9, 2.8, 24, 12);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i) + 2.45;
        const u = x / 4.9;
        const y = position.getY(i);
        position.setXYZ(
            i,
            x + 0.06,
            y - 0.22 * u * u,
            u *
                (0.32 * Math.sin(u * Math.PI * 3) +
                    0.1 * Math.sin(y * 2 + u * 5))
        );
    }
    // 24 × 14.4 m cloth, matching the supplied flag image proportions.
    geometry.scale(24 / 4.9, 14.4 / 2.8, 24 / 4.9);
    geometry.computeVertexNormals();
    return geometry;
}

/** @param {import('./geography.js').Geography} world */
export function createAzadiFlags(world) {
    const group = new THREE.Group();
    group.name = 'Azadi outer garden flags';
    if (!world.data.airfield?.includes('OIII')) return group;
    const height = createRenderedHeight(world);
    const metal = new THREE.MeshLambertMaterial({ color: 0xd7dcda });
    const stone = new THREE.MeshLambertMaterial({ color: 0xd3ccb9 });
    const poles = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.21, 0.39, AZADI_FLAG_HEIGHT, 10),
        metal,
        AZADI_FLAGS.length
    );
    const bases = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(2.1, 2.55, 0.9, 8),
        stone,
        AZADI_FLAGS.length
    );
    const caps = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        metal,
        AZADI_FLAGS.length
    );
    poles.name = 'Azadi flag poles';
    bases.name = 'Azadi flag bases';
    caps.name = 'Azadi flag finials';
    const texture =
        typeof document === 'undefined'
            ? null
            : new THREE.TextureLoader().load(
                  new URL('../assets/lion-sun-flag-reference.jpg', import.meta.url).href
              );
    if (texture) {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
    }
    const material = new THREE.MeshLambertMaterial({
        map: texture,
        side: THREE.DoubleSide
    });
    const cloth = azadiFlagGeometry();
    const matrix = new THREE.Matrix4();
    AZADI_FLAGS.forEach(({ garden, x, z }, index) => {
        const y = height(x, z) + 0.13;
        poles.setMatrixAt(
            index,
            matrix.makeTranslation(x, y + AZADI_FLAG_HEIGHT / 2, z)
        );
        bases.setMatrixAt(index, matrix.makeTranslation(x, y + 0.45, z));
        caps.setMatrixAt(
            index,
            matrix.makeTranslation(x, y + AZADI_FLAG_HEIGHT + 0.3, z)
        );
        const flag = new THREE.Mesh(cloth, material);
        flag.name = `Azadi Lion and Sun flag ${index + 1}`;
        flag.position.set(x, y + AZADI_FLAG_HEIGHT - 8, z);
        flag.rotation.y = -0.4;
        flag.castShadow = true;
        flag.userData.garden = garden;
        group.add(flag);
    });
    poles.castShadow = true;
    bases.receiveShadow = true;
    group.add(poles, bases, caps);
    return group;
}
