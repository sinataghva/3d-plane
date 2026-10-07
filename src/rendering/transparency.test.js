import { expect, it } from 'vitest';
import * as THREE from 'three';
import {
    createLayeredSmoke,
    transparentLayer,
    transparentOrder
} from './transparency.js';

it('rebatches a ribbon across clouds when its parent or camera moves', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
            [
                0, 0, -200, 1, 0, -200, 0, 0, -220, 1, 0, -220, 0, 0, -800, 1,
                0, -800, 0, 0, -820, 1, 0, -820
            ],
            3
        )
    );
    geometry.setIndex([0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6]);
    const smoke = createLayeredSmoke(geometry, new THREE.MeshBasicMaterial());
    const parent = new THREE.Group();
    parent.add(smoke.group);
    const camera = new THREE.PerspectiveCamera();
    smoke.update(camera);
    const near = smoke.group.children[transparentLayer(210)];
    const far = smoke.group.children[transparentLayer(810)];
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(true);
    expect(far.renderOrder).toBeLessThan(
        transparentOrder(transparentLayer(500))
    );
    expect(near.renderOrder).toBeGreaterThan(
        transparentOrder(transparentLayer(500))
    );
    parent.position.z = -2000;
    smoke.update(camera);
    expect(near.visible).toBe(false);
    expect(far.visible).toBe(false);
    expect(smoke.group.children.filter((m) => m.visible)).toHaveLength(2);
    camera.position.z = -2000;
    smoke.update(camera);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(true);
    // A shorter low-quality history cannot leave stale triangles visible.
    geometry.setDrawRange(0, 6);
    smoke.update(camera);
    expect(near.visible).toBe(true);
    expect(far.visible).toBe(false);
});
