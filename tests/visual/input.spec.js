import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.goto('/3d-plane/?automation=1');
    await expect(
        page.getByRole('button', { name: 'Take control' })
    ).toBeVisible();
});

test('blur and hidden-page events clear held keyboard and touch controls', async ({
    page
}) => {
    const result = await page.evaluate(async () => {
        const { createKeyboardState } = await import('/3d-plane/src/input.js');
        const state = createKeyboardState();
        const button = document.querySelector('[data-key="space"]');
        // Synthetic pointer IDs have no native capture; stub capture only in this fixture.
        button.setPointerCapture = () => {};
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
        button.dispatchEvent(
            new PointerEvent('pointerdown', { pointerId: 10, bubbles: true })
        );
        const before = { throttle: state.w, fire: state.space };
        window.dispatchEvent(new Event('blur'));
        const afterBlur = {
            throttle: state.w,
            fire: state.space,
            button: button.dataset.active
        };
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown' })
        );
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true
        });
        document.dispatchEvent(new Event('visibilitychange'));
        const afterHidden = state.arrowDown;
        delete document.hidden;
        return { before, afterBlur, afterHidden };
    });
    expect(result.before).toEqual({ throttle: true, fire: true });
    expect(result.afterBlur).toEqual({
        throttle: false,
        fire: false,
        button: 'false'
    });
    expect(result.afterHidden).toBe(false);
});

test('pointer cancellation and lost capture release buttons', async ({
    page
}) => {
    const result = await page.evaluate(async () => {
        const { createKeyboardState } = await import('/3d-plane/src/input.js');
        const state = createKeyboardState();
        const button = document.querySelector('[data-key="w"]');
        button.setPointerCapture = () => {};
        button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1 }));
        button.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2 }));
        button.dispatchEvent(
            new PointerEvent('pointercancel', { pointerId: 1 })
        );
        const oneHeld = state.w;
        button.dispatchEvent(
            new PointerEvent('lostpointercapture', { pointerId: 2 })
        );
        return { oneHeld, released: !state.w, active: button.dataset.active };
    });
    expect(result).toEqual({ oneHeld: true, released: true, active: 'false' });
});

test('camera ignores key repeat and controls focused on form widgets', async ({
    page
}) => {
    const result = await page.evaluate(async () => {
        const { createCameraModeToggle } =
            await import('/3d-plane/src/camera.js');
        const { createKeyboardState } = await import('/3d-plane/src/input.js');
        const mode = createCameraModeToggle();
        const state = createKeyboardState();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
        window.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'c', repeat: true })
        );
        const select = document.getElementById('graphics-quality');
        select.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'c', bubbles: true })
        );
        select.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'w', bubbles: true })
        );
        return { camera: mode.getMode(), throttle: state.w };
    });
    expect(result).toEqual({ camera: 'cockpit', throttle: false });
});
