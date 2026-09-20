import { expect, test } from 'vitest';
import { createMapViewport } from './mapViewport.js';
const world = { minX: -12000, minZ: -10000, width: 25000, depth: 22000 };
test('zoom respects the 400% cap, fit minimum, anchoring and coordinate inversion', () => {
    const v = createMapViewport(1000, 700, world);
    const before = v.projection().unproject(550, 370);
    if (!before) throw new Error('Missing projection');
    v.zoomAt(1.5, 550, 370);
    expect(v.projection().unproject(550, 370)?.x).toBeCloseTo(before.x);
    expect(v.projection().unproject(550, 370)?.z).toBeCloseTo(before.z);
    v.zoomAt(100, 500, 350);
    expect(v.view.zoom).toBe(v.maxZoom());
    expect(v.view.zoom).toBe(4);
    v.pan(1e6, -1e6);
    expect(v.projection().left).toBeLessThanOrEqual(1e-9);
    expect(v.projection().top + v.projection().h).toBeGreaterThanOrEqual(
        700 - 1e-9
    );
    v.zoomAt(0.001, 0, 0);
    expect(v.view.zoom).toBe(1);
    expect(Math.abs(v.view.panX)).toBe(0);
    expect(Math.abs(v.view.panY)).toBe(0);
});
test('resize constrains view and reset restores default', () => {
    const v = createMapViewport(390, 600, world);
    v.zoomAt(3, 195, 300);
    v.pan(80, 50);
    v.resize(1400, 1000);
    expect(v.view.zoom).toBeLessThanOrEqual(v.maxZoom());
    v.reset();
    expect(v.view.zoom).toBe(1);
    expect(Math.abs(v.view.panX)).toBe(0);
    expect(Math.abs(v.view.panY)).toBe(0);
});
