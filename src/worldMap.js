import { createMapViewport } from './mapViewport.js';
import {
    getDestination,
    setDestination,
    clearDestination,
    drawDestinationPin
} from './destination.js';
import { getGeography } from './geography.js';
import { drawOverview } from './geographicMap.js';
import { formatHeading } from './hud.js';

const WORLD_WIDTH = 4200;
const WORLD_LENGTH = 5200;

/** Fixed north-up projection, independent of the aircraft position. */
export function mapProjection(width = 800, height = 600) {
    const scale = Math.min(
        (width - 72) / WORLD_WIDTH,
        (height - 60) / WORLD_LENGTH
    );
    return {
        scale,
        /** @param {number} x @param {number} z */
        point: (x, z) => ({
            x: width / 2 + x * scale,
            y: height / 2 + z * scale
        })
    };
}

/** @param {import('./physics.js').PlaneState} planeState */
export function createWorldMap(planeState) {
    const dialog = /** @type {HTMLDialogElement} */ (
        document.getElementById('world-map')
    );
    const canvas = /** @type {HTMLCanvasElement} */ (
        document.getElementById('world-map-canvas')
    );
    const geography = getGeography();
    if (geography)
        canvas.setAttribute(
            'aria-label',
            `North-up ${geography.data.airfield?.includes('LFSX') ? 'Luxeuil · LFSX' : 'Saint-Cyr–Versailles · Château de Versailles · Saint-Cyr airfield'} map with your aircraft position and heading. Towns: ` +
                geography.data.places
                    .filter((p) => ['city', 'town', 'village'].includes(p.kind))
                    .map((p) => p.name)
                    .join(', ')
        );
    const context = canvas.getContext('2d');
    if (!context) throw new Error('World map canvas unavailable');
    const ctx = context;
    const trigger = /** @type {HTMLElement} */ (
        document.getElementById('mini-map')
    );
    const readout = /** @type {HTMLElement} */ (
        document.getElementById('world-map-position')
    );
    const clear = document.createElement('button');
    clear.id = 'clear-destination';
    clear.textContent = 'Clear destination';
    clear.disabled = true;
    dialog
        .querySelector('header')
        ?.insertBefore(clear, document.getElementById('close-world-map'));
    const hint = document.createElement('span');
    hint.id = 'destination-map-status';
    hint.textContent = 'Click or tap the map to choose a destination';
    dialog.querySelector('footer')?.append(hint);
    clear.onclick = () => {
        clearDestination();
        draw();
    };
    const bounds = geography ?? {
        minX: -WORLD_WIDTH / 2,
        minZ: -WORLD_LENGTH / 2,
        width: WORLD_WIDTH,
        depth: WORLD_LENGTH
    };
    const viewport = createMapViewport(800, 600, bounds);
    const navigation = document.createElement('div');
    navigation.id = 'map-navigation';
    navigation.innerHTML =
        '<button id="map-zoom-out" aria-label="Zoom out">−</button><output id="map-zoom-level"></output><button id="map-zoom-in" aria-label="Zoom in">+</button><button id="map-fit">Fit map</button>';
    dialog.querySelector('header')?.append(navigation);
    const zoomIn = /** @type {HTMLButtonElement} */ (
        navigation.querySelector('#map-zoom-in')
    );
    const zoomOut = /** @type {HTMLButtonElement} */ (
        navigation.querySelector('#map-zoom-out')
    );
    const zoomLevel = /** @type {HTMLOutputElement} */ (
        navigation.querySelector('output')
    );
    function resizeView() {
        viewport.resize(canvas.clientWidth, canvas.clientHeight);
    }
    function zoom(
        /** @type {number} */ factor,
        x = canvas.clientWidth / 2,
        y = canvas.clientHeight / 2
    ) {
        resizeView();
        viewport.zoomAt(factor, x, y);
        draw();
    }
    zoomIn.onclick = () =>
        zoom((viewport.view.zoom + 0.2) / viewport.view.zoom);
    zoomOut.onclick = () =>
        zoom((viewport.view.zoom - 0.2) / viewport.view.zoom);
    navigation.querySelector('#map-fit')?.addEventListener('click', () => {
        viewport.reset();
        draw();
    });
    const pointers = new Map();
    let moved = false;
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (!pointers.size) moved = false;
        pointers.set(e.pointerId, {
            x: e.clientX,
            y: e.clientY,
            startX: e.clientX,
            startY: e.clientY
        });
        if (pointers.size > 1) moved = true;
        canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
        const previous = pointers.get(e.pointerId);
        if (!previous) return;
        const before = [...pointers.values()];
        const oldCenter =
            before.length === 2
                ? {
                      x: (before[0].x + before[1].x) / 2,
                      y: (before[0].y + before[1].y) / 2
                  }
                : null;
        const oldDistance =
            before.length === 2
                ? Math.hypot(
                      before[0].x - before[1].x,
                      before[0].y - before[1].y
                  )
                : 0;
        if (
            Math.hypot(
                e.clientX - previous.startX,
                e.clientY - previous.startY
            ) > 6
        )
            moved = true;
        const dx = e.clientX - previous.x,
            dy = e.clientY - previous.y;
        pointers.set(e.pointerId, { ...previous, x: e.clientX, y: e.clientY });
        if (!moved) return;
        resizeView();
        const points = [...pointers.values()];
        if (points.length === 2 && oldCenter && oldDistance > 0) {
            const x = (points[0].x + points[1].x) / 2,
                y = (points[0].y + points[1].y) / 2;
            viewport.pan(x - oldCenter.x, y - oldCenter.y);
            const rect = canvas.getBoundingClientRect();
            viewport.zoomAt(
                Math.hypot(
                    points[0].x - points[1].x,
                    points[0].y - points[1].y
                ) / oldDistance,
                x - rect.left,
                y - rect.top
            );
        } else viewport.pan(dx, dy);
        draw();
    });
    canvas.addEventListener('pointerup', (e) => {
        pointers.delete(e.pointerId);
    });
    for (const event of ['pointercancel', 'lostpointercapture'])
        canvas.addEventListener(event, (e) => {
            if (!(e instanceof PointerEvent)) return;
            if (pointers.has(e.pointerId)) {
                moved = true;
                pointers.delete(e.pointerId);
            }
        });
    canvas.addEventListener(
        'wheel',
        (e) => {
            e.preventDefault();
            moved = true;
            const rect = canvas.getBoundingClientRect();
            const delta =
                e.deltaY *
                (e.deltaMode === 1
                    ? 16
                    : e.deltaMode === 2
                      ? canvas.clientHeight
                      : 1);
            zoom(
                Math.exp(
                    Math.max(
                        -0.5,
                        Math.min(0.5, delta * (e.ctrlKey ? -0.008 : 0.002))
                    )
                ),
                e.clientX - rect.left,
                e.clientY - rect.top
            );
        },
        { passive: false }
    );
    // Safari trackpad pinch uses gesture events rather than Ctrl-wheel.
    let gestureScale = 1;
    canvas.addEventListener('gesturestart', (e) => {
        e.preventDefault();
        moved = true;
        gestureScale = 1;
    });
    canvas.addEventListener('gesturechange', (e) => {
        e.preventDefault();
        const scale = Number(Reflect.get(e, 'scale'));
        if (!Number.isFinite(scale) || scale <= 0) return;
        const rect = canvas.getBoundingClientRect();
        zoom(
            scale / gestureScale,
            Number(Reflect.get(e, 'clientX') ?? rect.left + rect.width / 2) -
                rect.left,
            Number(Reflect.get(e, 'clientY') ?? rect.top + rect.height / 2) -
                rect.top
        );
        gestureScale = scale;
    });
    canvas.addEventListener('click', (event) => {
        if (moved) return;
        resizeView();
        const rect = canvas.getBoundingClientRect();
        const p = viewport
            .projection()
            .unproject(event.clientX - rect.left, event.clientY - rect.top);
        if (p) setDestination(p.x, p.z, (x, z) => geography?.height(x, z) ?? 0);
        draw();
    });
    let held = false;
    let keyOpened = false;
    /** @type {HTMLElement | null} */
    let previousFocus = null;
    function close() {
        keyOpened = false;
        pointers.clear();
        moved = true;
        dialog.close();
        previousFocus?.focus({ preventScroll: true });
    }
    function open() {
        if (dialog.open) return;
        previousFocus =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        dialog.showModal();
        draw();
    }
    trigger.addEventListener('click', open);
    trigger.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            open();
        }
    });
    document
        .getElementById('close-world-map')
        ?.addEventListener('click', close);
    dialog.addEventListener('cancel', (event) => {
        event.preventDefault();
        close();
    });
    window.addEventListener('keydown', (event) => {
        const target = event.target;
        if (
            event.code !== 'KeyM' ||
            event.repeat ||
            held ||
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            (target instanceof HTMLElement &&
                (target.isContentEditable ||
                    /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        )
            return;
        event.preventDefault();
        held = true;
        keyOpened = !dialog.open;
        open();
    });
    window.addEventListener('keyup', (event) => {
        if (event.code !== 'KeyM') return;
        held = false;
        if (keyOpened) close();
    });
    const release = () => {
        held = false;
        if (keyOpened) close();
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) release();
    });

    function draw() {
        if (!dialog.open) return;
        const destination = getDestination();
        clear.disabled = !destination;
        hint.textContent = destination
            ? 'Destination selected · click elsewhere to move it'
            : 'Click or tap the map to choose a destination';
        canvas.dataset.destination = destination
            ? JSON.stringify(destination)
            : '';
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        if (width < 80 || height < 80) return;
        resizeView();
        zoomIn.disabled = viewport.view.zoom >= viewport.maxZoom() - 0.001;
        zoomOut.disabled = viewport.view.zoom <= 1.001;
        zoomLevel.textContent = `${Math.round(viewport.view.zoom * 100)}%`;
        canvas.dataset.zoom = String(viewport.view.zoom);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (
            canvas.width !== Math.round(width * dpr) ||
            canvas.height !== Math.round(height * dpr)
        ) {
            canvas.width = Math.round(width * dpr);
            canvas.height = Math.round(height * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const world = getGeography();
        if (world) {
            readout.textContent = drawOverview(
                ctx,
                width,
                height,
                planeState,
                world,
                viewport.view
            );
            return;
        }
        ctx.fillStyle = '#10242d';
        ctx.fillRect(0, 0, width, height);
        const { scale, point } = viewport.projection();
        /** @param {number} x @param {number} z @param {number} w @param {number} h @param {string} color */
        const rect = (x, z, w, h, color) => {
            const p = point(x - w / 2, z - h / 2);
            ctx.fillStyle = color;
            ctx.fillRect(p.x, p.y, w * scale, h * scale);
        };
        rect(0, 0, WORLD_WIDTH, WORLD_LENGTH, '#31584a');
        rect(-660, -320, 680, 1250, '#294d42');
        rect(720, 520, 920, 820, '#406450');
        rect(-480, 940, 520, 720, '#294d42');
        rect(420, -920, 760, 420, '#406450');
        ctx.strokeStyle = '#73958840';
        ctx.lineWidth = 1;
        for (let x = -2000; x <= 2000; x += 500) {
            const a = point(x, -2600),
                b = point(x, 2600);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (let z = -2500; z <= 2500; z += 500) {
            const a = point(-2100, z),
                b = point(2100, z);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        for (const [x, z, r] of [
            [-1350, 1250, 220],
            [-940, -1560, 180],
            [620, 1670, 260],
            [1380, -1180, 210],
            [1680, 740, 170]
        ]) {
            const p = point(x, z);
            ctx.fillStyle = '#557762';
            ctx.beginPath();
            ctx.ellipse(
                p.x,
                p.y,
                r * 1.45 * scale,
                r * 0.82 * scale,
                0,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }
        rect(-86, -48, 105, 74, '#93a6a2');
        rect(-42, -48, 92, 36, '#839491');
        const start = point(0, -150),
            end = point(0, 150);
        ctx.strokeStyle = '#edf2dc';
        ctx.lineWidth = Math.max(3, 20 * scale);
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
        ctx.font = '12px system-ui';
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f1f6ed';
        ctx.fillText('AIRFIELD · 18 / 36', end.x + 12, end.y + 18);
        ctx.fillStyle = '#b8d5cc';
        ctx.textAlign = 'center';
        ctx.fillText('N ↑', width / 2, 19);
        ctx.textAlign = 'left';
        ctx.fillText('500 m grid', 16, height - 12);
        const px = Math.max(-2100, Math.min(2100, planeState.position.x));
        const pz = Math.max(-2600, Math.min(2600, planeState.position.z));
        const p = point(px, pz);
        const outside =
            px !== planeState.position.x || pz !== planeState.position.z;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(Math.PI / 2 - planeState.yawAngle);
        ctx.shadowColor = '#081a22';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (const [i, [x, y]] of [
            [0, -15],
            [3, -10],
            [3, -3],
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
            [-3, -3],
            [-3, -10]
        ].entries()) {
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = '#ffd166';
        ctx.fill();
        ctx.strokeStyle = '#fff7d5';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
        if (destination) {
            const p = point(destination.x, destination.z);
            drawDestinationPin(ctx, p.x, p.y);
        }
        readout.textContent = `You · heading ${formatHeading(planeState.yawAngle)}° · ${Math.round(planeState.position.x)} m E / ${Math.round(-planeState.position.z)} m N${outside ? ' · Outside mapped terrain (marker at edge)' : ''}`;
    }
    return {
        update: draw,
        resetView() {
            viewport.reset();
            draw();
        }
    };
}
