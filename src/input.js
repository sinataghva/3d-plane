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
 */

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
        arrowDown: false
    };

    window.addEventListener('keydown', (event) => {
        if (event.key.toLowerCase() === 'w') {
            keyboard.w = true;
        } else if (event.key.toLowerCase() === 's') {
            keyboard.s = true;
        } else if (event.key.toLowerCase() === 'a') {
            keyboard.a = true;
        } else if (event.key.toLowerCase() === 'd') {
            keyboard.d = true;
        } else if (event.key === 'ArrowLeft') {
            keyboard.arrowLeft = true;
        } else if (event.key === 'ArrowRight') {
            keyboard.arrowRight = true;
        } else if (event.key === 'ArrowUp') {
            keyboard.arrowUp = true;
        } else if (event.key === 'ArrowDown') {
            keyboard.arrowDown = true;
        }
    });

    window.addEventListener('keyup', (event) => {
        if (event.key.toLowerCase() === 'w') {
            keyboard.w = false;
        } else if (event.key.toLowerCase() === 's') {
            keyboard.s = false;
        } else if (event.key.toLowerCase() === 'a') {
            keyboard.a = false;
        } else if (event.key.toLowerCase() === 'd') {
            keyboard.d = false;
        } else if (event.key === 'ArrowLeft') {
            keyboard.arrowLeft = false;
        } else if (event.key === 'ArrowRight') {
            keyboard.arrowRight = false;
        } else if (event.key === 'ArrowUp') {
            keyboard.arrowUp = false;
        } else if (event.key === 'ArrowDown') {
            keyboard.arrowDown = false;
        }
    });

    return keyboard;
}
