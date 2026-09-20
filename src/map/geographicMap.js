import {
    destinationProjection,
    getDestination,
    drawDestinationPin
} from './destination.js';
import { jetWaypoints } from '../flight/jetNavigation.js';
import { createGeographicCanvas } from './cartography.js';
import { formatHeading } from '../ui/hud.js';
/** @type {WeakMap<import('../scenery/geography.js').Geography, HTMLCanvasElement>} */
const canvases = new WeakMap();
/** @param {import('../scenery/geography.js').Geography} world */
export function mapImage(world) {
    let canvas = canvases.get(world);
    if (!canvas) {
        canvas = createGeographicCanvas(world, 2048, true);
        canvases.set(world, canvas);
    }
    return canvas;
}
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} yaw @param {number} [size] */
export function drawAircraft(ctx, x, y, yaw, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 2 - yaw);
    ctx.scale(size, size);
    ctx.shadowColor = '#142524';
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffd166';
    ctx.strokeStyle = '#fff7d5';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    for (const [a, b] of [
        [3, -4],
        [13, 5],
        [13, 8],
        [3, 4],
        [3, 11],
        [7, 14],
        [7, 16],
        [0, 13],
        [-7, 16],
        [-7, 14],
        [-3, 11],
        [-3, 4],
        [-13, 8],
        [-13, 5],
        [-3, -4]
    ])
        ctx.lineTo(a, b);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
/** @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height @param {import('../flight/physics.js').PlaneState} state @param {import('../scenery/geography.js').Geography} world @param {import('./mapViewport.js').MapView} [view] */
export function drawOverview(ctx, width, height, state, world, view) {
    const { scale, w, h, left, top } = destinationProjection(
        width,
        height,
        world,
        view
    );
    ctx.fillStyle = '#10242d';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(mapImage(world), left, top, w, h);
    /** @param {number[]} p */
    const project = (p) => [
        left + (p[0] - world.minX) * scale,
        top + (p[1] - world.minZ) * scale
    ];
    /** @type {{name:string,point:number[],priority:number}[]} */
    const labels = world.data.places
        .filter((p) =>
            [
                'city',
                'town',
                'village',
                ...((view?.zoom ?? 1) > 1.5 ? ['hamlet', 'suburb'] : [])
            ].includes(p.kind)
        )
        .map((p) => ({ ...p, priority: p.kind === 'city' ? 2 : 3 }));
    labels.unshift({
        name: world.data.airfield || 'Saint-Cyr · LFPZ',
        point: [world.spawn.x, world.spawn.z],
        priority: 0
    });
    const palace = world.data.features.find((f) => f.palace);
    if (palace)
        labels.unshift({
            name: 'Château de Versailles',
            point: palace.points[0],
            priority: 1
        });
    if (
        state.aircraft === 'mirage' &&
        document.getElementById('guide-mode') instanceof HTMLSelectElement &&
        /** @type {HTMLSelectElement} */ (document.getElementById('guide-mode'))
            .value === 'circuit'
    ) {
        jetWaypoints(world).forEach((p, i) =>
            labels.push({
                name: `${i + 1} · ${p.name}`,
                point: [p.x, p.z],
                priority: 1
            })
        );
    }
    labels.sort((a, b) => a.priority - b.priority);
    /** @type {number[][]} */ const boxes = [];
    ctx.font = `${height < 400 ? 11 : 13}px system-ui`;
    for (const label of labels) {
        const [x, y] = project(label.point),
            textWidth = ctx.measureText(label.name).width;
        if (x < 0 || x > width || y < 0 || y > height) continue;
        const tx = Math.max(4, Math.min(width - textWidth - 8, x + 7));
        for (const offset of [-10, 18, 34]) {
            const ty = y + offset,
                box = [tx - 3, ty - 13, tx + textWidth + 3, ty + 4];
            if (
                ty < 15 ||
                ty > height - 10 ||
                boxes.some(
                    (b) =>
                        box[0] < b[2] &&
                        box[2] > b[0] &&
                        box[1] < b[3] &&
                        box[3] > b[1]
                )
            )
                continue;
            ctx.fillStyle = '#10242ddd';
            ctx.fillRect(box[0], box[1], box[2] - box[0], box[3] - box[1]);
            ctx.fillStyle = label.priority < 2 ? '#ffe3a0' : '#fff';
            ctx.textAlign = 'left';
            ctx.fillText(label.name, tx, ty);
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();
            boxes.push(box);
            break;
        }
    }
    const x = Math.max(world.minX, Math.min(world.maxX, state.position.x)),
        z = Math.max(world.minZ, Math.min(world.maxZ, state.position.z));
    const p = project([x, z]);
    drawAircraft(ctx, p[0], p[1], state.yawAngle, height < 400 ? 0.75 : 1);
    ctx.fillStyle = '#edf5f1';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('N ↑', 16, 24);
    const desired = 100 / scale;
    const power = 10 ** Math.floor(Math.log10(desired));
    const meters =
        ([1, 2, 5, 10].find((n) => n * power >= desired) ?? 10) * power;
    ctx.fillStyle = '#10242ddd';
    ctx.fillRect(10, height - 44, meters * scale + 16, 36);
    ctx.fillStyle = '#edf5f1';
    ctx.fillRect(18, height - 15, meters * scale, 2);
    ctx.fillText(
        meters >= 1000 ? `${meters / 1000} km` : `${meters} m`,
        18,
        height - 24
    );
    const destination = getDestination();
    if (destination) {
        const p = project([destination.x, destination.z]);
        drawDestinationPin(ctx, p[0], p[1]);
    }
    const outside = x !== state.position.x || z !== state.position.z;
    const east = (state.position.x - world.spawn.x) / 1000,
        north = (world.spawn.z - state.position.z) / 1000;
    return `Heading ${formatHeading(state.yawAngle)}° · ${Math.abs(east).toFixed(1)} km ${east < 0 ? 'W' : 'E'} / ${Math.abs(north).toFixed(1)} km ${north < 0 ? 'S' : 'N'} of airfield${outside ? ' · Outside detailed area' : ''}`;
}
/** @param {CanvasRenderingContext2D} ctx @param {number} size @param {import('../flight/physics.js').PlaneState} state @param {import('../scenery/geography.js').Geography} world */
export function drawRadar(ctx, size, state, world) {
    const scale = size / (state.aircraft === 'mirage' ? 8000 : 1800);
    ctx.fillStyle = '#10242d';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(state.yawAngle - Math.PI / 2);
    ctx.drawImage(
        mapImage(world),
        (world.minX - state.position.x) * scale,
        (world.minZ - state.position.z) * scale,
        world.width * scale,
        world.depth * scale
    );
    ctx.restore();
    const destination = getDestination();
    if (destination) {
        const dx = (destination.x - state.position.x) * scale,
            dz = (destination.z - state.position.z) * scale;
        const angle = state.yawAngle - Math.PI / 2;
        let x = dx * Math.cos(angle) - dz * Math.sin(angle),
            y = dx * Math.sin(angle) + dz * Math.cos(angle);
        const factor = Math.min(
            1,
            (size / 2 - 18) / Math.max(1, Math.hypot(x, y))
        );
        x *= factor;
        y *= factor;
        drawDestinationPin(ctx, size / 2 + x, size / 2 + y);
    }
    drawAircraft(ctx, size / 2, size / 2, Math.PI / 2, 0.48);
}
