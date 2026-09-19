// Scope browser gesture suppression to touch-sized game layouts.
export function setupMobileViewport() {
    const mobile = () =>
        matchMedia(
            '(pointer: coarse), (max-width: 900px) and (max-height: 500px)'
        ).matches;
    for (const type of [
        'selectstart',
        'contextmenu',
        'gesturestart',
        'gesturechange'
    ]) {
        document.addEventListener(
            type,
            (event) => {
                if (mobile()) event.preventDefault();
            },
            { passive: false }
        );
    }
    // Map pinch uses pointer events; native page magnification must not compete.
    document.addEventListener(
        'touchmove',
        (event) => {
            if (mobile() && event.touches.length > 1) event.preventDefault();
        },
        { passive: false }
    );
    const panel = document.getElementById('flight-data');
    const toggle = document.createElement('button');
    toggle.id = 'mobile-data-toggle';
    toggle.textContent = 'Flight details';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.onclick = () => {
        const open = panel?.classList.toggle('mobile-expanded') ?? false;
        toggle.setAttribute('aria-expanded', String(open));
        toggle.textContent = open ? 'Hide details' : 'Flight details';
    };
    panel?.prepend(toggle);
}
