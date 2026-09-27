/** Arcade distance mix with a soft fade to silence at 6 km. @param {number} distance */
export function bombImpactGain(distance) {
    const d = Math.max(0, distance);
    const fade = Math.min(1, Math.max(0, (6000 - d) / 1000));
    return (1.6 * fade) / (1 + d / 1800);
}
