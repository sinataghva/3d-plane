import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGeographicCanvas } from './cartography.js';
import { inFeature } from './geography.js';
import { instanceStaticScenery } from './instancing.js';

/** @param {import('./geography.js').Geography} world */
export function createTerrain(world) {
    const group = new THREE.Group();
    group.name = 'Saint-Cyr – Versailles';
    const surface = createGeographicCanvas(world, 4096);
    const texture = new THREE.CanvasTexture(surface);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    const ground = new THREE.PlaneGeometry(world.width, world.depth, 256, 256);
    ground.rotateX(-Math.PI / 2);
    const positions = ground.getAttribute('position');
    for (let i = 0; i < positions.count; i++)
        positions.setY(i, world.height(positions.getX(i), positions.getZ(i)));
    ground.computeVertexNormals();
    const terrain = new THREE.Mesh(
        ground,
        new THREE.MeshLambertMaterial({ map: texture })
    );
    terrain.receiveShadow = true;
    group.add(terrain);
    // A muted continuation permits unrestricted flight beyond the detailed area.
    const outer = new THREE.Mesh(
        new THREE.PlaneGeometry(100000, 100000),
        new THREE.MeshLambertMaterial({ color: 0x798861 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -35;
    group.add(outer);
    // Join the detailed tile to the distant plain using the same collision height.
    for (const [cx, cz, w, d] of [
        [world.minX - 1500, 0, 3000, world.depth + 6000],
        [world.maxX + 1500, 0, 3000, world.depth + 6000],
        [0, world.minZ - 1500, world.width, 3000],
        [0, world.maxZ + 1500, world.width, 3000]
    ]) {
        const apron = new THREE.PlaneGeometry(w, d, 64, 64);
        apron.rotateX(-Math.PI / 2);
        apron.translate(cx, 0, cz);
        const points = apron.getAttribute('position');
        for (let i = 0; i < points.count; i++)
            points.setY(i, world.height(points.getX(i), points.getZ(i)));
        apron.computeVertexNormals();
        group.add(new THREE.Mesh(apron, outer.material));
    }
    /** @type {Map<string,{positions:number[],colors:number[]}>} */
    const chunks = new Map();
    for (const f of world.data.features.filter((f) => f.kind === 'building')) {
        const ring = f.points.slice(0, -1);
        if (ring.length < 3) continue;
        const x = ring.reduce((s, p) => s + p[0], 0) / ring.length,
            z = ring.reduce((s, p) => s + p[1], 0) / ring.length;
        const key = `${Math.floor(x / 500)},${Math.floor(z / 500)}`;
        let chunk = chunks.get(key);
        if (!chunk) {
            chunk = { positions: [], colors: [] };
            chunks.set(key, chunk);
        }
        const contour = ring.map((p) => new THREE.Vector2(p[0], p[1]));
        const holes = f.holes.map((h) =>
            h.slice(0, -1).map((p) => new THREE.Vector2(p[0], p[1]))
        );
        const triangles = THREE.ShapeUtils.triangulateShape(contour, holes);
        const all = [...ring, ...f.holes.flatMap((h) => h.slice(0, -1))];
        const base = world.height(ring[0][0], ring[0][1]),
            top = base + (f.height || 8);
        const wall = new THREE.Color(f.palace ? 0xe8d1a1 : 0xc6bc9f);
        const roof = new THREE.Color(
            f.palace
                ? 0x696e79
                : f.id.charCodeAt(2) % 3 === 0
                  ? 0x8f6652
                  : 0x777d79
        );
        /** @param {number[]} a @param {number[]} b @param {number[]} c @param {THREE.Color} color */
        const tri = (a, b, c, color) => {
            chunk.positions.push(...a, ...b, ...c);
            for (let k = 0; k < 3; k++)
                chunk.colors.push(color.r, color.g, color.b);
        };
        for (const t of triangles) {
            const pts = t.map((i) => [all[i][0], top, all[i][1]]);
            tri(pts[2], pts[1], pts[0], roof);
        }
        for (const r of [ring, ...f.holes.map((h) => h.slice(0, -1))])
            for (let i = 0; i < r.length; i++) {
                const a = r[i],
                    b = r[(i + 1) % r.length];
                const bottom =
                    Math.min(
                        base,
                        world.height(a[0], a[1]),
                        world.height(b[0], b[1])
                    ) - 1;
                tri(
                    [a[0], bottom, a[1]],
                    [b[0], bottom, b[1]],
                    [b[0], top, b[1]],
                    wall
                );
                tri(
                    [a[0], bottom, a[1]],
                    [b[0], top, b[1]],
                    [a[0], top, a[1]],
                    wall
                );
                if (f.palace) {
                    const dx = b[0] - a[0],
                        dz = b[1] - a[1],
                        length = Math.hypot(dx, dz);
                    if (length < 1) continue;
                    const nx = (-dz / length) * 0.08,
                        nz = (dx / length) * 0.08;
                    const gold = new THREE.Color(0xc5a45c),
                        glass = new THREE.Color(0x3b535d);
                    const quad = (
                        /** @type {number} */ u,
                        /** @type {number} */ v,
                        /** @type {number} */ y,
                        /** @type {number} */ h,
                        /** @type {THREE.Color} */ color
                    ) => {
                        const p = [a[0] + dx * u + nx, y, a[1] + dz * u + nz],
                            q = [a[0] + dx * v + nx, y, a[1] + dz * v + nz];
                        tri(p, q, [q[0], y + h, q[2]], color);
                        tri(p, [q[0], y + h, q[2]], [p[0], y + h, p[2]], color);
                    };
                    quad(0, 1, top - 0.65, 0.65, gold);
                    for (let t = 3; t < length - 2; t += 5)
                        for (let floor = 0; floor < 3; floor++)
                            quad(
                                (t - 0.85) / length,
                                (t + 0.85) / length,
                                base + 1.5 + floor * 3,
                                1.9,
                                glass
                            );
                }
            }
    }
    const material = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide
    });
    for (const c of chunks.values()) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(c.positions, 3)
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(c.colors, 3)
        );
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = 'Buildings · spatial batch';
        group.add(mesh);
    }
    // Reproducible woodland; one combined canopy/trunk geometry, batched by 750 m cell.
    let seed = 116;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const canopy = new THREE.ConeGeometry(0.4, 0.8, 6);
    canopy.translate(0, 0.6, 0);
    const trunk = new THREE.CylinderGeometry(0.025, 0.035, 0.6, 5);
    trunk.translate(0, 0.3, 0);
    for (const [
        geometry,
        hex
    ] of /** @type {[THREE.BufferGeometry,number][]} */ ([
        [canopy, 0x3d653c],
        [trunk, 0x6c5640]
    ])) {
        const color = new THREE.Color(hex);
        const colors = new Float32Array(
            geometry.getAttribute('position').count * 3
        );
        for (let i = 0; i < colors.length; i += 3)
            colors.set([color.r, color.g, color.b], i);
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    const treeGeometry = mergeGeometries([canopy, trunk]);
    if (!treeGeometry) throw new Error('Tree geometry unavailable');
    canopy.dispose();
    trunk.dispose();
    const treeMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
    const trees = [];
    for (const f of world.data.features.filter((f) => f.kind === 'forest')) {
        const xs = f.points.map((p) => p[0]),
            zs = f.points.map((p) => p[1]);
        const minX = Math.max(world.minX, Math.min(...xs)),
            maxX = Math.min(world.maxX, Math.max(...xs)),
            minZ = Math.max(world.minZ, Math.min(...zs)),
            maxZ = Math.min(world.maxZ, Math.max(...zs));
        const count = Math.min(
            900,
            Math.floor(((maxX - minX) * (maxZ - minZ)) / 1400)
        );
        for (let i = 0; i < count && trees.length < 9000; i++) {
            const x = minX + random() * (maxX - minX),
                z = minZ + random() * (maxZ - minZ);
            if (
                !inFeature(x, z, f) ||
                world.onRunway(x, z) ||
                world.obstacle(x, z, world.height(x, z) + 1)
            )
                continue;
            const h = 8 + random() * 10,
                y = world.height(x, z);
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.set(x, y, z);
            tree.scale.setScalar(h);
            group.add(tree);
            trees.push(tree);
        }
    }
    instanceStaticScenery(group, trees, 750);
    // White threshold boards make the grass runway readable at low altitude.
    const boardGeometry = new THREE.BoxGeometry(2, 0.25, 2),
        boardMaterial = new THREE.MeshBasicMaterial({ color: 0xfff7df });
    const boards = [];
    for (const runway of world.runways) {
        const a = runway.points[0],
            b = runway.points[runway.points.length - 1],
            dx = b[0] - a[0],
            dz = b[1] - a[1],
            length = Math.hypot(dx, dz),
            w = (runway.width || 50) / 2;
        for (let t = 0; t <= length; t += 80)
            for (const side of [-1, 1]) {
                const x = a[0] + (dx * t) / length - (dz / length) * w * side,
                    z = a[1] + (dz * t) / length + (dx / length) * w * side;
                const marker = new THREE.Mesh(boardGeometry, boardMaterial);
                marker.position.set(x, world.height(x, z) + 0.2, z);
                group.add(marker);
                boards.push(marker);
            }
    }
    instanceStaticScenery(group, boards, 500);
    group.userData.summary = {
        buildings: world.data.features.filter((f) => f.kind === 'building')
            .length,
        trees: trees.length,
        buildingBatches: chunks.size
    };
    return group;
}
