import * as THREE from 'three';

// Transcribed from the user-supplied Golden Crown decal reference, by display number.
export const GOLDEN_CROWN_SERIALS = [
    '3-7099',
    '3-7015',
    '3-7046',
    '3-7078',
    '3-7079',
    '3-7136',
    '3-7137',
    '3-7101'
];
/** @param {number} number @param {number} side */
export function goldenCrownSerial(number, side) {
    const serial = GOLDEN_CROWN_SERIALS[number - 1];
    if (!serial) throw new RangeError('Unknown Golden Crown aircraft number');
    return side < 0
        ? serial
        : serial.replace(/[0-9]/g, (digit) => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}
/** @param {number} number @param {number} side */
export function createGoldenCrownSerial(number, side) {
    const text = goldenCrownSerial(number, side);
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round((1024 * 0.14) / 0.62);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to draw aircraft serial');
    ctx.fillStyle = '#172128';
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${canvas.height * 0.8}px Arial`;
    ctx.fillText(text, 512, canvas.height * 0.54, 990);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    material.userData.serial = text;
    return material;
}
