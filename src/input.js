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
        space: false
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

    return keyboard;
}
