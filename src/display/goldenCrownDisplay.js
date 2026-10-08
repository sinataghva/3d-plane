import * as THREE from 'three';
import { createLayeredSmoke } from '../rendering/transparency.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createGoldenCrownNumber } from '../aircraft/goldenCrownNumber.js';
import { createGoldenCrown } from '../aircraft/goldenCrown.js';
import {
    sampleDisplay,
    DISPLAY_DURATION,
    wrapTime
} from './goldenCrownFlight.js';

/** @param {{runway: {points: number[][]}, height: (x:number,z:number)=>number}} world */
export function createGoldenCrownDisplay(world) {
    const root = new THREE.Group();
    root.name = 'Golden Crown display';
    const ends = world.runway.points;
    const a = ends[0],
        b = ends[ends.length - 1];
    const heading = Math.atan2(b[1] - a[1], b[0] - a[0]);
    root.rotation.y = -heading;
    root.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
    // Offset the display to the south of the runway, outside the departure line.
    root.position.z += 1300;
    let terrainCeiling = -Infinity;
    const transform = new THREE.Matrix4().makeRotationY(-heading);
    for (let x = -3800; x <= 3800; x += 150) {
        for (let z = -3300; z <= 2700; z += 150) {
            const p = new THREE.Vector3(x, 0, z)
                .applyMatrix4(transform)
                .add(root.position);
            terrainCeiling = Math.max(terrainCeiling, world.height(p.x, p.z));
        }
    }
    root.position.y = terrainCeiling;
    const original = createGoldenCrown();
    original.airplane.updateMatrixWorld(true);
    // Bake static pieces by material. All six jets share these geometries and
    // materials, rather than submitting every panel line as its own draw call.
    const body = new THREE.Group();
    /** @type {Map<string,{material:THREE.Material, geometries:THREE.BufferGeometry[]}>} */
    const batches = new Map();
    /** @type {THREE.Mesh[]} */
    const numbers = [];
    original.airplane.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        let parent = o.parent;
        while (parent && parent !== original.gear) parent = parent.parent;
        if (parent === original.gear) return;
        if (o.userData.displayNumber) {
            numbers.push(o);
            return;
        }
        const geometry = o.geometry.index
            ? o.geometry.toNonIndexed()
            : o.geometry.clone();
        geometry.applyMatrix4(o.matrixWorld);
        const key =
            o.material.uuid + Object.keys(geometry.attributes).sort().join(',');
        if (!batches.has(key))
            batches.set(key, { material: o.material, geometries: [] });
        batches.get(key)?.geometries.push(geometry);
    });
    for (const { material, geometries } of batches.values()) {
        const merged = mergeGeometries(geometries);
        if (!merged) throw new Error('Unable to batch display aircraft');
        body.add(new THREE.Mesh(merged, material));
        geometries.forEach((g) => g.dispose());
    }
    const lightGeometry = new THREE.SphereGeometry(0.16, 8, 6);
    const lightMaterial = new THREE.MeshBasicMaterial({ color: 0xfff5ca });
    const jets = Array.from({ length: 6 }, (_, i) => {
        const jet = body.clone();
        jet.name = `Golden Crown ${i + 1}`;
        const gear = original.gear.clone();
        jet.add(gear);
        for (const source of numbers) {
            const marking = source.clone();
            marking.material = createGoldenCrownNumber(
                i + 1,
                source.userData.displayNumber
            );
            jet.add(marking);
        }
        const lights = new THREE.Group();
        for (const z of [-0.55, 0.55]) {
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(1.8, 1.15, z);
            lights.add(light);
        }
        jet.add(lights);
        root.add(jet);
        return { jet, gear, lights };
    });
    const count = 320,
        history = 20;
    const positions = new Float32Array(6 * count * 2 * 3),
        ages = new Float32Array(6 * count * 2),
        colors = new Float32Array(6 * count * 2 * 3);
    const tangents = new Float32Array(6 * count * 2 * 3);
    const edges = new Float32Array(6 * count * 2);
    const indices = new Uint16Array(6 * (count - 1) * 6);
    // White centre, green left wing, red right wing; two jets per colour.
    const palette = [
        [0.92, 0.93, 0.94],
        [0.03, 0.55, 0.22],
        [0.92, 0.06, 0.1],
        [0.92, 0.93, 0.94],
        [0.03, 0.55, 0.22],
        [0.92, 0.06, 0.1]
    ];
    const smokeGeometry = new THREE.BufferGeometry();
    smokeGeometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
    );
    smokeGeometry.setAttribute('age', new THREE.BufferAttribute(ages, 1));
    smokeGeometry.setAttribute(
        'smokeColor',
        new THREE.BufferAttribute(colors, 3)
    );
    smokeGeometry.setAttribute('tangent', new THREE.BufferAttribute(tangents, 3));
    smokeGeometry.setAttribute('edge', new THREE.BufferAttribute(edges, 1));
    smokeGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
    const smokeMaterial = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { tricolor: { value: 1 } },
        vertexShader: `attribute float age; attribute float edge; attribute vec3 tangent;
        attribute vec3 smokeColor; varying float vAge; varying float vEdge; varying vec3 vColor;
        void main(){
            vAge=age; vEdge=edge; vColor=smokeColor;
            vec4 p=modelViewMatrix*vec4(position,1.);
            vec3 direction=normalize(mat3(modelViewMatrix)*tangent);
            vec3 across=cross(direction,normalize(-p.xyz));
            if(length(across)<.001) across=cross(direction,vec3(0.,1.,0.));
            p.xyz+=normalize(across)*edge*(.35+4.15*smoothstep(0.,.025,age)+age*12.);
            gl_Position=projectionMatrix*p;
        }`,
        fragmentShader: `varying float vAge; varying float vEdge; varying vec3 vColor;
        uniform float tricolor; void main(){
            float a=exp(-vEdge*vEdge*5.)*.55*(1.-vAge);
            a*=1.-smoothstep(.8,1.,abs(vEdge));
            if(a<.003)discard;
            vec3 color=mix(vec3(.92,.93,.94),vColor,tricolor);
            color=mix(color,vec3(.92,.93,.94),vAge*.3);
            gl_FragColor=vec4(color,a);
        }`
    });
    // Connected camera-facing strips stay continuous from side and overhead views.
    const smoke = createLayeredSmoke(smokeGeometry, smokeMaterial);
    root.add(smoke.group);
    let time = 8,
        paused = false,
        activeSamples = count,
        lastSmoke = -Infinity;
    function render(quality = 'high') {
        jets.forEach(({ jet, gear, lights }, i) => {
            const state = sampleDisplay(time, i);
            jet.position.copy(state.position);
            jet.quaternion.copy(state.quaternion);
            gear.visible = state.gear > 0.01;
            gear.scale.y = Math.max(0.01, state.gear);
            gear.position.y = 1.35 * (1 - state.gear);
            lights.visible = state.gear > 0.9;
            // The trail head follows the nozzle every rendered frame, even
            // when the more expensive history reconstruction is throttled.
            const nozzle = new THREE.Vector3(-7, 1.5, 0)
                .applyQuaternion(state.quaternion).add(state.position);
            const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
            const head = i * activeSamples * 2;
            for (let edge = 0; edge < 2; edge++) {
                positions.set(nozzle.toArray(), (head + edge) * 3);
                tangents.set(direction.toArray(), (head + edge) * 3);
                ages[head + edge] = state.smoke ? 0 : 1;
            }
        });
        // Reconstruct finite history from the same clock, so seeking backwards
        // cannot leave trails connecting unrelated phases. Throttle to 10 Hz.
        smokeGeometry.attributes.position.needsUpdate = true;
        smokeGeometry.attributes.tangent.needsUpdate = true;
        smokeGeometry.attributes.age.needsUpdate = true;
        if (Math.abs(time - lastSmoke) < 0.1) return;
        lastSmoke = time;
        const samples = quality === 'low' ? 200 : count;
        activeSamples = samples;
        for (let i = 0; i < 6; i++) {
            for (let j = 0; j < samples; j++) {
                const age = j / (samples - 1),
                    state = sampleDisplay(time - age * history, i);
                const p = new THREE.Vector3(-7, 1.5, 0)
                    .applyQuaternion(state.quaternion)
                    .add(state.position);
                const index = (i * samples + j) * 2;
                const direction = new THREE.Vector3(1, 0, 0).applyQuaternion(state.quaternion);
                for (let edge = 0; edge < 2; edge++) {
                    positions.set(p.toArray(), (index + edge) * 3);
                    tangents.set(direction.toArray(), (index + edge) * 3);
                    ages[index + edge] = state.smoke ? age : 1;
                    colors.set(palette[i], (index + edge) * 3);
                    edges[index + edge] = edge === 0 ? -1 : 1;
                }
                if (j < samples - 1) {
                    indices.set([index, index + 1, index + 2, index + 1, index + 3, index + 2],
                        (i * (samples - 1) + j) * 6);
                }
            }
        }
        smokeGeometry.setDrawRange(0, 6 * (samples - 1) * 6);
        for (const attribute of Object.values(smokeGeometry.attributes)) attribute.needsUpdate = true;
        if (smokeGeometry.index) smokeGeometry.index.needsUpdate = true;
    }
    render();
    return {
        root,
        jets,
        duration: DISPLAY_DURATION,
        prepareCamera: smoke.update,
        /** @param {string} style */
        setSmokeStyle(style) {
            smokeMaterial.uniforms.tricolor.value = style === 'white' ? 0 : 1;
        },
        get time() {
            return time;
        },
        get paused() {
            return paused;
        },
        set paused(value) {
            paused = value;
        },
        get phase() {
            return sampleDisplay(time, 0).phase;
        },
        /** @param {number} value */
        seek(value) {
            time = wrapTime(value);
            lastSmoke = -Infinity;
            render();
        },
        /** @param {number} delta @param {boolean} running @param {string} quality */
        update(delta, running, quality) {
            if (!paused && running)
                time = wrapTime(time + Math.min(delta, 0.1));
            render(quality);
        },
        /** @param {number} [index] */
        target(index = 0) {
            root.updateMatrixWorld(true);
            return jets[index].jet.getWorldPosition(new THREE.Vector3());
        }
    };
}
