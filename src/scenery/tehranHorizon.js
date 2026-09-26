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
    const geometry = new THREE.PlaneGeometry(150000, 60000, 192, 72);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(20000, 0, world.minZ - 29000);
    const positions = geometry.attributes.position,
        colors = [];
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
            z = positions.getZ(i);
        let y = -100;
        for (const peak of peaks) {
            const r = Math.hypot(x - peak.p[0], z - peak.p[1]) / peak.radius;
            const h = peak.height * Math.max(0, 1 - r);
            y = Math.max(y, h);
        }
        y += Math.max(0, y) * 0.06 * Math.sin(x * 0.002) * Math.cos(z * 0.0017);
        // Taper the foreground edge below the existing playable terrain.
        y *= Math.min(1, Math.max(0, (world.minZ - z) / 4500));
        positions.setY(i, y - 30);
        const c = new THREE.Color(
            y > 2600 + 170 * Math.sin(x * 0.003) ? 0xd8e1e4 : 0x9faeb4
        );
        colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        fog: false,
        side: THREE.DoubleSide
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'Alborz with snow-capped Damavand';
    mesh.frustumCulled = false;
    group.add(mesh);
    return group;
}
