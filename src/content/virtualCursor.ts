type CursorMotionOptions = {
    alpha?: number;
    durationMs?: number;
};

export type VirtualCursor = {
    moveTo: (x: number, y: number, options?: CursorMotionOptions) => Promise<void>;
    hoverAt: (el: Element, x: number, y: number, options?: CursorMotionOptions) => Promise<void>;
    clickAt: (el: Element, x: number, y: number, options?: CursorMotionOptions) => Promise<void>;
    wheelAt: (x: number, y: number, direction: "up" | "down", options?: CursorMotionOptions) => Promise<void>;
    dragBetween: (startX: number, startY: number, endX: number, endY: number, options?: CursorMotionOptions) => Promise<void>;
    centerOf: (el: Element) => { x: number; y: number };
};

export const createVirtualCursor = (): VirtualCursor => {
    const hostId = "__navai_virtual_cursor_host__";
    const pointerId = "__navai_virtual_cursor_dot__";
    const ringId = "__navai_virtual_cursor_ring__";
    const wheelId = "__navai_virtual_cursor_wheel__";

    let x = Math.round(window.innerWidth * 0.5);
    let y = Math.round(window.innerHeight * 0.4);
    let activeMove: Promise<void> = Promise.resolve();
    let hideTimer: number | null = null;

    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const nextFrame = () => new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
    const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

    const ensureElements = () => {
        if (document.getElementById(hostId)) return true;
        if (!document.documentElement) return false;
        const host = document.createElement("div");
        host.id = hostId;
        host.style.position = "fixed";
        host.style.left = "0";
        host.style.top = "0";
        host.style.width = "0";
        host.style.height = "0";
        host.style.pointerEvents = "none";
        host.style.zIndex = "2147483647";
        host.style.opacity = "0";
        host.style.visibility = "hidden";
        host.style.transition = "opacity 140ms ease";

        const ring = document.createElement("div");
        ring.id = ringId;
        ring.style.position = "fixed";
        ring.style.width = "24px";
        ring.style.height = "24px";
        ring.style.borderRadius = "999px";
        ring.style.border = "2px solid rgba(239,68,68,0.9)";
        ring.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.7) inset";
        ring.style.transform = "translate(-50%, -50%) scale(1)";
        ring.style.opacity = "1";
        ring.style.transition = "transform 120ms ease, opacity 120ms ease";

        const dot = document.createElement("div");
        dot.id = pointerId;
        dot.style.position = "fixed";
        dot.style.width = "8px";
        dot.style.height = "8px";
        dot.style.borderRadius = "999px";
        dot.style.background = "rgba(220,38,38,0.98)";
        dot.style.transform = "translate(-50%, -50%)";
        dot.style.boxShadow = "0 0 0 2px rgba(255,255,255,0.86)";

        const wheel = document.createElement("div");
        wheel.id = wheelId;
        wheel.style.position = "fixed";
        wheel.style.width = "10px";
        wheel.style.height = "10px";
        wheel.style.borderRadius = "999px";
        wheel.style.background = "rgba(220,38,38,0.24)";
        wheel.style.border = "1px solid rgba(239,68,68,0.9)";
        wheel.style.transform = "translate(-50%, -50%) scale(0.4)";
        wheel.style.opacity = "0";
        wheel.style.transition = "transform 140ms ease, opacity 140ms ease";

        host.appendChild(ring);
        host.appendChild(dot);
        host.appendChild(wheel);
        (document.body || document.documentElement).appendChild(host);
        return true;
    };

    const showCursor = () => {
        const host = document.getElementById(hostId);
        if (!host) return;
        host.style.visibility = "visible";
        host.style.opacity = "1";
    };

    const hideCursor = () => {
        const host = document.getElementById(hostId);
        if (!host) return;
        host.style.opacity = "0";
        host.style.visibility = "hidden";
    };

    const scheduleHide = (delayMs = 60000) => {
        if (hideTimer != null) window.clearTimeout(hideTimer);
        hideTimer = window.setTimeout(() => {
            hideCursor();
            hideTimer = null;
        }, delayMs);
    };

    const setPosition = (nextX: number, nextY: number) => {
        x = Math.round(clamp(nextX, 1, window.innerWidth - 1));
        y = Math.round(clamp(nextY, 1, window.innerHeight - 1));
        const dot = document.getElementById(pointerId);
        const ring = document.getElementById(ringId);
        const wheel = document.getElementById(wheelId);
        if (dot) {
            dot.style.left = `${x}px`;
            dot.style.top = `${y}px`;
        }
        if (ring) {
            ring.style.left = `${x}px`;
            ring.style.top = `${y}px`;
        }
        if (wheel) {
            wheel.style.left = `${x}px`;
            wheel.style.top = `${y}px`;
        }
    };

    const dispatchMouse = (
        el: Element,
        type: string,
        clientX: number,
        clientY: number,
        init: MouseEventInit = {}
    ) => {
        el.dispatchEvent(new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            clientX,
            clientY,
            view: window,
            ...init
        }));
    };

    const dispatchDrag = (el: Element, type: string, clientX: number, clientY: number, dataTransfer: DataTransfer | null) => {
        try {
            const event = new DragEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
                dataTransfer: dataTransfer || undefined
            });
            el.dispatchEvent(event);
        } catch {
            dispatchMouse(el, type, clientX, clientY);
        }
    };

    const moveTo = async (targetX: number, targetY: number, options?: CursorMotionOptions) => {
        const alpha = clamp(Number(options?.alpha ?? 0.2), 0.05, 0.6);
        const maxDurationMs = clamp(Number(options?.durationMs ?? 850), 250, 2000);
        const run = async () => {
            if (!ensureElements()) return;
            showCursor();
            if (hideTimer != null) {
                window.clearTimeout(hideTimer);
                hideTimer = null;
            }
            const startX = x;
            const startY = y;
            const dx = targetX - startX;
            const dy = targetY - startY;
            const distance = Math.hypot(dx, dy);
            if (distance < 2) {
                setPosition(targetX, targetY);
                scheduleHide();
                return;
            }
            const midpointX = (startX + targetX) / 2;
            const midpointY = (startY + targetY) / 2;
            const perpX = distance ? -dy / distance : 0;
            const perpY = distance ? dx / distance : 0;
            const arcAmplitude = clamp(distance * (0.06 + alpha * 0.2), 5, 90);
            const direction = Math.random() > 0.5 ? 1 : -1;
            const controlX = midpointX + perpX * arcAmplitude * direction;
            const controlY = midpointY + perpY * arcAmplitude * direction;

            let t = 0;
            const startedAt = performance.now();
            while (t < 0.995) {
                t += (1 - t) * alpha;
                const eased = easeInOut(t);
                const inv = 1 - eased;
                const bx = inv * inv * startX + 2 * inv * eased * controlX + eased * eased * targetX;
                const by = inv * inv * startY + 2 * inv * eased * controlY + eased * eased * targetY;
                setPosition(bx, by);
                if (performance.now() - startedAt > maxDurationMs) break;
                await nextFrame();
            }
            setPosition(targetX, targetY);
            scheduleHide();
        };
        activeMove = activeMove.then(run);
        await activeMove;
    };

    const pulseClick = async () => {
        const ring = document.getElementById(ringId);
        if (!ring) return;
        ring.style.transform = "translate(-50%, -50%) scale(0.72)";
        ring.style.opacity = "1";
        await sleep(80);
        ring.style.transform = "translate(-50%, -50%) scale(1)";
        ring.style.opacity = "0.95";
    };

    const pulseWheel = async (direction: "up" | "down") => {
        const wheel = document.getElementById(wheelId);
        if (!wheel) return;
        wheel.style.opacity = "0.95";
        wheel.style.transform = `translate(-50%, -50%) translateY(${direction === "down" ? "8px" : "-8px"}) scale(1.35)`;
        await sleep(110);
        wheel.style.opacity = "0";
        wheel.style.transform = "translate(-50%, -50%) scale(0.4)";
    };

    const hoverAt = async (el: Element, clientX: number, clientY: number, options?: CursorMotionOptions) => {
        await moveTo(clientX, clientY, options);
        dispatchMouse(el, "mousemove", x, y);
        dispatchMouse(el, "mouseover", x, y);
    };

    const clickAt = async (el: Element, clientX: number, clientY: number, options?: CursorMotionOptions) => {
        await moveTo(clientX, clientY, options);
        dispatchMouse(el, "mousemove", x, y);
        dispatchMouse(el, "mouseover", x, y);
        dispatchMouse(el, "mousedown", x, y);
        await pulseClick();
        dispatchMouse(el, "mouseup", x, y);
        dispatchMouse(el, "click", x, y);
    };

    const wheelAt = async (clientX: number, clientY: number, direction: "up" | "down", options?: CursorMotionOptions) => {
        await moveTo(clientX, clientY, options);
        await pulseWheel(direction);
    };

    const dragBetween = async (
        startX: number,
        startY: number,
        endX: number,
        endY: number,
        options?: CursorMotionOptions
    ) => {
        await moveTo(startX, startY, options);
        const startEl = (document.elementFromPoint(x, y) as Element | null) || document.body;
        const dataTransfer = (() => {
            try {
                return new DataTransfer();
            } catch {
                return null;
            }
        })();
        dispatchMouse(startEl, "mousemove", x, y);
        dispatchMouse(startEl, "mouseover", x, y);
        dispatchMouse(startEl, "mousedown", x, y, { button: 0, buttons: 1 });
        dispatchDrag(startEl, "dragstart", x, y, dataTransfer);

        const distance = Math.hypot(endX - startX, endY - startY);
        const steps = Math.max(8, Math.min(45, Math.round(distance / 24)));
        let lastTarget = startEl;
        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const ix = startX + (endX - startX) * t;
            const iy = startY + (endY - startY) * t;
            await moveTo(ix, iy, {
                alpha: Math.max(0.08, Number(options?.alpha ?? 0.2) * 0.85),
                durationMs: 480
            });
            const target = (document.elementFromPoint(x, y) as Element | null) || lastTarget;
            dispatchMouse(target, "mousemove", x, y, { button: 0, buttons: 1 });
            dispatchDrag(target, "dragover", x, y, dataTransfer);
            if (target !== lastTarget) {
                dispatchMouse(target, "mouseover", x, y);
                dispatchDrag(target, "dragenter", x, y, dataTransfer);
            }
            lastTarget = target;
        }

        const endEl = (document.elementFromPoint(x, y) as Element | null) || lastTarget;
        dispatchDrag(endEl, "drop", x, y, dataTransfer);
        dispatchMouse(endEl, "mouseup", x, y, { button: 0, buttons: 0 });
        dispatchDrag(startEl, "dragend", x, y, dataTransfer);
    };

    const centerOf = (el: Element) => {
        const rect = el.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
        };
    };

    return { moveTo, hoverAt, clickAt, wheelAt, dragBetween, centerOf };
};
