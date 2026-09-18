/* global console */
// Offline validation and route planning using the real simulation and cached world.
import fs from 'node:fs';
import { createGeography, setGeography } from '../src/geography.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from '../src/physics.js';
import { getVerticalSpeed, getAltitude } from '../src/flightMetrics.js';
const world = createGeography(
    JSON.parse(fs.readFileSync('data/saint-cyr.json')),
    JSON.parse(fs.readFileSync('data/saint-cyr-elevation.json'))
);
setGeography(world);
const state = createPlaneState(),
    physics = createPlanePhysics();
const stages = [];
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fx = Math.cos(world.spawn.yaw),
    fz = -Math.sin(world.spawn.yaw);
const approach = { x: world.spawn.x - fx * 1300, z: world.spawn.z - fz * 1300 };
const waypoints = [
    { x: world.spawn.x + fx * 1500, z: world.spawn.z + fz * 1500, y: 150 },
    { x: 2500, z: 400, y: 150 },
    { x: 3000, z: -1300, y: 150 },
    { x: -2000, z: -1800, y: 45 },
    { ...approach, y: 18 },
    { x: world.spawn.x + fx * 250, z: world.spawn.z + fz * 250, y: 0 }
];
let waypoint = 0,
    peak = 0,
    landed = false,
    minPalace = Infinity;
for (let step = 0; step < 500; step++) {
    const time = step * 0.5,
        target = waypoints[waypoint];
    const distance = Math.hypot(
        target.x - state.position.x,
        target.z - state.position.z
    );
    if (distance < 250 && waypoint < waypoints.length - 1 && time > 8)
        waypoint++;
    const projection =
        (state.position.x - world.spawn.x) * fx +
        (state.position.z - world.spawn.z) * fz;
    const aim =
        waypoint === waypoints.length - 1
            ? {
                  x: world.spawn.x + fx * (projection + 450),
                  z: world.spawn.z + fz * (projection + 450)
              }
            : target;
    const heading = Math.atan2(
        -(aim.z - state.position.z),
        aim.x - state.position.x
    );
    const error = Math.atan2(
        Math.sin(heading - state.yawAngle),
        Math.cos(heading - state.yawAngle)
    );
    const bank = clamp(-error * 1.2, -0.45, 0.45);
    let roll = clamp((bank - state.rollAngle) * 0.55, -0.3, 0.3);
    if (Math.abs(roll) < 0.0001) roll = 0.00001;
    const final = waypoint === waypoints.length - 1;
    const along =
        (state.position.x - world.spawn.x) * fx +
        (state.position.z - world.spawn.z) * fz;
    const desiredHeight = final
        ? clamp((180 - along) * 0.045, 0, 80)
        : target.y;
    const targetY = final
        ? desiredHeight
        : Math.max(
              desiredHeight,
              world.height(state.position.x, state.position.z) +
                  (waypoint >= 3 ? 20 : 100)
          );
    const vs = getVerticalSpeed(state) * 60;
    const wanted = clamp((targetY - state.position.y) * 0.22, -4, 10);
    const pitchTarget = clamp(0.04 + (wanted - vs) * 0.018, -0.12, 0.25);
    let pitch = clamp((pitchTarget - state.pitchAngle) * 2, -0.5, 0.5);
    let throttle = final ? 0.72 : 1;
    if (time < 1) {
        pitch = 0;
        roll = 0;
        throttle = 1;
    } else if (time < 2) {
        pitch = 0.3;
        roll = 0;
    }
    if (final) {
        throttle = 1;
        const desired = clamp((targetY - state.position.y) * 0.2, -4, 4);
        const trim = -0.04;
        pitch = clamp(
            (trim + (desired - vs) * 0.012 - state.pitchAngle) * 2,
            -0.3,
            0.3
        );
        if (getAltitude(state) < 8) {
            throttle = 0.75;
            pitch = clamp((0.12 - state.pitchAngle) * 2, -0.3, 0.3);
        }
    }
    if (time > 10 && !state.isAirborne) {
        landed = true;
        throttle = 0;
        pitch = 0;
        roll = 0;
    }
    const controls = { throttle, pitch, roll };
    stages.push({ seconds: 0.5, controls });
    const input = {
        w: false,
        s: false,
        a: false,
        d: false,
        arrowLeft: false,
        arrowRight: false,
        arrowUp: false,
        arrowDown: false,
        space: false,
        stickPitch: pitch,
        stickRoll: roll
    };
    for (let tick = 0; tick < 30; tick++) {
        state.thrust = throttle;
        updatePlanePhysics({
            planeState: state,
            planePhysics: physics,
            keyboard: input,
            delta: 1 / 60
        });
        peak = Math.max(peak, getAltitude(state));
        minPalace = Math.min(
            minPalace,
            Math.hypot(state.position.x - 2500, state.position.z - 400)
        );
    }
    if (step % 20 === 0)
        console.log(
            time,
            waypoint,
            state.position,
            Math.round(getAltitude(state)),
            state.isCrashed
        );
    if (state.isCrashed || (landed && state.speed === 0)) break;
}
console.log({
    peak,
    minPalace,
    landed,
    onRunway: world.onRunway(state.position.x, state.position.z),
    state,
    seconds: stages.length * 0.5
});
fs.writeFileSync('data/scenic-tour.json', JSON.stringify(stages));
