import * as THREE from 'three';

/** Regional cloud banks, distributed independently of the airfield.
 * @param {number} [seed]
 */
export function createCloudLayout(seed = 417) {
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const span = 28000;
    const puffs = [];
    for (let row = 0; row < 14; row++) {
        for (let col = 0; col < 14; col++) {
            const x = ((col + random()) / 14 - 0.5) * span;
            const z = ((row + random()) / 14 - 0.5) * span;
            const y = 420 + random() * 480;
            const breadth = 450 + random() * 650;
            const depth = 180 + random() * 300;
            const angle = random() * Math.PI * 2;
            const count = 10 + Math.floor(random() * 8);
            for (let i = 0; i < count; i++) {
                const a = (random() - 0.5) * breadth;
                const b = (random() - 0.5) * depth;
                const radius = breadth * (0.16 + random() * 0.17);
                // A shared flat base with taller billows toward the center.
                const rise =
                    (1 - (Math.abs(a) / breadth) * 2) * (45 + random() * 150);
                puffs.push({
                    x: x + a * Math.cos(angle) - b * Math.sin(angle),
                    z: z + a * Math.sin(angle) + b * Math.cos(angle),
                    y: y + rise,
                    width: radius * 2,
                    height: radius * (0.9 + random() * 0.55),
                    opacity: 0.52 + random() * 0.28,
                    variant: Math.floor(random() * 4)
                });
            }
        }
    }
    // Sparse high, stretched cloud banks add variation above the cumulus layer.
    for (let i = 0; i < 48; i++) {
        puffs.push({
            x: (random() - 0.5) * span,
            z: (random() - 0.5) * span,
            y: 1150 + random() * 450,
            width: 900 + random() * 1200,
            height: 100 + random() * 130,
            opacity: 0.25 + random() * 0.15,
            variant: Math.floor(random() * 4)
        });
    }
    return { span, puffs };
}

/** Four soft, irregular silhouettes, generated locally without image downloads. */
function createCloudTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cloud texture unavailable');
    let seed = 771;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    for (let variant = 0; variant < 4; variant++) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(variant * 256, 0, 256, 256);
        ctx.clip();
        for (let i = 0; i < 28; i++) {
            const x = variant * 256 + 128 + (random() - 0.5) * 105;
            const y = 128 + (random() - 0.5) * 74;
            const radius = 25 + random() * 46;
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(255,255,255,.36)');
            gradient.addColorStop(0.45, 'rgba(255,255,255,.26)');
            gradient.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    return texture;
}

/** Soft instanced billboards: one draw call, no cloud shadow maps or per-frame
 * instance uploads. Wind wrapping happens beyond the visible region.
 * @param {THREE.Scene} scene
 * @param {THREE.Texture} [texture]
 */
export function addClouds(scene, texture = createCloudTexture()) {
    const { span, puffs } = createCloudLayout();
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.setAttribute(
        'cloudOpacity',
        new THREE.InstancedBufferAttribute(
            new Float32Array(puffs.map((p) => p.opacity)),
            1
        )
    );
    geometry.setAttribute(
        'cloudVariant',
        new THREE.InstancedBufferAttribute(
            new Float32Array(puffs.map((p) => p.variant)),
            1
        )
    );
    const material = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: true,
        uniforms: {
            cloudMap: { value: texture },
            windOffset: { value: new THREE.Vector2() },
            observer: { value: new THREE.Vector2() },
            span: { value: span }
        },
        vertexShader: `
            attribute float cloudOpacity;
            attribute float cloudVariant;
            uniform vec2 windOffset;
            uniform vec2 observer;
            uniform float span;
            varying vec2 cloudUv;
            varying float opacity;
            varying float distanceToCloud;
            void main() {
                vec3 center = instanceMatrix[3].xyz;
                center.xz = mod(center.xz + windOffset - observer + span * .5,span) - span * .5 + observer;
                vec4 viewCenter = modelViewMatrix * vec4(center,1.0);
                distanceToCloud = length(viewCenter.xyz);
                vec2 size = vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
                viewCenter.xy += position.xy * size;
                gl_Position = projectionMatrix * viewCenter;
                cloudUv = vec2((uv.x + cloudVariant) / 4.0, uv.y);
                opacity = cloudOpacity;
            }`,
        fragmentShader: `
            uniform sampler2D cloudMap;
            varying vec2 cloudUv;
            varying float opacity;
            varying float distanceToCloud;
            void main() {
                float alpha = texture2D(cloudMap,cloudUv).a * opacity;
                alpha *= smoothstep(35.0,180.0,distanceToCloud);
                alpha *= 1.0-smoothstep(7500.0,12500.0,distanceToCloud);
                if(alpha < .003) discard;
                vec3 shade = mix(vec3(.65,.73,.80),vec3(1.0,.98,.94),smoothstep(.12,.82,cloudUv.y));
                gl_FragColor = vec4(shade,alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }`
    });
    const clouds = new THREE.InstancedMesh(geometry, material, puffs.length);
    clouds.name = 'Regional wind-driven clouds';
    const transform = new THREE.Object3D();
    puffs.forEach((p, i) => {
        transform.position.set(p.x, p.y, p.z);
        transform.scale.set(p.width, p.height, 1);
        transform.updateMatrix();
        clouds.setMatrixAt(i, transform.matrix);
    });
    clouds.instanceMatrix.needsUpdate = true;
    // Shader wrapping keeps a field around the observer, so CPU bounds are stale.
    clouds.frustumCulled = false;
    clouds.renderOrder = 2;
    scene.add(clouds);
    let elapsed = 0;
    return {
        /** @param {number} delta @param {THREE.Vector3} position */
        update(delta, position) {
            elapsed =
                (elapsed + Math.max(0, Math.min(delta, 0.25))) % (span * 10);
            // Light westerly wind: 3 m/s east, 1 m/s north. No change to flight forces.
            material.uniforms.windOffset.value.set(elapsed * 3, -elapsed);
            material.uniforms.observer.value.set(position.x, position.z);
        }
    };
}
