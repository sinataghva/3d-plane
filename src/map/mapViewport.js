import { destinationProjection } from './destination.js';
/** @typedef {{zoom:number,panX:number,panY:number}} MapView */
/** @param {number} width @param {number} height @param {{minX:number,minZ:number,width:number,depth:number}} world @param {number} [zoomLimit] */
export function createMapViewport(width, height, world, zoomLimit = 4) {
    const view = { zoom: 1, panX: 0, panY: 0 };
    let w = width,
        h = height;
    const base = () => destinationProjection(w, h, world);
    const maxZoom = () => zoomLimit;
    function constrain() {
        view.zoom = Math.max(1, Math.min(maxZoom(), view.zoom));
        const b = base();
        const mx = Math.max(0, (b.w * view.zoom - w) / 2),
            my = Math.max(0, (b.h * view.zoom - h) / 2);
        view.panX = Math.max(-mx, Math.min(mx, view.panX));
        view.panY = Math.max(-my, Math.min(my, view.panY));
    }
    return {
        view,
        maxZoom,
        projection: () => destinationProjection(w, h, world, view),
        /** @param {number} width @param {number} height */
        resize(width, height) {
            w = width;
            h = height;
            constrain();
        },
        reset() {
            view.zoom = 1;
            view.panX = view.panY = 0;
        },
        /** @param {number} dx @param {number} dy */
        pan(dx, dy) {
            view.panX += dx;
            view.panY += dy;
            constrain();
        },
        /** @param {number} factor @param {number} x @param {number} y */
        zoomAt(factor, x, y) {
            const old = view.zoom;
            const zoom = Math.max(1, Math.min(maxZoom(), old * factor));
            view.panX = (view.panX - (x - w / 2)) * (zoom / old) + (x - w / 2);
            view.panY = (view.panY - (y - h / 2)) * (zoom / old) + (y - h / 2);
            view.zoom = zoom;
            constrain();
        }
    };
}
