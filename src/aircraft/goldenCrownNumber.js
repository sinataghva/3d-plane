import * as THREE from 'three';

/** Fit the actual glyph ink, including wider Persian digits, inside the decal.
 * @param {number} number @param {number} side */
export function createGoldenCrownNumber(number, side) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to draw display numbers');
    const text = side < 0 ? String(number) : '۱۲۳۴۵۶'[number - 1];
    ctx.font = 'bold 300px serif';
    const metrics = ctx.measureText(text);
    const width =
        metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight;
    const height =
        metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const scale = Math.min(224 / width, 340 / height);
    ctx.translate(128, 192);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#172128';
    ctx.fillText(
        text,
        (metrics.actualBoundingBoxLeft - metrics.actualBoundingBoxRight) / 2,
        (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
    );
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
}
