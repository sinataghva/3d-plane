/**
 * @typedef {'w'|'s'|'a'|'d'|'arrowLeft'|'arrowRight'|'arrowUp'|'arrowDown'|'space'} ButtonKey
 * @typedef {object} KeyboardState
 * @property {boolean} w
 * @property {boolean} s
 * @property {boolean} a
 * @property {boolean} d
 * @property {boolean} arrowLeft
 * @property {boolean} arrowRight
 * @property {boolean} arrowUp
 * @property {boolean} arrowDown
 * @property {boolean} space
 * @property {number} stickRoll
 * @property {number} stickPitch
 * @property {number} [stickRudder]
 */
/** @type {Record<string, ButtonKey>} */
const KEY_BINDINGS = {
    w: 'w',
    s: 's',
    a: 'a',
    d: 'd',
    arrowleft: 'arrowLeft',
    arrowright: 'arrowRight',
    arrowup: 'arrowUp',
    arrowdown: 'arrowDown',
    ' ': 'space'
};
const STICK_DEADZONE = 0.18;
const STICK_ROLL_AUTHORITY = 0.46;
const STICK_PITCH_AUTHORITY = 0.34;

/** @param {number} value @param {number} authority */
export function applyStickCurve(value, authority) {
    const magnitude = Math.min(1, Math.abs(value));
    if (magnitude <= STICK_DEADZONE) return 0;
    const curved = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE);
    return Math.sign(value) * curved * curved * authority;
}

/** Independent input sources prevent one released finger/key cancelling another. */
export function createInputController() {
    /** @type {KeyboardState} */
    const state = {
        w: false,
        s: false,
        a: false,
        d: false,
        arrowLeft: false,
        arrowRight: false,
        arrowUp: false,
        arrowDown: false,
        space: false,
        stickRoll: 0,
        stickPitch: 0
    };
    /** @type {Set<ButtonKey>} */
    const keys = new Set();
    /** @type {Map<number, ButtonKey>} */
    const pointers = new Map();
    /** @type {number | null} */
    let stickPointer = null;
    const sync = () => {
        for (const key of new Set(Object.values(KEY_BINDINGS)))
            state[key] = keys.has(key) || [...pointers.values()].includes(key);
    };
    return {
        state,
        /** @param {string} key @param {boolean} pressed */
        key(key, pressed) {
            const name = key.toLowerCase();
            const mapped = Object.hasOwn(KEY_BINDINGS, name)
                ? KEY_BINDINGS[name]
                : undefined;
            if (!mapped) return false;
            if (pressed) keys.add(mapped);
            else keys.delete(mapped);
            sync();
            return true;
        },
        /** @param {number} id @param {ButtonKey} key */
        pressPointer(id, key) {
            pointers.set(id, key);
            sync();
        },
        /** @param {number} id */
        releasePointer(id) {
            pointers.delete(id);
            sync();
        },
        /** @param {number} id */
        beginStick(id) {
            if (stickPointer !== null) return false;
            stickPointer = id;
            return true;
        },
        /** @param {number} id @param {number} x @param {number} y */
        moveStick(id, x, y) {
            if (id !== stickPointer) return false;
            state.stickRoll = applyStickCurve(x, STICK_ROLL_AUTHORITY);
            state.stickPitch = applyStickCurve(y, STICK_PITCH_AUTHORITY);
            return true;
        },
        /** @param {number} id */
        releaseStick(id) {
            if (id !== stickPointer) return false;
            stickPointer = null;
            state.stickRoll = state.stickPitch = 0;
            return true;
        },
        reset() {
            keys.clear();
            pointers.clear();
            stickPointer = null;
            state.stickRoll = state.stickPitch = 0;
            sync();
        }
    };
}

/** @param {EventTarget | null} target */
export function isEditableTarget(target) {
    return (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
            ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName))
    );
}

/** @returns {KeyboardState} */
export function createKeyboardState() {
    const input = createInputController();
    const buttons = [
        ...document.querySelectorAll('#touch-controls [data-key]')
    ].filter((node) => node instanceof HTMLElement);
    const stick = document.querySelector('[data-stick]');
    const knob = stick?.querySelector('.stick-knob');
    const resetStickVisual = () => {
        if (stick instanceof HTMLElement) {
            stick.dataset.active = 'false';
            stick.dataset.x = stick.dataset.y = '0';
        }
        if (knob instanceof HTMLElement) knob.style.translate = '0 0';
    };
    const refreshButtons = () => {
        for (const button of buttons) {
            const key = /** @type {ButtonKey} */ (button.dataset.key);
            button.dataset.active = input.state[key] ? 'true' : 'false';
        }
    };
    const clear = () => {
        input.reset();
        refreshButtons();
        resetStickVisual();
    };
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) clear();
    });
    window.addEventListener('keydown', (event) => {
        if (
            isEditableTarget(event.target) ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey
        )
            return;
        if (input.key(event.code === 'Space' ? ' ' : event.key, true))
            event.preventDefault();
    });
    window.addEventListener('keyup', (event) => {
        if (
            input.key(event.code === 'Space' ? ' ' : event.key, false) &&
            !isEditableTarget(event.target)
        )
            event.preventDefault();
    });
    for (const button of buttons) {
        const key = button.dataset.key;
        if (
            !key ||
            !Object.values(KEY_BINDINGS).includes(
                /** @type {ButtonKey} */ (key)
            )
        )
            continue;
        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            input.pressPointer(event.pointerId, /** @type {ButtonKey} */ (key));
            refreshButtons();
        });
        const release = (/** @type {PointerEvent} */ event) => {
            input.releasePointer(event.pointerId);
            refreshButtons();
        };
        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('lostpointercapture', release);
    }
    if (stick instanceof HTMLElement) {
        const move = (/** @type {PointerEvent} */ event) => {
            const rect = stick.getBoundingClientRect();
            const radius = rect.width / 2;
            const maxTravel = radius * 0.62;
            if (!maxTravel) return;
            const rawX = event.clientX - rect.left - radius;
            const rawY = event.clientY - rect.top - radius;
            const scale = Math.min(
                1,
                maxTravel / (Math.hypot(rawX, rawY) || 1)
            );
            const x = rawX * scale,
                y = rawY * scale;
            if (!input.moveStick(event.pointerId, x / maxTravel, y / maxTravel))
                return;
            event.preventDefault();
            stick.dataset.active = 'true';
            stick.dataset.x = (x / maxTravel).toFixed(2);
            stick.dataset.y = (y / maxTravel).toFixed(2);
            if (knob instanceof HTMLElement)
                knob.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
        };
        stick.addEventListener('pointerdown', (event) => {
            if (!input.beginStick(event.pointerId)) return;
            stick.setPointerCapture(event.pointerId);
            move(event);
        });
        stick.addEventListener('pointermove', move);
        const release = (/** @type {PointerEvent} */ event) => {
            if (input.releaseStick(event.pointerId)) resetStickVisual();
        };
        stick.addEventListener('pointerup', release);
        stick.addEventListener('pointercancel', release);
        stick.addEventListener('lostpointercapture', release);
    }
    return input.state;
}
