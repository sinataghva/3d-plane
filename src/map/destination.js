import * as THREE from 'three';
/** @typedef {{x:number,y:number,z:number}} Destination */
/** @type {Destination|null} */
let destination = null;
export function getDestination() {
    return destination ? { ...destination } : null;
}
export function clearDestination() {
    destination = null;
}
/** @param {number} x @param {number} z @param {(x:number,z:number)=>number} height */
export function setDestination(x, z, height) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return;
    destination = { x, z, y: height(x, z) };
}
/** Shared projection for drawing and hit testing. @param {number} width @param {number} height @param {{minX:number,minZ:number,width:number,depth:number}} world @param {import('./mapViewport.js').MapView} [view] */
export function destinationProjection(
    width,
    height,
    world,
    view = { zoom: 1, panX: 0, panY: 0 }
) {
    const scale =
        Math.min((width - 24) / world.width, (height - 32) / world.depth) *
        view.zoom;
    const w = world.width * scale,
        h = world.depth * scale,
        left = (width - w) / 2 + view.panX,
        top = (height - h) / 2 + view.panY;
    return {
        scale,
        w,
        h,
        left,
        top,
        /** @param {number} x @param {number} z */
        point: (x, z) => ({
            x: left + (x - world.minX) * scale,
            y: top + (z - world.minZ) * scale
        }),
        /** @param {number} x @param {number} y */
        unproject: (x, y) =>
            x < left || x > left + w || y < top || y > top + h
                ? null
                : {
                      x: world.minX + (x - left) / scale,
                      z: world.minZ + (y - top) / scale
                  }
    };
}
/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y */
export function drawDestinationPin(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#ff3b42';
    ctx.strokeStyle = '#fff1ec';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -12);
    ctx.arc(0, -12, 7, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}
/** @param {THREE.Scene} scene */
export function createDestinationBeacon(scene) {
    clearDestination();
    const group = new THREE.Group();
    group.name = 'destination-beacon';
    scene.add(group);
    const material = new THREE.MeshBasicMaterial({
        color: 0xff303b,
        depthTest: false,
        depthWrite: false,
        fog: false
    });
    const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.7, 1, 6),
        material
    );
    const tip = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 8), material);
    tip.rotation.z = Math.PI;
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(5, 0.8, 6, 20),
        material
    );
    ring.rotation.x = Math.PI / 2;
    group.add(stem, tip, ring);
    group.traverse((o) => (o.renderOrder = 100));
    const label = document.createElement('div');
    label.id = 'destination-guidance';
    label.hidden = true;
    label.innerHTML = '<span aria-hidden="true">▲</span><b></b>';
    document.body.append(label);
    const arrow = /** @type {HTMLElement} */ (label.querySelector('span'));
    const text = /** @type {HTMLElement} */ (label.querySelector('b'));
    const point = new THREE.Vector3(),
        local = new THREE.Vector3();
    return {
        /** @param {THREE.Camera} camera @param {{x:number,y:number,z:number}} position */
        update(camera, position) {
            camera.updateMatrixWorld();
            const d = destination;
            group.visible = Boolean(d);
            label.hidden = !d;
            if (!d) return;
            group.position.set(d.x, d.y, d.z);
            const distance = Math.hypot(
                d.x - position.x,
                d.y - position.y,
                d.z - position.z
            );
            const size = THREE.MathUtils.clamp(
                camera.position.distanceTo(group.position) / 300,
                1,
                15
            );
            const stemHeight = Math.min(80, size * 15);
            stem.scale.set(1, stemHeight, 1);
            stem.position.y = stemHeight / 2;
            tip.scale.setScalar(size);
            tip.position.y = stemHeight + 6 * size;
            ring.scale.setScalar(size);
            ring.position.y = 0.8;
            point.set(d.x, d.y + stemHeight + size * 14, d.z);
            local.copy(point).applyMatrix4(camera.matrixWorldInverse);
            point.project(camera);
            const visible =
                local.z < 0 &&
                Math.abs(point.x) < 0.85 &&
                Math.abs(point.y) < 0.8;
            let x = point.x,
                y = -point.y;
            if (!visible) {
                x = local.x;
                y = -local.y;
                if (Math.hypot(x, y) < 0.001) y = 1;
                const scale = Math.max(Math.abs(x) / 0.8, Math.abs(y) / 0.72);
                x /= scale;
                y /= scale;
            }
            // Reserve room for the complete distance label on narrow screens.
            const limitX = Math.max(0.1, 1 - 190 / window.innerWidth);
            x = THREE.MathUtils.clamp(x, -limitX, limitX);
            y = THREE.MathUtils.clamp(y, -0.8, 0.8);
            label.style.left = `${50 + x * 50}%`;
            label.style.top = `${50 + y * 50}%`;
            arrow.hidden = visible;
            arrow.style.transform = `rotate(${(Math.atan2(y, x) * 180) / Math.PI + 90}deg)`;
            label.dataset.edge = String(!visible);
            text.textContent = `Destination · ${distance >= 1000 ? (distance / 1000).toFixed(1) + ' km' : Math.round(distance) + ' m'}`;
        },
        dispose() {
            label.remove();
            scene.remove(group);
            stem.geometry.dispose();
            tip.geometry.dispose();
            ring.geometry.dispose();
            material.dispose();
            clearDestination();
        }
    };
}
