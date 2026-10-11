import * as THREE from 'three';

/** Decorative, non-colliding Alborz skyline. Real peak bearings, approximate relief.
 * @param {import('./geography.js').Geography} world */
export function createTehranHorizon(world) {
    const group = new THREE.Group();
    group.name = 'Distant Alborz · Damavand';
    if (!world.data.airfield?.includes('OIII')) return group;
    const project = (/** @type {number} */ lat, /** @type {number} */ lon) => [
        (lon - world.data.origin[1]) *
            111320 *
            Math.cos((world.data.origin[0] * Math.PI) / 180),
        (world.data.origin[0] - lat) * 111320
    ];
    const peaks = [
        { p: project(35.884, 51.42), height: 2700, radius: 10000 },
        { p: project(35.97, 51.3), height: 2900, radius: 12500 },
        { p: project(35.94, 51.63), height: 1500, radius: 10000 },
        { p: project(35.951, 52.109), height: 4400, radius: 12500 }
    ];
    const geometry = new THREE.PlaneGeometry(150000, 60000, 256, 96);
    geometry.rotateX(-Math.PI / 2);
    // Stop outside the mapped terrain to avoid overlapping surfaces at its edge.
    geometry.translate(20000, 0, world.minZ - 31000);
    const positions = geometry.attributes.position,
        colors = [],
        rockColor = new THREE.Color(0x9ca6a9),
        snowColor = new THREE.Color(0xdce5e7),
        vertexColor = new THREE.Color();
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
            z = positions.getZ(i);
        let y = -100;
        for (const peak of peaks) {
            const angle = Math.atan2(z - peak.p[1], x - peak.p[0]);
            // Preserve Damavand's volcanic profile; give the western range
            // asymmetric ridges rather than four similarly circular cones.
            const radius =
                peak.radius *
                (peak.height > 4000
                    ? 1
                    : 0.9 +
                      0.16 * Math.sin(angle * 5) +
                      0.08 * Math.cos(angle * 9));
            const r = Math.hypot(x - peak.p[0], z - peak.p[1]) / radius;
            const h = peak.height * Math.pow(Math.max(0, 1 - r), 1.15);
            y = Math.max(y, h);
        }
        // Multi-scale spurs break the smooth cone profiles without changing the
        // mapped collision surface or the distant mesh resolution.
        const relief =
            Math.sin(x * 0.00073 + Math.sin(z * 0.00031)) *
                Math.cos(z * 0.00057) +
            0.4 * Math.sin(x * 0.0019 + z * 0.0013);
        y += Math.max(0, y) * 0.085 * relief;
        positions.setY(i, y - 30);
    }
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    const haze = new THREE.Color(0xc4d5df);
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
            z = positions.getZ(i),
            y = positions.getY(i);
        const slope = Math.abs(normals.getY(i));
        const snow = THREE.MathUtils.smoothstep(
            y + 140 * Math.sin(x * 0.0011 + z * 0.0008) - (1 - slope) * 1700,
            2150,
            3200
        );
        vertexColor.copy(rockColor).lerp(snowColor, snow);
        const aspect =
            0.88 +
            0.12 *
                (normals.getX(i) * 0.6 +
                    normals.getY(i) * 0.7 +
                    normals.getZ(i) * 0.3);
        vertexColor.multiplyScalar(aspect);
        vertexColor.lerp(
            haze,
            THREE.MathUtils.smoothstep(Math.hypot(x, z), 18000, 80000) * 0.48
        );
        const edgeFade = THREE.MathUtils.smoothstep(world.minZ - z, 1500, 7500);
        const baseFade = THREE.MathUtils.smoothstep(y, 50, 1100);
        colors.push(
            vertexColor.r,
            vertexColor.g,
            vertexColor.b,
            0.9 * edgeFade * baseFade
        );
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true,
        fog: false,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Alborz with snow-capped Damavand';
    mesh.frustumCulled = false;
    group.add(mesh);
    return group;
}
