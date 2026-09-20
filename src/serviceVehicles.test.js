import { expect, test } from 'vitest';
import { createVehicleGeometry } from './serviceVehicles.js';
for (const military of [false, true])
    for (const type of ['van', 'tug', 'fuel truck']) {
        test(`${military ? 'military' : 'civilian'} ${type} fits the placement envelope`, () => {
            const geometry = createVehicleGeometry(type, military);
            const positions = geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
                expect(Number.isFinite(positions.getY(i))).toBe(true);
                expect(positions.getY(i)).toBeGreaterThanOrEqual(-0.001);
                expect(
                    Math.hypot(positions.getX(i), positions.getZ(i))
                ).toBeLessThan(4);
            }
            geometry.dispose();
        });
    }
