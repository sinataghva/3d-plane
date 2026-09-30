import { isIosHomeScreen } from '../flight/recovery.js';

/** Check the entry page before starting a new flight. Vite asset names are
 * hashed, but a cached index.html can still point at an old set of assets. */
export async function useCurrentBuild() {
    if (import.meta.env.DEV || !isIosHomeScreen()) return true;
    const current = document
        .querySelector('meta[name="open-skies-build"]')
        ?.getAttribute('content');
    if (!current) return true;

    const url = new URL(import.meta.env.BASE_URL, location.origin);
    url.searchParams.set('check', String(Date.now()));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
        const response = await fetch(url, {
            cache: 'no-store',
            signal: controller.signal
        });
        if (!response.ok) return true;
        const html = await response.text();
        const latest = html.match(
            /<meta name="open-skies-build" content="([^"]+)"/i
        )?.[1];
        if (!latest || latest === current) return true;
        // A failed cache refresh must not leave the app in a navigation loop.
        const attempted = sessionStorage.getItem('open-skies-update-attempt');
        if (attempted === latest) return true;
        sessionStorage.setItem('open-skies-update-attempt', latest);
        const target = new URL(location.href);
        target.searchParams.set('build', latest);
        location.replace(target.href);
        return false;
    } catch {
        // A network failure should not prevent an already loaded flight.
        return true;
    } finally {
        clearTimeout(timeout);
    }
}
