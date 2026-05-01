export function createHud() {
    const speedValueElement = document.getElementById('speed-value');
    const altitudeValueElement = document.getElementById('altitude-value');

    return {
        update({ airplane, planePhysics }) {
            const altitude = Math.max(0, airplane.position.y - 0.5);

            speedValueElement.textContent = planePhysics.speed.toFixed(2);
            altitudeValueElement.textContent = altitude.toFixed(2);
        }
    };
}
