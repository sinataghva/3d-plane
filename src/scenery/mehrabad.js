import { inFeature, segmentDistance } from './geography.js';

// Cached OSM apron identities, not a representation of current operations.
export const MEHRABAD_MILITARY_APRONS = ['w28670023-0'];
export const MEHRABAD_CIVIL_APRONS = [
    'w1044518738-0',
    'w1044518739-0',
    'w1044507318-0'
];

/** @param {import('./geography.js').GeoData} data */
export function isMehrabad(data) {
    return data.features.some(
        (f) => f.kind === 'airfield' && f.icao === 'OIII'
    );
}

/** Style only mapped buildings next to the cached military apron.
 * @param {import('./geography.js').GeoFeature} building
 * @param {import('./geography.js').GeoFeature[]} aprons */
export function nearMilitaryApron(building, aprons) {
    return aprons.some((apron) =>
        building.points.some(
            ([x, z]) =>
                inFeature(x, z, apron) ||
                apron.points
                    .slice(1)
                    .some(
                        (p, i) =>
                            segmentDistance(x, z, apron.points[i], p) < 100
                    )
        )
    );
}
