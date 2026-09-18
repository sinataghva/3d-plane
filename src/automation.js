import {
    GROUND_LEVEL,
    INTERNAL_SPEED_TO_KMH,
    INTERNAL_VERTICAL_SPEED_TO_MS,
    getVerticalSpeed
} from './flightMetrics.js';
/**
 * @typedef {{throttle: number, pitch: number, roll: number, rudder: number, fire: boolean}} FlightControls
 * @typedef {import('./physics.js').PlaneState} PlaneState
 */

/**
 * Deterministic, exclusive input ownership for browser agents.
 * @param {{planeState: PlaneState, advance: (delta: number, input: import('./input.js').KeyboardState) => void, reset: () => void, render: () => void}} options
 */
export function createFlightAutomation({ planeState, advance, reset, render }) {
    let active = true;
    let ticks = 0;
    let running = false;
    let continuous = false;
    let accumulator = 0;
    let routeStatus = 'idle';
    let routeError = '';
    /** @type {FlightControls} */
    let controls = { throttle: 0, pitch: 0, roll: 0, rudder: 0, fire: false };
    const assertActive = () => {
        if (!active)
            throw new Error(
                'Automation released. Reload with ?automation=1 to regain control.'
            );
    };
    /** @param {Partial<FlightControls>} values */
    const validateControls = (values) => {
        if (!values || typeof values !== 'object' || Array.isArray(values))
            throw new Error('Expected a controls object.');
        for (const [key, value] of Object.entries(values)) {
            if (!Object.hasOwn(controls, key))
                throw new Error(`Unknown control: ${key}`);
            if (key === 'fire') {
                if (typeof value !== 'boolean')
                    throw new Error('fire must be boolean.');
            } else if (
                typeof value !== 'number' ||
                !Number.isFinite(value) ||
                value > 1 ||
                value < (key === 'throttle' ? 0 : -1)
            ) {
                throw new Error(`${key} is outside its allowed range.`);
            }
        }
    };
    const getState = () => ({
        active,
        running,
        continuous,
        routeStatus,
        routeError,
        simulationSeconds: ticks / 60,
        controls: { ...controls },
        plane: { ...planeState, position: { ...planeState.position } },
        altitudeMeters: Math.max(0, planeState.position.y - GROUND_LEVEL),
        speedKmh: planeState.speed * INTERNAL_SPEED_TO_KMH,
        verticalSpeedMs:
            getVerticalSpeed(planeState) * INTERNAL_VERTICAL_SPEED_TO_MS
    });
    return {
        get active() {
            return active;
        },
        getState,
        resume() {
            assertActive();
            if (running)
                throw new Error('Wait for the current animated flight.');
            continuous = true;
            accumulator = 0;
            return getState();
        },
        pause() {
            continuous = false;
            accumulator = 0;
            return getState();
        },
        /** @param {number} delta */
        update(delta) {
            if (!active || !continuous) return;
            accumulator += Math.min(Math.max(delta, 0), 0.1);
            while (accumulator >= 1 / 60 && !planeState.isCrashed) {
                continuous = false;
                this.step({ seconds: 1 / 60 });
                continuous = true;
                accumulator -= 1 / 60;
            }
            if (planeState.isCrashed) this.pause();
        },
        /** @param {Partial<FlightControls>} values */
        setControls(values) {
            assertActive();
            validateControls(values);
            controls = { ...controls, ...values };
            planeState.thrust = controls.throttle;
            render();
            return getState();
        },
        /** @param {{seconds: number}} options */
        step({ seconds }) {
            assertActive();
            if (running || continuous)
                throw new Error(
                    'Pause the current flight before stepping or starting a bounded flight.'
                );
            if (!Number.isFinite(seconds) || seconds < 1 / 60 || seconds > 10)
                throw new Error('seconds must be between 1/60 and 10.');
            const count = Math.round(seconds * 60);
            const input = {
                w: false,
                s: false,
                a: false,
                d: false,
                arrowLeft: false,
                arrowRight: false,
                arrowUp: false,
                arrowDown: false,
                stickPitch: controls.pitch,
                stickRoll: controls.roll,
                stickRudder: controls.rudder,
                space: controls.fire
            };
            for (let i = 0; i < count && !planeState.isCrashed; i++) {
                planeState.thrust = controls.throttle;
                advance(1 / 60, input);
                ticks++;
            }
            render();
            return getState();
        },
        /**
         * Animate a bounded flight in wall-clock time using the same 60 Hz physics.
         * @param {{seconds: number}} options
         * @returns {Promise<ReturnType<typeof getState>>}
         */
        fly({ seconds }) {
            assertActive();
            if (running || continuous)
                throw new Error(
                    'Pause the current flight before stepping or starting a bounded flight.'
                );
            if (!Number.isFinite(seconds) || seconds < 1 / 60 || seconds > 10)
                throw new Error('seconds must be between 1/60 and 10.');
            running = true;
            const endTick = ticks + Math.round(seconds * 60);
            return new Promise((resolve, reject) => {
                let previous = performance.now();
                let accumulated = 0;
                const frame = (/** @type {number} */ now) => {
                    try {
                        accumulated += Math.min(
                            Math.max(0, (now - previous) / 1000),
                            0.1
                        );
                        previous = now;
                        while (
                            active &&
                            !planeState.isCrashed &&
                            ticks < endTick &&
                            accumulated >= 1 / 60
                        ) {
                            running = false;
                            this.step({ seconds: 1 / 60 });
                            running = true;
                            accumulated -= 1 / 60;
                        }
                        if (
                            !active ||
                            planeState.isCrashed ||
                            ticks >= endTick
                        ) {
                            running = false;
                            resolve(getState());
                        } else requestAnimationFrame(frame);
                    } catch (error) {
                        running = false;
                        reject(error);
                    }
                };
                requestAnimationFrame(frame);
            });
        },
        /** @param {{stages: Array<{seconds: number, controls: Partial<FlightControls>}>}} options */
        startRoute(options) {
            if (routeStatus === 'running' || running || continuous)
                throw new Error('A flight is already running.');
            assertActive();
            routeStatus = 'running';
            routeError = '';
            this.flyRoute(options)
                .then(() => {
                    routeStatus = !active
                        ? 'released'
                        : planeState.isCrashed
                          ? 'crashed'
                          : 'completed';
                })
                .catch((error) => {
                    routeStatus = 'failed';
                    routeError = String(error);
                });
            return getState();
        },
        /**
         * @param {{stages: Array<{seconds: number, controls: Partial<FlightControls>}>}} options
         * @returns {Promise<ReturnType<typeof getState>>}
         */
        async flyRoute({ stages }) {
            assertActive();
            if (running || continuous)
                throw new Error('Pause before starting a route.');
            if (
                !Array.isArray(stages) ||
                stages.length < 1 ||
                stages.length > 30
            )
                throw new Error('Expected 1..30 stages.');
            let duration = 0;
            for (const stage of stages) {
                if (
                    !stage ||
                    !Number.isFinite(stage.seconds) ||
                    stage.seconds < 1 / 60 ||
                    stage.seconds > 10
                )
                    throw new Error('Each stage must last 1/60..10 seconds.');
                validateControls(stage.controls);
                duration += stage.seconds;
            }
            if (duration > 60)
                throw new Error('Routes must last at most 60 seconds.');
            for (const stage of stages) {
                if (!active || planeState.isCrashed) break;
                this.setControls(stage.controls);
                await this.fly({ seconds: stage.seconds });
            }
            return getState();
        },
        reset() {
            assertActive();
            if (running)
                throw new Error(
                    'Wait for the animated flight before resetting.'
                );
            controls = {
                throttle: 0,
                pitch: 0,
                roll: 0,
                rudder: 0,
                fire: false
            };
            ticks = 0;
            routeStatus = 'idle';
            routeError = '';
            continuous = false;
            accumulator = 0;
            reset();
            render();
            return getState();
        },
        release() {
            active = false;
            continuous = false;
            accumulator = 0;
            controls = {
                throttle: planeState.thrust,
                pitch: 0,
                roll: 0,
                rudder: 0,
                fire: false
            };
            render();
            return getState();
        }
    };
}

/**
 * @param {ReturnType<typeof createFlightAutomation>} api
 * @returns {Promise<boolean>}
 */
export async function registerFlightTools(api) {
    // Support both current and older WebMCP browser implementations.
    const context =
        Reflect.get(document, 'modelContext') ??
        Reflect.get(navigator, 'modelContext');
    if (!context?.registerTool) return false;
    const tools = [
        {
            name: 'get_flight_state',
            description: 'Read flight telemetry and current controls.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: () => api.getState()
        },
        {
            name: 'set_flight_controls',
            description:
                'Set persistent flight controls. Throttle 0..1 (1 = full); pitch -1..1 (positive nose up); roll/rudder -1..1 (positive right). Simulation stays paused until fly_flight (animated) or step_flight (instant).',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    throttle: { type: 'number', minimum: 0, maximum: 1 },
                    pitch: { type: 'number', minimum: -1, maximum: 1 },
                    roll: { type: 'number', minimum: -1, maximum: 1 },
                    rudder: { type: 'number', minimum: -1, maximum: 1 },
                    fire: { type: 'boolean' }
                }
            },
            execute: (/** @type {Partial<FlightControls>} */ input) =>
                api.setControls(input)
        },
        {
            name: 'step_flight',
            description:
                'Advance existing flight physics at 60 Hz for 1/60..10 seconds, rounded to the nearest tick. Stops on crash; returns telemetry. No real-time waiting.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    seconds: { type: 'number', minimum: 1 / 60, maximum: 10 }
                },
                required: ['seconds']
            },
            execute: (/** @type {{seconds: number}} */ input) => api.step(input)
        },
        {
            name: 'fly_flight',
            description:
                'Animate flight visibly in real time for 1/60..10 seconds with current controls. Returns telemetry when finished; pauses between commands. Prefer this for demonstrations.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    seconds: { type: 'number', minimum: 1 / 60, maximum: 10 }
                },
                required: ['seconds']
            },
            execute: (/** @type {{seconds: number}} */ input) => api.fly(input)
        },
        {
            name: 'fly_route',
            description:
                'Animate a planned sequence without tool-call pauses between stages. 1..30 stages, each 1/60..10 seconds, total <=60 seconds. Each stage applies partial controls. Uses real physics, stops on crash or human takeover. Returns immediately; read get_flight_state routeStatus for completion.',
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['stages'],
                properties: {
                    stages: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 30,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            required: ['seconds', 'controls'],
                            properties: {
                                seconds: {
                                    type: 'number',
                                    minimum: 1 / 60,
                                    maximum: 10
                                },
                                controls: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        throttle: {
                                            type: 'number',
                                            minimum: 0,
                                            maximum: 1
                                        },
                                        pitch: {
                                            type: 'number',
                                            minimum: -1,
                                            maximum: 1
                                        },
                                        roll: {
                                            type: 'number',
                                            minimum: -1,
                                            maximum: 1
                                        },
                                        rudder: {
                                            type: 'number',
                                            minimum: -1,
                                            maximum: 1
                                        },
                                        fire: { type: 'boolean' }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            execute: (
                /** @type {{stages: Array<{seconds: number, controls: Partial<FlightControls>}>}} */ input
            ) => api.startRoute(input)
        },
        {
            name: 'resume_flight',
            description:
                'Run continuously in real time between tool calls. Controls stay set; update them while flying. Stops on crash or pause_flight.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: () => api.resume()
        },
        {
            name: 'pause_flight',
            description:
                'Pause continuous flight to inspect or plan. Does not interrupt a bounded fly_flight command.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: () => api.pause()
        },
        {
            name: 'reset_flight',
            description:
                'Restart on the runway at zero throttle, paused for automation.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: () => api.reset()
        },
        {
            name: 'release_flight',
            description:
                'Return control to the human and resume real-time flight. Reload automation URL to regain machine control.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            execute: () => api.release()
        }
    ];
    for (const tool of tools) {
        await context.registerTool({
            ...tool,
            execute: async (
                /** @type {Partial<FlightControls> & {seconds: number, stages: Array<{seconds: number, controls: Partial<FlightControls>}>}} */ input
            ) => ({
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(await tool.execute(input))
                    }
                ]
            })
        });
    }
    return true;
}
