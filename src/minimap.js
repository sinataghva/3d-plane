/**
 * @typedef {import('./physics.js').PlaneState} PlaneState
 */

const MAP_SCALE = 0.08;
const RUNWAY_HALF_WIDTH = 10;
const RUNWAY_HALF_LENGTH = 150;

/**
 * @typedef {object} RadarPoint
 * @property {number} x
 * @property {number} y
 */

/**
 * Converts a world X/Z coordinate into a plane-centered, heading-up radar point.
 *
 * @param {object} args
 * @param {number} args.worldX
 * @param {number} args.worldZ
 * @param {number} args.planeX
 * @param {number} args.planeZ
 * @param {number} args.yawAngle
 * @param {number} [args.scale]
 * @returns {RadarPoint}
 */
export function worldToRadarPoint({
    worldX,
    worldZ,
    planeX,
    planeZ,
    yawAngle,
    scale = MAP_SCALE
}) {
    const dx = worldX - planeX;
    const dz = worldZ - planeZ;
    const forwardX = Math.cos(yawAngle);
    const forwardZ = -Math.sin(yawAngle);
    const leftX = forwardZ;
    const leftZ = -forwardX;

    return {
        x: -(dx * leftX + dz * leftZ) * scale,
        y: -(dx * forwardX + dz * forwardZ) * scale
    };
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {RadarPoint[]} points
 */
function drawPolygon(context, points) {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
        context.lineTo(point.x, point.y);
    }
    context.closePath();
}

export function createMiniMap() {
    const canvas = document.getElementById('mini-map-canvas');

    if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Missing mini map canvas');
    }

    const context = canvas.getContext('2d');

    if (!context) {
        throw new Error('Mini map canvas context is unavailable');
    }

    const radarContext = context;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    /**
     * @param {number} worldX
     * @param {number} worldZ
     * @param {PlaneState} planeState
     * @returns {RadarPoint}
     */
    function project(worldX, worldZ, planeState) {
        const point = worldToRadarPoint({
            worldX,
            worldZ,
            planeX: planeState.position.x,
            planeZ: planeState.position.z,
            yawAngle: planeState.yawAngle
        });

        return {
            x: centerX + point.x,
            y: centerY + point.y
        };
    }

    /**
     * @param {PlaneState} planeState
     */
    function drawRunway(planeState) {
        const runwayCorners = [
            project(-RUNWAY_HALF_WIDTH, -RUNWAY_HALF_LENGTH, planeState),
            project(RUNWAY_HALF_WIDTH, -RUNWAY_HALF_LENGTH, planeState),
            project(RUNWAY_HALF_WIDTH, RUNWAY_HALF_LENGTH, planeState),
            project(-RUNWAY_HALF_WIDTH, RUNWAY_HALF_LENGTH, planeState)
        ];
        drawPolygon(radarContext, runwayCorners);
        radarContext.fillStyle = 'rgba(18, 24, 31, 0.92)';
        radarContext.fill();
        radarContext.strokeStyle = 'rgba(246, 248, 251, 0.34)';
        radarContext.lineWidth = 1;
        radarContext.stroke();

        const runwayStart = project(0, -RUNWAY_HALF_LENGTH, planeState);
        const runwayEnd = project(0, RUNWAY_HALF_LENGTH, planeState);
        radarContext.beginPath();
        radarContext.moveTo(runwayStart.x, runwayStart.y);
        radarContext.lineTo(runwayEnd.x, runwayEnd.y);
        radarContext.strokeStyle = 'rgba(246, 248, 251, 0.75)';
        radarContext.lineWidth = 2;
        radarContext.stroke();

        const barrierLeft = project(-RUNWAY_HALF_WIDTH, 150, planeState);
        const barrierRight = project(RUNWAY_HALF_WIDTH, 150, planeState);
        radarContext.beginPath();
        radarContext.moveTo(barrierLeft.x, barrierLeft.y);
        radarContext.lineTo(barrierRight.x, barrierRight.y);
        radarContext.strokeStyle = '#e63946';
        radarContext.lineWidth = 4;
        radarContext.stroke();
    }

    /**
     * @param {PlaneState} planeState
     */
    function drawPlaneMarker(planeState) {
        radarContext.save();
        radarContext.translate(centerX, centerY);
        radarContext.beginPath();
        radarContext.moveTo(0, -9);
        radarContext.lineTo(7, 8);
        radarContext.lineTo(0, 4);
        radarContext.lineTo(-7, 8);
        radarContext.closePath();
        radarContext.fillStyle = planeState.isCrashed ? '#e63946' : '#8ecae6';
        radarContext.fill();
        radarContext.strokeStyle = '#f6f8fb';
        radarContext.lineWidth = 1.5;
        radarContext.stroke();
        radarContext.restore();
    }

    return {
        /**
         * @param {{ planeState: PlaneState }} args
         */
        update({ planeState }) {
            radarContext.clearRect(0, 0, canvas.width, canvas.height);

            const gradient = radarContext.createRadialGradient(
                centerX,
                centerY,
                8,
                centerX,
                centerY,
                centerX
            );
            gradient.addColorStop(0, 'rgba(31, 55, 68, 0.95)');
            gradient.addColorStop(1, 'rgba(10, 18, 26, 0.95)');
            radarContext.fillStyle = gradient;
            radarContext.fillRect(0, 0, canvas.width, canvas.height);

            radarContext.strokeStyle = 'rgba(142, 202, 230, 0.16)';
            radarContext.lineWidth = 1;
            for (const radius of [38, 72]) {
                radarContext.beginPath();
                radarContext.arc(centerX, centerY, radius, 0, Math.PI * 2);
                radarContext.stroke();
            }

            radarContext.beginPath();
            radarContext.moveTo(centerX, 10);
            radarContext.lineTo(centerX, canvas.height - 10);
            radarContext.moveTo(10, centerY);
            radarContext.lineTo(canvas.width - 10, centerY);
            radarContext.strokeStyle = 'rgba(246, 248, 251, 0.12)';
            radarContext.stroke();

            drawRunway(planeState);
            drawPlaneMarker(planeState);
        }
    };
}
