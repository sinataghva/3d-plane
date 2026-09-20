/* global console */
// Repeatable end-to-end flight through the actual cached terrain and jet physics.
import fs from 'node:fs';
import { createGeography, setGeography } from '../../src/scenery/geography.js';
import {
    createPlaneState,
    createPlanePhysics,
    updatePlanePhysics
} from '../../src/flight/physics.js';
import { createInputController } from '../../src/flight/input.js';
const world = createGeography(
    JSON.parse(fs.readFileSync('data/luxeuil/map.json')),
    JSON.parse(fs.readFileSync('data/luxeuil/elevation.json'))
);
setGeography(world);
const s = createPlaneState('mirage'),
    k = createInputController().state,
    p = createPlanePhysics();
const fx = Math.cos(s.yawAngle),
    fz = -Math.sin(s.yawAngle),
    rx = -fz,
    rz = fx;
const targets = [
    [4000, 0, 300],
    [5000, 3500, 350],
    [-6500, 3500, 200],
    [-7000, 0, 150],
    [800, 0, 0]
];
let wp = 0,
    peak = 0,
    landed = false;
const stages = [];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
for (let frame = 0; frame < 60 * 800; frame++) {
    const along =
        (s.position.x - world.spawn.x) * fx +
        (s.position.z - world.spawn.z) * fz;
    const cross =
        (s.position.x - world.spawn.x) * rx +
        (s.position.z - world.spawn.z) * rz;
    let target = targets[wp];
    const distance = Math.hypot(along - target[0], cross - target[1]);
    if (distance < 800 && wp < targets.length - 1 && frame > 1200)
        target = targets[++wp];
    const final = wp === 4;
    const tx = final ? along + 700 : target[0],
        tz = target[1];
    const heading = Math.atan2(
        -(fz * (tx - along) + rz * (tz - cross)),
        fx * (tx - along) + rx * (tz - cross)
    );
    const err = Math.atan2(
        Math.sin(heading - s.yawAngle),
        Math.cos(heading - s.yawAngle)
    );
    const bank = clamp(-err * 1.8, -1.05, 1.05);
    k.stickRoll = clamp((bank - s.rollAngle) * 3, -1, 1);
    if (Math.abs(k.stickRoll) < 0.0001) k.stickRoll = 0.000001;
    let height = final
        ? Math.max(-4, (200 - along) * 0.05)
        : Math.max(
              target[2],
              world.height(s.position.x, s.position.z) + (wp >= 2 ? 70 : 180)
          );
    const vs = clamp((height - s.position.y) * 0.12, -4.5, 28);
    const desiredPitch = Math.asin(
        clamp(vs / Math.max(65, s.speed * 60), -0.3, 0.3)
    );
    k.stickPitch = clamp((desiredPitch - s.pitchAngle) * 3, -0.8, 0.8);
    if (frame < 900) k.stickPitch = s.speed >= 1.18 ? 0.35 : 0;
    s.gearDown = !s.isAirborne || final;
    s.airbrake = final && s.speed > 1.5;
    const wantedSpeed = final ? 1.35 : 1.9;
    s.thrust = clamp(0.55 + (wantedSpeed - s.speed) * 0.5, 0, 1);
    k.boost = frame < 900;
    s.thrust = frame < 900 ? 1 : s.thrust;
    if (s.isAirborne) landed = true;
    if (landed && !s.isAirborne) {
        s.thrust = 0;
        s.airbrake = true;
        k.stickPitch = 0;
        k.boost = false;
    }
    k.brake = s.airbrake;
    updatePlanePhysics({
        planeState: s,
        keyboard: k,
        planePhysics: p,
        delta: 1 / 60
    });
    peak = Math.max(peak, s.position.y);
    if (frame % 30 === 0)
        stages.push({
            seconds: 0.5,
            controls: {
                throttle: s.thrust > 1 ? 1 : s.thrust,
                pitch: k.stickPitch,
                roll: k.stickRoll,
                boost: k.boost,
                gearDown: s.gearDown,
                airbrake: s.airbrake
            }
        });
    if (s.isCrashed || (landed && !s.isAirborne && s.speed === 0)) {
        console.log({
            time: frame / 60,
            wp,
            peak,
            along,
            cross,
            onRunway: world.onRunway(s.position.x, s.position.z),
            state: s
        });
        break;
    }
    if (frame === 60 * 800 - 1) console.log('TIMEOUT', { wp, along, cross, s });
}
if (
    wp !== 4 ||
    !landed ||
    peak < 300 ||
    Math.abs(
        Math.atan2(
            Math.sin(s.yawAngle - world.spawn.yaw),
            Math.cos(s.yawAngle - world.spawn.yaw)
        )
    ) > 0.02 ||
    s.isCrashed ||
    s.isAirborne ||
    s.speed !== 0 ||
    !world.onRunway(s.position.x, s.position.z)
)
    throw new Error('Jet circuit did not finish stopped on the runway');
