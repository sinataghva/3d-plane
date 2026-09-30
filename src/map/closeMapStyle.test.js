import { expect, test, vi } from 'vitest';
import { paintCloseFeature } from './closeMapStyle.js';

function context() {
    return {
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        setLineDash: vi.fn()
    };
}
test('close-map arrows follow yes and reverse tags, and omit explicitly two-way roads', () => {
    const road = {
        id: 'w1',
        kind: 'road',
        name: '',
        line: true,
        width: 10,
        holes: [],
        points: [
            [0, 0],
            [300, 0]
        ]
    };
    for (const oneway of ['yes', '-1', 'no']) {
        const ctx = context();
        paintCloseFeature(
            /** @type {CanvasRenderingContext2D} */ (
                /** @type {unknown} */ (ctx)
            ),
            { ...road, oneway },
            1,
            0,
            0,
            'symbols'
        );
        if (oneway === 'no') expect(ctx.stroke).not.toHaveBeenCalled();
        else {
            expect(ctx.stroke).toHaveBeenCalledTimes(1);
            const tip = ctx.lineTo.mock.calls[0];
            expect(tip[0]).toBeCloseTo(oneway === 'yes' ? 104.2 : 99.8);
        }
    }
});
test('building outlines preserve source courtyard holes with even-odd fill', () => {
    const ctx = context();
    paintCloseFeature(
        /** @type {CanvasRenderingContext2D} */ (/** @type {unknown} */ (ctx)),
        {
            id: 'w2',
            kind: 'building',
            name: '',
            line: false,
            points: [
                [0, 0],
                [50, 0],
                [50, 50],
                [0, 50],
                [0, 0]
            ],
            holes: [
                [
                    [10, 10],
                    [20, 10],
                    [20, 20],
                    [10, 20],
                    [10, 10]
                ]
            ]
        },
        1,
        0,
        0
    );
    expect(ctx.closePath).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalledWith('evenodd');
});
