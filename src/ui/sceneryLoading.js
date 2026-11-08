/** @type {Record<string, {image: string, caption: string, detail: string}[]>} */
const SLIDES = {
    'saint-cyr': [
        {
            image: 'versailles',
            caption: 'Above Versailles',
            detail: 'Discover the palace and its gardens from the air.'
        },
        {
            image: 'cockpit',
            caption: 'A pilot’s view',
            detail: 'Settle into the cockpit and explore at your own pace.'
        },
        {
            image: 'evening',
            caption: 'An evening at Saint-Cyr',
            detail: 'A quiet airfield, with room to wander.'
        }
    ],
    luxeuil: [
        {
            image: 'countryside',
            caption: 'Above Haute-Saône',
            detail: 'Explore rivers and countryside in the Mirage 2000.'
        },
        {
            image: 'afterburner',
            caption: 'Light the afterburner',
            detail: 'Start your departure from Luxeuil.'
        },
        {
            image: 'evening',
            caption: 'The evening flight',
            detail: 'Find your own route through the sunset.'
        }
    ],
    tehran: [
        {
            image: 'azadi',
            caption: 'Above Azadi Square',
            detail: 'Explore Tehran in the F-4 Phantom.'
        },
        {
            image: 'golden-crown',
            caption: 'Fly with Golden Crown',
            detail: 'Take command of the six-aircraft formation.'
        },
        {
            image: 'mountains',
            caption: 'Toward the Alborz',
            detail: 'Find your own view of the mountains.'
        }
    ]
};

/** Local in-game photography for the selected flight.
 * @param {HTMLElement} element
 * @param {{id: string, title: string}} mission
 */
export function createSceneryLoading(element, mission) {
    element.classList.add('flight-loading');
    element.setAttribute('role', 'region');
    const destination = mission.title.split(' · ')[0];
    element.setAttribute('aria-label', `Preparing ${destination} flight`);
    element.innerHTML = `<div class="flight-loading-slides" aria-hidden="true"></div>
        <header class="flight-loading-heading"><span>OPEN SKIES / FLIGHT EXPERIENCES</span><h1></h1></header>
        <button class="flight-loading-pause" type="button" aria-label="Pause slideshow" hidden>Pause slideshow</button>
        <footer class="flight-loading-footer"><div class="flight-loading-track" aria-hidden="true"><span></span></div><p role="status" aria-atomic="true"></p>
        <small>In-game views · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a> · <a href="${import.meta.env.BASE_URL}data/terrain-attribution.md" target="_blank" rel="noreferrer">Elevation credits</a></small></footer>`;
    const slides = /** @type {HTMLElement} */ (
        element.querySelector('.flight-loading-slides')
    );
    const status = /** @type {HTMLElement} */ (
        element.querySelector('[role="status"]')
    );
    const pause = /** @type {HTMLButtonElement} */ (
        element.querySelector('button')
    );
    const heading = /** @type {HTMLHeadingElement} */ (
        element.querySelector('h1')
    );
    heading.textContent = mission.title;
    status.textContent = `Loading ${destination} scenery…`;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    /** @type {Animation[]} */
    let animations = [];
    let disposed = false;
    let paused = false;
    const photographs = SLIDES[mission.id];
    const start = Math.floor(Math.random() * photographs.length);
    const ordered = [
        ...photographs.slice(start),
        ...photographs.slice(0, start)
    ];

    function updateMotion() {
        const still = reducedMotion.matches || paused;
        element.classList.toggle('is-still', reducedMotion.matches);
        for (const animation of animations) {
            if (still) animation.pause();
            else animation.play();
        }
        pause.hidden = reducedMotion.matches || animations.length === 0;
        pause.textContent = paused ? 'Play slideshow' : 'Pause slideshow';
        pause.setAttribute('aria-label', pause.textContent);
    }
    pause.onclick = () => {
        paused = !paused;
        updateMotion();
    };
    reducedMotion.addEventListener('change', updateMotion);
    updateMotion();

    // Load the opening photograph first; later images never block flight setup.
    async function loadSlides() {
        /** @type {HTMLElement[]} */
        const ready = [];
        for (const slide of ordered) {
            if (disposed) return;
            const frame = document.createElement('figure');
            frame.className = 'flight-loading-slide';
            const image = new Image();
            image.alt = '';
            image.decoding = 'async';
            image.fetchPriority = ready.length ? 'low' : 'high';
            image.src = `${import.meta.env.BASE_URL}previews/${mission.id}-loading/${slide.image}.webp`;
            const caption = document.createElement('figcaption');
            const title = document.createElement('h2');
            title.textContent = slide.caption;
            const detail = document.createElement('p');
            detail.textContent = slide.detail;
            caption.append(title, detail);
            frame.append(image, caption);
            slides.append(frame);
            try {
                await image.decode();
            } catch {
                frame.remove();
                continue;
            }
            if (disposed) return;
            if (!ready.length) frame.classList.add('is-first');
            ready.push(frame);
            if (reducedMotion.matches) return;
        }
        if (disposed || ready.length < 2 || reducedMotion.matches) return;
        const duration = ready.length * 3000;
        const fade = 400 / duration;
        animations = ready.map((frame, index) =>
            frame.animate(
                [
                    { opacity: 0, offset: 0 },
                    { opacity: 1, offset: fade },
                    { opacity: 1, offset: 1 / ready.length },
                    { opacity: 0, offset: 1 / ready.length + fade },
                    { opacity: 0, offset: 1 }
                ],
                {
                    duration,
                    delay: index * 3000 - 400,
                    iterations: Infinity,
                    fill: 'both'
                }
            )
        );
        updateMotion();
    }
    void loadSlides();

    return {
        /** Let the browser paint the current stage before the next setup task.
         * @param {string} [message]
         */
        async paint(message) {
            if (message) status.textContent = message;
            await new Promise((resolve) => {
                let frame = 0;
                const finish = () => {
                    clearTimeout(fallback);
                    cancelAnimationFrame(frame);
                    resolve(undefined);
                };
                // A backgrounded page may stop receiving animation frames.
                const fallback = setTimeout(finish, document.hidden ? 0 : 50);
                if (!document.hidden)
                    frame = requestAnimationFrame(() => setTimeout(finish, 0));
            });
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const animation of animations) animation.cancel();
            reducedMotion.removeEventListener('change', updateMotion);
            element.remove();
        }
    };
}
