/**
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
 */

const KEY_BINDINGS = {
    w: 'w',
    s: 's',
    a: 'a',
    d: 'd',
    arrowleft: 'arrowLeft',
    arrowright: 'arrowRight',
    arrowup: 'arrowUp',
    arrowdown: 'arrowDown'
};

const STICK_DEADZONE = 0.18;
const STICK_ROLL_AUTHORITY = 0.46;
const STICK_PITCH_AUTHORITY = 0.34;

export function applyStickCurve(value, authority) {
    const magnitude = Math.abs(value);
    if (magnitude <= STICK_DEADZONE) {
        return 0;
    }

    const curved = (magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE);
    return Math.sign(value) * curved * curved * authority;
}

/**
 * @param {KeyboardState} keyboard
 */
function resetStickInput(keyboard) {
    keyboard.stickRoll = 0;
    keyboard.stickPitch = 0;
}

/**
 * @param {KeyboardState} keyboard
 */
function createVirtualStick(keyboard) {
    const stick = document.querySelector('[data-stick]');
    if (!(stick instanceof HTMLElement)) {
        return;
    }

    const knob = stick.querySelector('.stick-knob');
    let activePointerId = null;

    const setStickInput = (event) => {
        const rect = stick.getBoundingClientRect();
        const radius = rect.width / 2;
        const maxTravel = radius * 0.62;
        const centerX = rect.left + radius;
        const centerY = rect.top + radius;
        const rawX = event.clientX - centerX;
        const rawY = event.clientY - centerY;
        const distance = Math.hypot(rawX, rawY);
        const scale = distance > maxTravel ? maxTravel / distance : 1;
        const x = rawX * scale;
        const y = rawY * scale;
        const normalizedX = x / maxTravel;
        const normalizedY = y / maxTravel;

        keyboard.stickRoll = applyStickCurve(normalizedX, STICK_ROLL_AUTHORITY);
        keyboard.stickPitch = applyStickCurve(
            normalizedY,
            STICK_PITCH_AUTHORITY
        );
        stick.dataset.active = 'true';
        stick.dataset.x = normalizedX.toFixed(2);
        stick.dataset.y = normalizedY.toFixed(2);

        if (knob instanceof HTMLElement) {
            knob.style.translate = `${Math.round(x)}px ${Math.round(y)}px`;
        }
    };

    const releaseStick = (event) => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        activePointerId = null;
        resetStickInput(keyboard);
        stick.dataset.active = 'false';
        stick.dataset.x = '0';
        stick.dataset.y = '0';

        if (knob instanceof HTMLElement) {
            knob.style.translate = '0 0';
        }
    };

    stick.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        activePointerId = event.pointerId;
        stick.setPointerCapture(event.pointerId);
        setStickInput(event);
    });

    stick.addEventListener('pointermove', (event) => {
        if (event.pointerId !== activePointerId) {
            return;
        }

        event.preventDefault();
        setStickInput(event);
    });

    stick.addEventListener('pointerup', releaseStick);
    stick.addEventListener('pointercancel', releaseStick);
    stick.addEventListener('lostpointercapture', releaseStick);
}

/**
 * @param {KeyboardState} keyboard
 */
function createVirtualControls(keyboard) {
    const controlsRoot = document.getElementById('touch-controls');
    if (!(controlsRoot instanceof HTMLElement)) {
        return;
    }

    const virtualButtons = controlsRoot.querySelectorAll('[data-key]');
    const activePointers = new Map();

    const setKeyState = (button, isPressed) => {
        const key = button.dataset.key;
        if (!key || !(key in keyboard)) {
            return;
        }

        keyboard[key] = isPressed;
        button.dataset.active = isPressed ? 'true' : 'false';
    };

    for (const button of virtualButtons) {
        if (!(button instanceof HTMLElement)) continue;

        button.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            button.setPointerCapture(event.pointerId);
            activePointers.set(event.pointerId, button);
            setKeyState(button, true);
        });

        const release = (event) => {
            const target = activePointers.get(event.pointerId);
            if (!target) {
                return;
            }

            activePointers.delete(event.pointerId);
            setKeyState(target, false);
        };

        button.addEventListener('pointerup', release);
        button.addEventListener('pointercancel', release);
        button.addEventListener('pointerleave', release);
    }
}

/**
 * Tracks the keyboard controls used by the plane simulation.
 *
 * @returns {KeyboardState}
 */
export function createKeyboardState() {
    const keyboard = {
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

    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const mappedKey = KEY_BINDINGS[key];

        if (mappedKey) {
            keyboard[mappedKey] = true;
        } else if (event.code === 'Space') {
            event.preventDefault();
            keyboard.space = true;
        }
    });

    window.addEventListener('keyup', (event) => {
        const key = event.key.toLowerCase();
        const mappedKey = KEY_BINDINGS[key];

        if (mappedKey) {
            keyboard[mappedKey] = false;
        } else if (event.code === 'Space') {
            event.preventDefault();
            keyboard.space = false;
        }
    });

    createVirtualControls(keyboard);
    createVirtualStick(keyboard);

    return keyboard;
}
