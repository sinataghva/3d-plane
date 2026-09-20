// Shared arcade Mach reference; this is not an altitude-dependent atmosphere.
export const MACH_REFERENCE_SPEED = 343;

/** Smooth drag acceleration in m/s². Clean afterburning level flight naturally
 * approaches Mach 2; dives can exceed that equilibrium without a speed clamp.
 * Coefficients are gameplay tuning, not a measured Mirage performance curve.
 * @param {number} speed speed in m/s
 * @param {{gear:number,gForce:number,rudder:number,airborne:boolean}} configuration */
export function jetDrag(speed, { gear, gForce, rudder, airborne }) {
    const mach = Math.max(0, speed) / MACH_REFERENCE_SPEED;
    const transonic = Math.max(0, Math.min(1, (mach - 0.8) / 0.25));
    const waveDrag = 7 * transonic * transonic * (3 - 2 * transonic);
    const supersonicDrag = 4 * Math.max(0, mach - 1.6) ** 2;
    const surfaceDrag =
        (0.000018 + Math.max(0, Math.min(1, gear)) * 0.00015) * speed * speed;
    return (
        surfaceDrag +
        waveDrag +
        supersonicDrag +
        (airborne
            ? 0.9 +
              Math.max(0, gForce * gForce - 1) * 0.22 +
              Math.abs(rudder) * speed * 0.025
            : 1.8)
    );
}
