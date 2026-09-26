import * as THREE from 'three';

/** Ground-draped geometry scaled for readability, never turned toward the camera.
 * @param {THREE.Scene} scene
 * @param {ReturnType<import('../scenery/bombSurfaces.js').createBombSurfaces>} surfaces */
export function createBombMarker(scene, surfaces) {
    /** @type {number[]} */ const base = [];
    /** @param {number} ax @param {number} az @param {number} bx @param {number} bz */
    const line = (ax, az, bx, bz, steps = 12) => {
        for (let i = 0; i < steps; i++)
            for (const t of [i / steps, (i + 1) / steps])
                base.push(ax + (bx - ax) * t, az + (bz - az) * t);
    };
    for (let i = 0; i < 16; i++)
        for (let j = 0; j < 3; j++) {
            const a = (i * Math.PI) / 8 + j * 0.045,
                b = a + 0.045;
            line(
                Math.cos(a) * 0.8,
                Math.sin(a) * 0.8,
                Math.cos(b) * 0.8,
                Math.sin(b) * 0.8,
                1
            );
        }
    for (const sign of [-1, 1]) {
        line(sign * 0.18, 0, sign, 0);
        line(0, sign * 0.18, 0, sign);
        line(sign, -0.065, sign, 0.065, 2);
        line(-0.065, sign, 0.065, sign, 2);
    }
    // Use narrow surface ribbons rather than GL lines: polygon offset does
    // not apply to lines, so biased road/paint meshes could cover the reticle.
    const segments = base.splice(0);
    for (let i = 0; i < segments.length; i += 4) {
        const [ax, az, bx, bz] = segments.slice(i, i + 4);
        const length = Math.hypot(bx - ax, bz - az);
        const dx = (-(bz - az) / length) * 0.022;
        const dz = ((bx - ax) / length) * 0.022;
        base.push(
            ax + dx,
            az + dz,
            ax - dx,
            az - dz,
            bx + dx,
            bz + dz,
            bx + dx,
            bz + dz,
            ax - dx,
            az - dz,
            bx - dx,
            bz - dz
        );
    }
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.Float32BufferAttribute(
        (base.length / 2) * 3,
        3
    );
    geometry.setAttribute('position', positions);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffca55,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.renderOrder = 1;
    mesh.name = 'Terrain-draped bomb crosshair';
    mesh.frustumCulled = false;
    mesh.visible = false;
    scene.add(mesh);
    const projected = new THREE.Vector3();
    const roofTop = new THREE.Vector3(),
        roofBottom = new THREE.Vector3();
    let width = 0,
        height = 0,
        footprint = 0;
    return {
        /** @param {THREE.Vector3|null} point @param {THREE.Camera} camera
         * @param {boolean} dimmed @param {boolean} blocked @param {string} kind
         * @param {number} [heading] Aircraft yaw, with forward along local +X. */
        update(point, camera, dimmed, blocked, kind, heading = 0) {
            mesh.visible = false;
            if (!point) return;
            camera.updateMatrixWorld();
            projected.copy(point).project(camera);
            if (
                Math.abs(projected.x) > 1 ||
                Math.abs(projected.y) > 1 ||
                projected.z < -1 ||
                projected.z > 1
            )
                return;
            // Normalize the longest screen dimension, retaining foreshortening.
            let radius = Math.max(1, camera.position.distanceTo(point) * 0.1);
            const cos = Math.cos(heading),
                sin = Math.sin(heading);
            for (let pass = 0; pass < 3; pass++) {
                let minX = Infinity,
                    maxX = -Infinity,
                    minY = Infinity,
                    maxY = -Infinity;
                for (let i = 0; i < base.length / 2; i++) {
                    // Rotate in the ground plane before sampling height:
                    // the long axes follow aircraft heading, never its bank.
                    const forward = base[i * 2],
                        side = base[i * 2 + 1];
                    const x = point.x + (forward * cos + side * sin) * radius;
                    const z = point.z + (-forward * sin + side * cos) * radius;
                    const roof =
                        kind === 'building'
                            ? surfaces.sweep(
                                  roofTop.set(x, point.y + 1, z),
                                  roofBottom.set(x, point.y - 2, z)
                              )
                            : null;
                    const y =
                        (roof?.position.y ?? surfaces.height(x, z)) + 0.25;
                    positions.setXYZ(i, x, y, z);
                    projected.set(x, y, z).project(camera);
                    minX = Math.min(minX, projected.x);
                    maxX = Math.max(maxX, projected.x);
                    minY = Math.min(minY, projected.y);
                    maxY = Math.max(maxY, projected.y);
                }
                width = ((maxX - minX) * innerWidth) / 2;
                height = ((maxY - minY) * innerHeight) / 2;
                footprint = radius * 2;
                radius *= 160 / Math.max(1, width, height);
            }
            positions.needsUpdate = true;
            material.color.setHex(blocked ? 0xffbb71 : 0xffca55);
            material.opacity = dimmed ? 0.4 : 1;
            mesh.visible = true;
        },
        stats() {
            return {
                bombMarkerVisible: mesh.visible,
                bombMarkerWidth: width,
                bombMarkerHeight: height,
                bombMarkerFootprint: footprint
            };
        },
        hide() {
            mesh.visible = false;
        },
        dispose() {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        }
    };
}
