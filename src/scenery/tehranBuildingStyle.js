import styles from '../../data/tehran/building-style.json';

/** Cached tags apply only to existing footprints; untagged colours are stylistic.
 * @param {import('./geography.js').GeoFeature} feature */
export function tehranBuildingStyle(feature) {
    const tags =
        /** @type {Record<string, Record<string,string>>} */ (styles)[
            feature.id.split('-')[0]
        ] || {};
    let seed = 2166136261;
    for (const c of feature.id)
        seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    seed >>>= 0;
    const type = tags.building || feature.buildingType || '';
    const industrial = [
        'industrial',
        'warehouse',
        'hangar',
        'shed',
        'garages',
        'roof'
    ].includes(type);
    const civic = [
        'school',
        'university',
        'hospital',
        'college',
        'public'
    ].includes(type);
    const wallPalette = industrial
        ? [0xb1b0a7, 0xaaa99f, 0xc1bdb0]
        : civic
          ? [0xd4c7ab, 0xc7b99d, 0xc6c6ba]
          : [0xd1c8b3, 0xc3b59e, 0xd9cfb9, 0xbeb8aa, 0xc8b29a, 0xc9c7be];
    const roofPalette = industrial
        ? [0x9b9d98, 0x8a9395, 0xa6a49b]
        : [0xa49d8d, 0x96978e, 0xb1aa98, 0x858d8c];
    const named = /** @type {Record<string,number>} */ ({
        white: 0xe0ddd1,
        beige: 0xcebea0,
        brown: 0x99806b,
        grey: 0xa1a3a1,
        gray: 0xa1a3a1,
        red: 0xa46f59
    });
    const color = (
        /** @type {string|undefined} */ value,
        /** @type {number} */ fallback
    ) =>
        value && /^#[0-9a-f]{6}$/i.test(value)
            ? parseInt(value.slice(1), 16)
            : (named[value || ''] ?? fallback);
    const brick = tags['building:material'] === 'brick';
    return {
        wall: color(
            tags['building:colour'],
            brick ? 0xb49a80 : wallPalette[seed % wallPalette.length]
        ),
        roof: color(
            tags['roof:colour'],
            tags['roof:material'] === 'roof_tiles'
                ? 0xa37b64
                : roofPalette[(seed >>> 8) % roofPalette.length]
        ),
        type
    };
}
