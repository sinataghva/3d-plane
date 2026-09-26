import { expect, test } from 'vitest';
import {
    pavedAirfieldDefault,
    pavedAirfieldSurface
} from './surfaceFeatures.js';

test('Mehrabad and Luxeuil default untagged airfield surfaces to pavement; Saint-Cyr does not', () => {
    for (const [airfield, expected] of /** @type {[string, boolean][]} */ ([
        ['Mehrabad · OIII', true],
        ['Luxeuil · LFSX', true],
        ['Saint-Cyr · LFPZ', false]
    ])) {
        const defaults = pavedAirfieldDefault({ airfield });
        expect(defaults).toBe(expected);
        for (const kind of ['runway', 'taxiway']) {
            const feature = {
                id: 'test',
                kind,
                name: '',
                points: [
                    [0, 0],
                    [10, 0]
                ],
                holes: [],
                line: true
            };
            expect(pavedAirfieldSurface(feature, defaults)).toBe(expected);
            expect(
                pavedAirfieldSurface({ ...feature, surface: 'grass' }, defaults)
            ).toBe(false);
            expect(
                pavedAirfieldSurface(
                    { ...feature, surface: 'asphalt' },
                    defaults
                )
            ).toBe(true);
        }
    }
});
