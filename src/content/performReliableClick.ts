import type { VirtualCursor } from "./virtualCursor";

const clickableSelector = 'button, a, input, textarea, select, [role="button"], [tabindex]';

const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

const centerOf = (el: Element) => {
    const rect = el.getBoundingClientRect();
    return {
        x: Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2)),
        y: Math.max(1, Math.min(window.innerHeight - 1, rect.top + rect.height / 2))
    };
};

export const performReliableClick = async (el: HTMLElement, cursor: VirtualCursor, alpha = 0.2) => {
    await nextFrame();
    await nextFrame();
    const { x, y } = centerOf(el);
    await cursor.moveTo(x, y, { alpha });
    await sleep(35);
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const target =
        (hit?.closest(clickableSelector) as HTMLElement | null) ||
        (el.closest(clickableSelector) as HTMLElement | null) ||
        el;
    target.focus?.();
    target.click();
};
