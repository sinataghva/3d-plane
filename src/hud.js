export function createHud() {
    const speedValueElement = document.getElementById('speed-value');
    const altitudeValueElement = document.getElementById('altitude-value');

    return {
        update({ planeState }) {
            const altitude = Math.max(0, planeState.position.y - 0.5);

            speedValueElement.textContent = planeState.speed.toFixed(2);
            altitudeValueElement.textContent = altitude.toFixed(2);
        }
    };
}
