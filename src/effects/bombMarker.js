import * as THREE from 'three';

/** Ground-draped geometry scaled for readability, never turned toward the camera.
 * @param {THREE.Scene} scene
 * @param {Pick<ReturnType<import('../scenery/bombSurfaces.js').createBombSurfaces>, 'height' | 'markerHeight'>} surfaces */
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
    // Share 81 samples across all 624 ribbon vertices, including duplicates.
    // Only the final sizing pass samples surfaces: at most 81 per update.
    const gridSize = 9,
        extent = 1.04;
    const heights = new Float64Array(gridSize * gridSize);
    const cachedPoint = new THREE.Vector3(Infinity, Infinity, Infinity);
    const cachedCamera = new THREE.Matrix4();
    const cachedProjection = new THREE.Matrix4();
    let cachedHeading = NaN,
        cachedKind = '',
        cachedWidth = 0,
        cachedHeight = 0;
    let samples = 0,
        workMs = 0;
    let width = 0,
        height = 0,
        footprint = 0;
    return {
        /** @param {THREE.Vector3|null} point @param {THREE.Camera} camera
         * @param {boolean} dimmed @param {boolean} blocked @param {string} kind
         * @param {number} [heading] Aircraft yaw, with forward along local +X. */
        update(point, camera, dimmed, blocked, kind, heading = 0) {
            mesh.visible = false;
            samples = 0;
            workMs = 0;
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
            const sameGeometry =
                cachedPoint.equals(point) &&
                cachedHeading === heading &&
                cachedKind === kind &&
                cachedCamera.equals(camera.matrixWorld) &&
                cachedProjection.equals(camera.projectionMatrix) &&
                cachedWidth === innerWidth &&
                cachedHeight === innerHeight;
            samples = 0;
            const start = performance.now();
            if (!sameGeometry) {
                // Normalize the longest screen dimension, retaining foreshortening.
                let radius = Math.max(
                    1,
                    camera.position.distanceTo(point) * 0.1
                );
                const cos = Math.cos(heading),
                    sin = Math.sin(heading);
                for (let pass = 0; pass < 3; pass++) {
                    for (let gz = 0; gz < gridSize; gz++) {
                        for (let gx = 0; gx < gridSize; gx++) {
                            const forward =
                                ((gx / (gridSize - 1)) * 2 - 1) * extent;
                            const side =
                                ((gz / (gridSize - 1)) * 2 - 1) * extent;
                            const x =
                                point.x + (forward * cos + side * sin) * radius;
                            const z =
                                point.z +
                                (-forward * sin + side * cos) * radius;
                            heights[gz * gridSize + gx] =
                                (pass < 2
                                    ? point.y
                                    : kind === 'building'
                                      ? surfaces.markerHeight(
                                            x,
                                            z,
                                            point.y + Math.max(4, radius)
                                        )
                                      : surfaces.height(x, z)) + 0.25;
                            if (pass === 2) samples++;
                        }
                    }
                    let minX = Infinity,
                        maxX = -Infinity,
                        minY = Infinity,
                        maxY = -Infinity;
                    for (let i = 0; i < base.length / 2; i++) {
                        // Rotate in the ground plane before sampling height:
                        // the long axes follow aircraft heading, never its bank.
                        const forward = base[i * 2],
                            side = base[i * 2 + 1];
                        const x =
                            point.x + (forward * cos + side * sin) * radius;
                        const z =
                            point.z + (-forward * sin + side * cos) * radius;
                        const gx =
                            ((forward / extent + 1) * (gridSize - 1)) / 2;
                        const gz = ((side / extent + 1) * (gridSize - 1)) / 2;
                        const ix = Math.min(gridSize - 2, Math.floor(gx));
                        const iz = Math.min(gridSize - 2, Math.floor(gz));
                        const tx = gx - ix,
                            tz = gz - iz;
                        const a = heights[iz * gridSize + ix];
                        const b = heights[iz * gridSize + ix + 1];
                        const c = heights[(iz + 1) * gridSize + ix];
                        const d = heights[(iz + 1) * gridSize + ix + 1];
                        const y =
                            (a + (b - a) * tx) * (1 - tz) +
                            (c + (d - c) * tx) * tz;
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
                cachedPoint.copy(point);
                cachedCamera.copy(camera.matrixWorld);
                cachedProjection.copy(camera.projectionMatrix);
                cachedHeading = heading;
                cachedKind = kind;
                cachedWidth = innerWidth;
                cachedHeight = innerHeight;
            }
            workMs = performance.now() - start;
            material.color.setHex(blocked ? 0xffbb71 : 0xffca55);
            material.opacity = dimmed ? 0.4 : 1;
            mesh.visible = true;
        },
        stats() {
            return {
                bombMarkerSamples: samples,
                bombMarkerMs: workMs,
                bombMarkerVisible: mesh.visible,
                bombMarkerWidth: width,
                bombMarkerHeight: height,
                bombMarkerFootprint: footprint
            };
        },
        hide() {
            mesh.visible = false;
            samples = 0;
            workMs = 0;
        },
        dispose() {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        }
    };
}
