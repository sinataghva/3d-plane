import { inRing, segmentDistance } from './geography.js';
/** @param {import('./geography.js').Geography} world */
export function azadiLayout(world) {
    if (!world.data.airfield?.includes('OIII')) return null;
    const ids = new Set([
        'w544306451-0',
        'w545099122-0',
        'w545099229-0',
        'w545099230-0',
        'w545098816-0',
        'w545098817-0',
        'w545300305-0',
        'w545300307-0',
        'w545300123-0',
        'w545300308-0'
    ]);
    const features = new Map(
        world.data.features.filter((f) => ids.has(f.id)).map((f) => [f.id, f])
    );
    const boundary = features.get('w544306451-0');
    if (!boundary) return null;
    const ring = boundary.points;
    // Four separate mapped garden islands form the outer square. Keeping
    // their contours separate leaves both traffic rings and radial roads open.
    const outerRings = [
        'w545300305-0',
        'w545300307-0',
        'w545300123-0',
        'w545300308-0'
    ].flatMap((id) => {
        const feature = features.get(id);
        return feature ? [feature.points] : [];
    });
    const rings = [ring, ...outerRings];
    // Independently simplified cached ways can miss the outer boundary by
    // up to three metres. Allow those joins without extending the lawn contour.
    const regions = rings.map((points, i) => ({
        tolerance: i === 0 ? 0.2 : 3,
        points,
        minX: Math.min(...points.map((p) => p[0])) - (i === 0 ? 0.2 : 3),
        maxX: Math.max(...points.map((p) => p[0])) + (i === 0 ? 0.2 : 3),
        minZ: Math.min(...points.map((p) => p[1])) - (i === 0 ? 0.2 : 3),
        maxZ: Math.max(...points.map((p) => p[1])) + (i === 0 ? 0.2 : 3)
    }));
    const contains = regions.map(
        ({ points, minX, maxX, minZ, maxZ, tolerance }) =>
            (/** @type {number[]} */ p) =>
                p[0] >= minX &&
                p[0] <= maxX &&
                p[1] >= minZ &&
                p[1] <= maxZ &&
                (inRing(p[0], p[1], points) ||
                    points
                        .slice(1)
                        .some(
                            (b, i) =>
                                segmentDistance(p[0], p[1], points[i], b) <
                                tolerance
                        ))
    );
    const paths = world.data.features.filter(
        (f) =>
            f.kind === 'road' &&
            f.class === 'footway' &&
            f.points.length > 1 &&
            contains.some((inside) => f.points.every(inside))
    );
    const fountains = world.data.features.filter(
        (f) =>
            f.kind === 'water' &&
            f.id.startsWith('r7787479-') &&
            contains.some((inside) => f.points.every(inside))
    );
    return { features, ring, rings, outerRings, contains, paths, fountains };
}
