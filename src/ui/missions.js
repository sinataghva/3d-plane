/** Shared mission metadata; only the selected scenery is fetched. */
export const MISSIONS = {
    'saint-cyr': {
        id: 'saint-cyr',
        aircraft: 'cessna',
        title: 'Saint-Cyr · Versailles',
        airfield: 'Saint-Cyr · LFPZ',
        map: 'saint-cyr/map.json',
        elevation: 'saint-cyr/elevation.json',
        image: 'saint-cyr.png',
        name: 'Light aircraft',
        description: 'A quiet departure, royal gardens, and room to wander.',
        traits: ['Relaxed pace', 'Gentle handling', 'Sightseeing']
    },
    luxeuil: {
        id: 'luxeuil',
        aircraft: 'mirage',
        title: 'Luxeuil · Haute-Saône',
        airfield: 'Luxeuil · LFSX',
        map: 'luxeuil/map.json',
        elevation: 'luxeuil/elevation.json',
        image: 'luxeuil.png',
        name: 'Mirage 2000',
        description:
            'Light the afterburner and explore the foothills of the Vosges.',
        traits: ['Jet speed', 'Responsive handling', 'Navigation']
    }
};
/** @param {string|null} id */
export function missionFor(id) {
    return id === 'luxeuil' ? MISSIONS.luxeuil : MISSIONS['saint-cyr'];
}
/** A navigation boundary releases WebGL, listeners, textures and pending flight tasks. */
export function selectFlight() {
    const query = new URLSearchParams(location.search);
    const requested = query.get('mission');
    if (requested && Object.hasOwn(MISSIONS, requested))
        return Promise.resolve(missionFor(requested));
    // Existing opt-in tooling and regression URLs retain their default experience.
    if (query.has('automation') || query.has('visual'))
        return Promise.resolve(MISSIONS['saint-cyr']);
    document.body.classList.add('choosing-flight');
    const screen = document.createElement('main');
    screen.id = 'mission-select';
    screen.innerHTML = `<div class="mission-heading"><span class="eyebrow">OPEN SKIES / FLIGHT EXPERIENCES</span><h1>Where will you fly?</h1><p>Two aircraft. Two corners of France. Explore at your own pace.</p></div><div class="mission-cards" role="group" aria-label="Choose a flight experience"></div><div class="mission-footer"><p id="mission-selection" aria-live="polite">Saint-Cyr · Versailles selected</p><button id="fly-button">Fly Saint-Cyr →</button><small>Free flight comes first. Guides are always optional.</small><small>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="data/terrain-attribution.md" target="_blank" rel="noreferrer">Elevation credits</a></small></div>`;
    document.body.append(screen);
    let selected = MISSIONS['saint-cyr'];
    for (const mission of Object.values(MISSIONS)) {
        const button = document.createElement('button');
        button.className = 'mission-card';
        button.dataset.mission = mission.id;
        button.setAttribute('aria-pressed', String(mission === selected));
        button.innerHTML = `<img src="${import.meta.env.BASE_URL}previews/${mission.image}" alt="${mission.name} flying over ${mission.title}, rendered in the game"/><div class="mission-copy"><span class="eyebrow">${mission.airfield}</span><h2>${mission.name}</h2><p>${mission.description}</p><div class="mission-traits">${mission.traits.map((t) => `<span>${t}</span>`).join('')}</div></div>`;
        button.onclick = () => {
            selected = mission;
            screen
                .querySelectorAll('.mission-card')
                .forEach((el) =>
                    el.setAttribute('aria-pressed', String(el === button))
                );
            const label = document.getElementById('mission-selection');
            if (label) label.textContent = `${mission.title} selected`;
            const fly = document.getElementById('fly-button');
            if (fly)
                fly.textContent = `Fly ${mission.id === 'luxeuil' ? 'Luxeuil' : 'Saint-Cyr'} →`;
        };
        screen.querySelector('.mission-cards')?.append(button);
    }
    return new Promise((resolve) => {
        const fly = /** @type {HTMLButtonElement} */ (
            document.getElementById('fly-button')
        );
        fly.onclick = () => {
            fly.disabled = true;
            screen.remove();
            document.body.classList.remove('choosing-flight');
            query.set('mission', selected.id);
            history.replaceState(null, '', `?${query}`);
            resolve(selected);
        };
    });
}
