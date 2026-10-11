import { expect, test } from 'vitest';
import { tehranBuildingStyle } from './tehranBuildingStyle.js';
import styles from '../../data/tehran/building-style.json';

/** @param {string} id */
const feature = (id) => ({
    id,
    kind: 'building',
    points: [],
    holes: [],
    line: false,
    name: ''
});
test('cached building types survive split footprint ids', () => {
    const entry = Object.entries(styles).find(
        ([, tags]) => 'building' in tags && tags.building === 'industrial'
    );
    expect(entry).toBeDefined();
    if (!entry) return;
    expect(tehranBuildingStyle(feature(entry[0] + '-0')).type).toBe(
        'industrial'
    );
    expect(tehranBuildingStyle(feature(entry[0] + '-1')).type).toBe(
        'industrial'
    );
});
test('untagged buildings have repeatable varied finishes without inferred types', () => {
    const samples = Array.from({ length: 20 }, (_, i) =>
        tehranBuildingStyle(feature('unknown-' + i))
    );
    expect(new Set(samples.map((s) => s.wall)).size).toBeGreaterThan(3);
    expect(new Set(samples.map((s) => s.roof)).size).toBeGreaterThan(2);
    expect(samples.every((s) => s.type === '')).toBe(true);
    expect(tehranBuildingStyle(feature('unknown-0'))).toEqual(samples[0]);
});
