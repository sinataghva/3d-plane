import * as THREE from 'three';
import { createUnattendedFlight } from '../flight/unattendedFlight.js';
import { isEditableTarget } from '../flight/input.js';
import './goldenCrownPlayable.css';
/** @param {{display:ReturnType<import('./goldenCrownDisplay.js').createGoldenCrownDisplay>, planeState:import('../flight/physics.js').PlaneState, world:import('../scenery/geography.js').Geography, camera:THREE.PerspectiveCamera, keyboard:import('../flight/input.js').KeyboardState, paused:()=>boolean, onEnter:()=>void}} options */
export function createGoldenCrownPlayable({
    display,
    planeState,
    world,
    camera,
    keyboard,
    paused,
    onEnter
}) {
    const button = document.createElement('button');
    button.id = 'golden-crown-fly';
    button.textContent = 'Fly Golden Crown';
    document.body.append(button);
    const returnButton = document.createElement('button');
    returnButton.id = 'golden-crown-return';
    returnButton.textContent = 'Return to F-4';
    returnButton.setAttribute('aria-label', 'Return to F-4');
    returnButton.title = 'Return to F-4';
    returnButton.hidden = true;
    document.body.append(returnButton);
    const toast = document.createElement('output');
    toast.id = 'golden-crown-toast';
    toast.setAttribute('role', 'status');
    toast.hidden = true;
    document.body.append(toast);
    let toastTimer = 0;
    let pendingStatus = '',
        shownStatus = '',
        statusSince = 0;
    function notify(/** @type {string} */ text) {
        clearTimeout(toastTimer);
        toast.textContent = text;
        toast.hidden = false;
        toastTimer = window.setTimeout(() => {
            toast.hidden = true;
        }, 4000);
    }
    const proxy = new THREE.Group();
    proxy.userData = {
        jet: true,
        chaseDistance: 100,
        cockpitPosition: [5.4, 2.5]
    };
    const flight = { ...display.pilot.flight };
    let hold = createUnattendedFlight(planeState, world);
    const throttle = /** @type {HTMLInputElement|null} */ (
        document.getElementById('touch-throttle')
    );
    const throttleText = document.querySelector('.touch-throttle')?.firstChild;
    const oldThrottleText = throttleText?.textContent;
    const oldThrottleRange = [throttle?.min || '0', throttle?.max || '100'];
    function changeThrottle(/** @type {Event} */ e) {
        if (display.pilot.mode !== 'player' || !throttle) return;
        e.stopImmediatePropagation();
        if (!paused()) display.pilot.setThrottle(Number(throttle.value) / 100);
    }
    throttle?.addEventListener('input', changeThrottle, true);
    const touchAction = document.querySelector('[data-key="space"]');
    const savedTouch = {
        text: touchAction?.textContent || '',
        label: touchAction?.getAttribute('aria-label') || ''
    };
    function clear() {
        window.dispatchEvent(new Event('flight-input-clear'));
        keyboard.bombPresses = 0;
        camera.userData.flightMode = '';
    }
    function enter() {
        if (paused() || display.pilot.mode === 'player') return;
        onEnter();
        hold = createUnattendedFlight(planeState, world);
        clear();
        display.takeControl();
        returnButton.hidden = false;
        pendingStatus = shownStatus = '';
        button.hidden = true;
        document.body.classList.add('golden-crown-playing');
        if (throttleText) throttleText.textContent = 'Speed ';
        throttle?.setAttribute('aria-label', 'Formation speed');
        if (throttle) {
            throttle.min = '0';
            throttle.max = '100';
        }
        refresh();
    }
    function exit() {
        if (display.pilot.mode !== 'player') return;
        display.release();
        display.jets[0].jet.visible = true;
        returnButton.hidden = true;
        clearTimeout(toastTimer);
        toast.hidden = true;
        button.hidden = false;
        document.body.classList.remove('golden-crown-playing');
        if (throttleText)
            throttleText.textContent = oldThrottleText || 'Thrust ';
        throttle?.setAttribute('aria-label', 'Thrust percent');
        if (throttle) [throttle.min, throttle.max] = oldThrottleRange;
        if (touchAction) {
            touchAction.textContent = savedTouch.text;
            touchAction.setAttribute('aria-label', savedTouch.label);
            touchAction.removeAttribute('title');
        }
        clear();
    }
    button.onclick = enter;
    returnButton.onclick = exit;
    // The shared aircraft action counter captures distinct presses and taps.
    // Gear shortcuts bound to the F-4 must not modify it during possession.
    function keys(/** @type {KeyboardEvent} */ e) {
        if (
            display.pilot.mode !== 'player' ||
            isEditableTarget(e.target) ||
            e.ctrlKey ||
            e.metaKey ||
            e.altKey
        )
            return;
        if (e.key.toLowerCase() === 'g') {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }
    window.addEventListener('keydown', keys, true);
    function refresh() {
        if (display.pilot.mode !== 'player') return;
        display.root.updateMatrixWorld(true);
        display.jets[0].jet.getWorldPosition(proxy.position);
        display.jets[0].jet.getWorldQuaternion(proxy.quaternion);
        Object.assign(flight, display.pilot.flight, {
            position: { ...proxy.position },
            attitude: {
                x: proxy.quaternion.x,
                y: proxy.quaternion.y,
                z: proxy.quaternion.z,
                w: proxy.quaternion.w
            }
        });
        const forward = new THREE.Vector3(1, 0, 0).applyQuaternion(
            proxy.quaternion
        );
        flight.yawAngle = Math.atan2(-forward.z, forward.x);
        if (throttle)
            throttle.value = String(
                ((display.pilot.diagnostics.speedTarget - 55) / 185) * 100
            );
        const speedOutput = document.getElementById('touch-thrust-value');
        if (speedOutput)
            speedOutput.textContent = `${Math.round(display.pilot.diagnostics.speedTarget * 3.6)} km/h`;
        const label = display.pilot.status;
        const compact = label.startsWith('Queue another roll')
            ? 'Queue roll'
            : /^(Release solos|Opposed rolls)$/.test(label)
              ? label
              : 'Maneuver';
        const now = performance.now();
        if (pendingStatus !== label) {
            pendingStatus = label;
            statusSince = now;
        }
        if (shownStatus !== label && now - statusSince > 300) {
            shownStatus = label;
            notify(
                label === 'Release solos'
                    ? 'Formation ready · release solos with Space'
                    : label === 'Opposed rolls'
                      ? 'Press Space for one opposed roll'
                      : label.startsWith('Queue another roll')
                        ? `${label} · press Space to queue another`
                        : label
            );
        }
        if (touchAction) {
            touchAction.textContent = compact;
            touchAction.setAttribute('title', label);
            touchAction.setAttribute('aria-label', 'Formation maneuver');
        }
    }
    return {
        enter,
        exit,
        refresh,
        proxy,
        flight,
        get active() {
            return display.pilot.mode === 'player';
        },
        /** @param {number} dt */
        advanceF4(dt) {
            hold.update(dt);
        },
        consumeCommands() {
            if (display.pilot.mode !== 'player') return;
            const count = keyboard.bombPresses || 0;
            keyboard.bombPresses = 0;
            if (!paused())
                for (let i = 0; i < count; i++) {
                    if (!display.pilot.command()) {
                        const reason = display.pilot.status;
                        shownStatus = pendingStatus = reason;
                        statusSince = performance.now();
                        notify(
                            reason === 'Hold level'
                                ? 'Level the aircraft before starting the maneuver'
                                : reason === 'Gain altitude'
                                  ? 'Climb higher before starting the maneuver'
                                  : reason === 'Hold 288–612 km/h'
                                    ? 'Adjust speed to 288–612 km/h before the maneuver'
                                    : reason.startsWith('Regrouping')
                                      ? 'Wait for regrouping · hold speed and heading'
                                      : reason.startsWith('Solos')
                                        ? 'Wait · ' + reason
                                        : reason
                        );
                    }
                }
        },
        dispose() {
            exit();
            button.remove();
            returnButton.remove();
            toast.remove();
            clearTimeout(toastTimer);
            throttle?.removeEventListener('input', changeThrottle, true);
            window.removeEventListener('keydown', keys, true);
        }
    };
}
