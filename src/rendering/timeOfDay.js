import * as THREE from 'three';

export const TIME_OF_DAY = {
    day: {
        sky: ['#78b7ee', '#c7e4ff', '#edf6ff', '#f7f1dc'],
        fog: 0xd9edf7,
        skyLight: 0xcfe8ff,
        groundLight: 0x496238,
        ambient: 1.15,
        sun: 0xfff2c7,
        intensity: 1.75,
        exposure: 1.08,
        offset: [70, 110, -80],
        clouds: 0xffffff
    },
    sunset: {
        sky: ['#334878', '#c57885', '#ffc08b', '#eeb47f'],
        fog: 0xc99689,
        skyLight: 0xa8a9df,
        groundLight: 0x69554a,
        ambient: 0.75,
        sun: 0xffa055,
        intensity: 1.5,
        exposure: 1.0,
        offset: [115, 30, -80],
        clouds: 0xe6ac98
    },
    night: {
        sky: ['#050c20', '#101d38', '#263652', '#283a50'],
        fog: 0x182941,
        skyLight: 0x7692c2,
        groundLight: 0x253348,
        ambient: 0.42,
        sun: 0xb5d2ff,
        intensity: 0.42,
        exposure: 0.85,
        offset: [70, 110, -80],
        clouds: 0x435779
    }
};
/** @param {unknown} value @returns {'day'|'sunset'|'night'} */
export function timeOfDay(value) {
    return value === 'sunset' || value === 'night' ? value : 'day';
}

/** Decorative night aids follow mapped runway geometry, not surveyed lighting plans.
 * @param {import('../scenery/geography.js').Geography} world */
export function createRunwayLights(world) {
    const positions = [],
        colors = [];
    const white = new THREE.Color(0xffedbe),
        green = new THREE.Color(0x64ff98);
    for (const runway of world.runways) {
        const a = runway.points[0],
            b = runway.points[runway.points.length - 1];
        const dx = b[0] - a[0],
            dz = b[1] - a[1],
            length = Math.hypot(dx, dz);
        if (length < 1) continue;
        const width = (runway.width || 40) / 2 + 1;
        const count = Math.ceil(length / 60);
        for (let i = 0; i <= count; i++)
            for (const side of [-1, 1]) {
                const x =
                    a[0] + (dx * i) / count - (dz / length) * width * side;
                const z =
                    a[1] + (dz * i) / count + (dx / length) * width * side;
                positions.push(x, world.height(x, z) + 0.7, z);
                colors.push(white.r, white.g, white.b);
            }
        for (const end of [a, b])
            for (let i = -2; i <= 2; i++) {
                const x = end[0] - ((dz / length) * width * i) / 2,
                    z = end[1] + ((dx / length) * width * i) / 2;
                positions.push(x, world.height(x, z) + 0.7, z);
                colors.push(green.r, green.g, green.b);
            }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
        vertexColors: true,
        size: 4,
        sizeAttenuation: false,
        transparent: true,
        depthWrite: false,
        toneMapped: false
    });
    material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <clipping_planes_fragment>',
            `#include <clipping_planes_fragment>
        if (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;`
        );
    };
    const lights = new THREE.Points(geometry, material);
    lights.name = 'Decorative runway night lights';
    lights.visible = false;
    return lights;
}
