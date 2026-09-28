import { aircraftCapabilities } from '../aircraft/capabilities.js';
import { BOMB_CONFIG } from '../flight/bombs.js';

/** Concise controls for only the selected aircraft. @param {string} aircraft */
export function updateFlightGuide(aircraft) {
    const { jet, weapon } = aircraftCapabilities(aircraft);
    const list = document.querySelector('#instructions-panel ul');
    if (!list) return;
    const rows = [
        ['W / S', 'Thrust up/down'],
        ['A / D', 'Rudder'],
        ['← / →', 'Bank & turn'],
        ['↓ / ↑', 'Pitch up/down'],
        [
            'Space',
            weapon === 'bomb'
                ? 'Drop one bomb'
                : weapon === 'smoke'
                  ? 'Toggle blue smoke'
                  : jet
                    ? 'Fire cannon'
                    : 'Fire tracers'
        ],
        ...(jet
            ? [
                  ['G', 'Toggle landing gear'],
                  ['Hold W', 'Afterburner at full thrust'],
                  ['Hold S', 'Airbrakes at zero thrust']
              ]
            : []),
        ['C', 'Switch camera view'],
        ['P', 'Settings and pause'],
        ['Hold M', 'Full map']
    ];
    list.replaceChildren(
        ...rows.map(([key, action]) => {
            const item = document.createElement('li');
            if (key.startsWith('Hold ')) item.append('Hold ');
            key.replace(/^Hold /, '')
                .split(' / ')
                .forEach((keyName, index) => {
                    if (index) item.append(' / ');
                    const binding = document.createElement('kbd');
                    binding.textContent = keyName;
                    item.append(binding);
                });
            item.append(`: ${action}`);
            return item;
        })
    );
    document.querySelector('.bomb-guide-note')?.remove();
    if (weapon === 'bomb') {
        const note = document.createElement('p');
        note.className = 'bomb-guide-note';
        note.textContent = `6 bombs · ${BOMB_CONFIG.reloadSeconds} s reload · minimum height ${BOMB_CONFIG.minimumReleaseHeight} m`;
        list.after(note);
    }
    const mobile = document.getElementById('mobile-guide');
    if (mobile)
        mobile.textContent = `Mobile: stick to steer · slider for thrust · video-camera button to switch view${jet ? ' · Boost for afterburner' : ''}${weapon === 'bomb' ? ' · Drop bomb to release' : ''}${weapon === 'smoke' ? ' · Smoke to toggle blue trail' : ''}.`;
}
