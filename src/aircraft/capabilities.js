/** Shared behavior, independent of a mission's display name. */
export const AIRCRAFT_CAPABILITIES = Object.freeze({
    cessna: Object.freeze({ jet: false, weapon: 'gun', weaponReady: true }),
    mirage: Object.freeze({ jet: true, weapon: 'gun', weaponReady: true }),
    phantom: Object.freeze({ jet: true, weapon: 'bomb', weaponReady: true })
});
/** @param {string|undefined} aircraft */
export function aircraftCapabilities(aircraft) {
    return (
        AIRCRAFT_CAPABILITIES[
            /** @type {keyof typeof AIRCRAFT_CAPABILITIES} */ (
                aircraft || 'cessna'
            )
        ] || AIRCRAFT_CAPABILITIES.cessna
    );
}
/** @param {string|undefined} aircraft */
export const isJet = (aircraft) => aircraftCapabilities(aircraft).jet;
