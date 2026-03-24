import { createVirtualCursor } from "./content/virtualCursor";
import { performReliableClick } from "./content/performReliableClick";

console.log("General Agent Content Script Loaded");

const interactableSelector = 'button, a, input, textarea, select, [role="button"], [role="textbox"], [role="link"], [role="combobox"], [role="menuitem"], [role="option"], [role="checkbox"], [role="radio"], [role="tab"], [role="switch"], [contenteditable="true"], [tabindex]';
const agentIdAttr = 'data-agent-id';
let agentIdCounter = 0;
const virtualCursor = createVirtualCursor();

const getOrAssignAgentId = (el: Element) => {
    const existing = el.getAttribute(agentIdAttr);
    if (existing) return existing;
    const id = `el_${Date.now().toString(36)}_${(agentIdCounter++).toString(36)}`;
    el.setAttribute(agentIdAttr, id);
    return id;
}

const isElementVisible = (el: Element) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0') return false;
    return rect.bottom > 0 && rect.right > 0;
};

const collectInteractables = () => {
    const elements = Array.from(document.querySelectorAll(interactableSelector));
    return elements.filter(el => {
        if (!isElementVisible(el)) return false;
        const rect = el.getBoundingClientRect();
        return rect.bottom > 0 && rect.top < window.innerHeight;
    });
}

const collectInteractablesAll = () => {
    const elements = Array.from(document.querySelectorAll(interactableSelector));
    return elements.filter(isElementVisible);
}

const getScrollableContainers = () => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>('div, section, main, aside, article'));
    return candidates.filter(el => {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const canScroll = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 40;
        const rect = el.getBoundingClientRect();
        return canScroll && rect.height > 150 && rect.width > 200;
    });
}

const pickBestScrollable = () => {
    const containers = getScrollableContainers();
    if (containers.length === 0) return document.scrollingElement || document.documentElement;
    const centerY = window.innerHeight / 2;
    const scored = containers.map(el => {
        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - centerY);
        const score = rect.height - distance;
        return { el, score };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].el;
}

const getElementText = (el: Element) => {
    let text = "";
    if (el instanceof HTMLElement) text = el.innerText;
    if (el instanceof HTMLInputElement) text = el.placeholder || el.value;
    if (!text) text = el.getAttribute("aria-label") || "";
    if (!text) text = el.getAttribute("title") || "";
    return text.replace(/\s+/g, ' ').trim();
}

const buildElementMap = () => {
    const elements = Array.from(document.querySelectorAll(interactableSelector)).filter(isElementVisible);
    return elements.map(el => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el as Element);
        const id = getOrAssignAgentId(el);
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const type = (el as HTMLInputElement).type || '';
        const name = el.getAttribute('name') || '';
        const placeholder = (el as HTMLInputElement).placeholder || '';
        const ariaLabel = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const href = (el as HTMLAnchorElement).href || '';
        const disabled = (el as HTMLInputElement).disabled || false;
        const text = getElementText(el);
        return {
            id,
            tag,
            role,
            type,
            name,
            placeholder,
            ariaLabel,
            title,
            href,
            text,
            disabled,
            rect: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            style: {
                color: style.color,
                backgroundColor: style.backgroundColor,
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                zIndex: style.zIndex
            }
        };
    });
}

const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    const proto = Object.getPrototypeOf(el);
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
        setter.call(el, value);
    } else {
        (el as any).value = value;
    }
}

const getPageContent = () => {
    const interactables = collectInteractables();
    let summary = "";

    interactables.forEach((el, index) => {
        const text = getElementText(el);
        if (text) {
            const tag = el.tagName.toLowerCase();
            const id = el.getAttribute("id") || "";
            const name = el.getAttribute("name") || "";
            const role = el.getAttribute("role") || "";
            const type = (el as HTMLInputElement).type || "";
            const title = el.getAttribute("title") || "";
            summary += `[${index}] [${tag}] "${text}" id="${id}" name="${name}" role="${role}" type="${type}" title="${title}"\n`;
        }
    });

    const containers = getScrollableContainers();
    const containerSummary = containers.map((el, i) => {
        const rect = el.getBoundingClientRect();
        return `[${i}] scrollable height=${Math.round(rect.height)} width=${Math.round(rect.width)}`;
    }).join("\n");

    const mainText = document.body.innerText.replace(/\s+/g, ' ').substring(0, 3000);

    return `Interactive Elements:\n${summary}\n\nScrollable Containers:\n${containerSummary}\n\nVisible Text:\n${mainText}`;
}

const getViewportInfo = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio || 1,
    scrollX: window.scrollX,
    scrollY: window.scrollY
})

const dataUrlToFile = async (dataUrl: string, name: string, type: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: type || blob.type || 'application/octet-stream' });
}

const pickFileInput = (root?: HTMLElement | null) => {
    if (root) {
        if (root instanceof HTMLInputElement && root.type === 'file') return root;
        const within = root.querySelector('input[type="file"]') as HTMLInputElement | null;
        if (within) return within;
    }
    const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="file"]')
    ).filter(el => !el.disabled);
    if (inputs.length === 0) return null;
    const visible = inputs.find((el) => isElementVisible(el));
    if (visible) return visible;
    // Many modern job forms keep file inputs hidden and trigger them via custom buttons.
    return inputs[0];
}

const executeAction = async (action: any, assets?: any[]) => {
    console.log("Executing:", action);
    const { action: act, params = {} } = action || {};
    if (!act) return "Invalid action payload";

    try {
        if (act === "CLICK") {
            const label = String(params.label || '').trim();
            if (!label) return "Missing label for CLICK";
            const el = findElementByText(label);
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                await performReliableClick(el, virtualCursor, Number(params?.alpha ?? 0.2));
                return `Clicked "${label}"`;
            }
            return `Failed to find element "${label}"`;
        }

        if (act === "CLICK_INDEX") {
            const index = Number(params.index);
            const list = collectInteractables();
            const el = list[index];
            if (el instanceof HTMLElement) {
                el.scrollIntoView({ block: "center", inline: "center" });
                await performReliableClick(el, virtualCursor, Number(params?.alpha ?? 0.2));
                return `Clicked index ${index}`;
            }
            return `Failed to click index ${index}`;
        }

        if (act === "CLICK_ID") {
            const id = params.id;
            const el = document.querySelector(`[${agentIdAttr}="${CSS.escape(id)}"]`) as HTMLElement | null;
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                await performReliableClick(el, virtualCursor, Number(params?.alpha ?? 0.2));
                return `Clicked id ${id}`;
            }
            return `Failed to find element id ${id}`;
        }

        if (act === "CLICK_COORDS") {
            const x = Number(params.x);
            const y = Number(params.y);
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            if (el) {
                await virtualCursor.clickAt(el, x, y, { alpha: Number(params?.alpha ?? 0.2) });
                return `Clicked coords ${x},${y}`;
            }
            return `Failed to find element at ${x},${y}`;
        }

        if (act === "TYPE") {
            const label = String(params.label || '').trim();
            const text = String(params.text ?? '');
            if (!label) return "Missing label for TYPE";
            const el = findElementByPlaceholderOrLabel(label);
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.moveTo(x, y, { alpha: Number(params?.alpha ?? 0.2) });
                (el as HTMLElement).focus();
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    setNativeValue(el, text);
                } else if (el instanceof HTMLSelectElement) {
                    el.value = text;
                } else if ((el as HTMLElement).isContentEditable) {
                    el.textContent = text;
                }
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return `Typed "${text}" into "${label}"`;
            }
            return `Failed to find input "${label}"`;
        }

        if (act === "TYPE_ID") {
            const { id, text } = params;
            if (!id) return "Missing id for TYPE_ID";
            const el = document.querySelector(`[${agentIdAttr}="${CSS.escape(id)}"]`) as HTMLElement | null;
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.moveTo(x, y, { alpha: Number(params?.alpha ?? 0.2) });
                el.focus();
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    setNativeValue(el, text);
                } else if (el instanceof HTMLSelectElement) {
                    el.value = text;
                } else if (el.isContentEditable) {
                    el.textContent = text;
                }
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return `Typed "${text}" into id ${id}`;
            }
            return `Failed to find element id ${id}`;
        }

        if (act === "TYPE_COORDS") {
            const x = Number(params.x);
            const y = Number(params.y);
            const text = String(params.text ?? '');
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            if (el) {
                await virtualCursor.moveTo(x, y, { alpha: Number(params?.alpha ?? 0.2) });
                el.focus();
                if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    setNativeValue(el, text);
                } else if (el instanceof HTMLSelectElement) {
                    el.value = text;
                } else if (el.isContentEditable) {
                    el.textContent = text;
                }
                el.dispatchEvent(new InputEvent('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return `Typed "${text}" at ${x},${y}`;
            }
            return `Failed to find element at ${x},${y}`;
        }

        if (act === "SCROLL") {
            const directionName = params?.direction === "up" ? "up" : "down";
            const direction = directionName === "up" ? -500 : 500;
            const target = pickBestScrollable();
            if (target instanceof Element) {
                const { x, y } = virtualCursor.centerOf(target);
                await virtualCursor.wheelAt(x, y, directionName, { alpha: Number(params?.alpha ?? 0.2) });
            }
            target.scrollBy({ top: direction, behavior: "smooth" });
            return direction > 0 ? "Scrolled down" : "Scrolled up";
        }

        if (act === "WAIT") {
            const ms = Math.max(250, Math.min(10000, Number(params?.ms || 1000)));
            await new Promise(r => setTimeout(r, ms));
            return `Waited ${ms}ms`;
        }

        if (act === "HOVER") {
            const label = String(params.label || '').trim();
            if (!label) return "Missing label for HOVER";
            const el = findElementByText(label);
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.hoverAt(el, x, y, { alpha: Number(params?.alpha ?? 0.2) });
                return `Hovered "${label}"`;
            }
            return `Failed to find element "${label}"`;
        }

        if (act === "HOVER_ID") {
            const id = params.id;
            const el = document.querySelector(`[${agentIdAttr}="${CSS.escape(id)}"]`) as HTMLElement | null;
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.hoverAt(el, x, y, { alpha: Number(params?.alpha ?? 0.2) });
                return `Hovered id ${id}`;
            }
            return `Failed to find element id ${id}`;
        }

        if (act === "HOVER_COORDS") {
            const x = Number(params.x);
            const y = Number(params.y);
            const el = document.elementFromPoint(x, y) as HTMLElement | null;
            if (el) {
                await virtualCursor.hoverAt(el, x, y, { alpha: Number(params?.alpha ?? 0.2) });
                return `Hovered coords ${x},${y}`;
            }
            return `Failed to find element at ${x},${y}`;
        }

        if (act === "UPLOAD_ASSET") {
            const assetName = String(params.assetName || '');
            if (!assetName) return "Missing assetName";
            const asset = Array.isArray(assets) ? assets.find(a => a?.name === assetName) : null;
            if (!asset?.dataUrl) return `Asset not found: ${assetName}`;
            let target: HTMLElement | null = null;
            if (params.id) {
                target = document.querySelector(`[${agentIdAttr}="${CSS.escape(params.id)}"]`) as HTMLElement | null;
            } else if (typeof params.x === 'number' && typeof params.y === 'number') {
                target = document.elementFromPoint(params.x, params.y) as HTMLElement | null;
            } else if (params.label) {
                target = findElementByText(params.label);
            }
            const input = pickFileInput(target);
            if (!input) return "No file input found";
            const file = await dataUrlToFile(asset.dataUrl, asset.name, asset.type || '');
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return `Uploaded asset ${asset.name}`;
        }

        if (act === "SELECT") {
            const label = String(params.label || '').trim();
            const value = String(params.value ?? '');
            if (!label) return "Missing label for SELECT";
            const el = findElementByPlaceholderOrLabel(label) as HTMLInputElement | HTMLSelectElement | HTMLElement | null;
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.moveTo(x, y, { alpha: Number(params?.alpha ?? 0.2) });
                if (el instanceof HTMLSelectElement) {
                    const option = Array.from(el.options).find(o => o.value === value || o.text.toLowerCase() === String(value).toLowerCase());
                    if (option) el.value = option.value;
                } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    setNativeValue(el, value);
                } else if ((el as HTMLElement).isContentEditable) {
                    el.textContent = String(value);
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return `Selected "${value}" in "${label}"`;
            }
            return `Failed to find select "${label}"`;
        }

        if (act === "SELECT_ID") {
            const { id, value } = params;
            if (!id) return "Missing id for SELECT_ID";
            const el = document.querySelector(`[${agentIdAttr}="${CSS.escape(id)}"]`) as HTMLInputElement | HTMLSelectElement | HTMLElement | null;
            if (el) {
                el.scrollIntoView({ block: "center", inline: "center" });
                const { x, y } = virtualCursor.centerOf(el);
                await virtualCursor.moveTo(x, y, { alpha: Number(params?.alpha ?? 0.2) });
                if (el instanceof HTMLSelectElement) {
                    const option = Array.from(el.options).find(o => o.value === value || o.text.toLowerCase() === String(value).toLowerCase());
                    if (option) el.value = option.value;
                } else if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
                    setNativeValue(el, value);
                } else if (el.isContentEditable) {
                    el.textContent = String(value);
                }
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                return `Selected "${value}" in id ${id}`;
            }
            return `Failed to find element id ${id}`;
        }

        if (act === "KEY") {
            const key = params.key || "Enter";
            const event = new KeyboardEvent('keydown', { key, bubbles: true });
            const target = document.activeElement || document.body;
            target.dispatchEvent(event);
            return `Pressed ${key}`;
        }

        if (act === "NAVIGATE") {
            window.location.href = params.url;
            return `Navigating to ${params.url}`;
        }
    } catch (e) {
        return `Error executing action: ${e}`;
    }

    return "Action executed (or unknown)";
}

const findElementByText = (text: string): HTMLElement | null => {
    if (!text) return null;
    // Case insensitive partial match for robustness
    const lower = text.toLowerCase();
    const candidates = collectInteractablesAll();
    const scored = candidates.map(el => {
        const label = getElementText(el).toLowerCase();
        let score = 0;
        if (label === lower) score += 6;
        if (label.startsWith(lower)) score += 4;
        if (label.includes(lower)) score += 2;
        const tag = el.tagName.toLowerCase();
        if (tag === 'button') score += 2;
        if (tag === 'a') score += 1;
        return { el: el as HTMLElement, score };
    }).filter(s => s.score > 0);
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.el || null;
}

const scoreLabelMatch = (label: string, target: string) => {
    if (!label || !target) return 0;
    const l = label.toLowerCase();
    const t = target.toLowerCase();
    let score = 0;
    if (!l) return 0;
    if (l === t) score += 6;
    if (l.startsWith(t)) score += 4;
    if (l.includes(t)) score += 2;
    return score;
}

const getFieldLabels = (el: Element) => {
    const labels: string[] = [];
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el.placeholder) labels.push(el.placeholder);
        if (el.name) labels.push(el.name);
    }
    const aria = el.getAttribute('aria-label');
    if (aria) labels.push(aria);
    const title = el.getAttribute('title');
    if (title) labels.push(title);
    const dataPlaceholder = el.getAttribute('data-placeholder');
    if (dataPlaceholder) labels.push(dataPlaceholder);
    const id = el.getAttribute('id');
    if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label?.textContent) labels.push(label.textContent);
    }
    const parentLabel = el.closest('label');
    if (parentLabel?.textContent) labels.push(parentLabel.textContent);
    return labels.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const findElementByPlaceholderOrLabel = (text: string): HTMLElement | null => {
    if (!text) return null;
    const lower = text.toLowerCase();
    const xpath = `//input[contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //textarea[contains(translate(@placeholder, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //input[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //textarea[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //select[contains(translate(@aria-label, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //input[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //textarea[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')] | //select[contains(translate(@name, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')]`;
    try {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = result.singleNodeValue as HTMLElement;
        if (node) return node;

        const labelResult = document.evaluate(`//label[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${lower}')]`, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const labelEl = labelResult.singleNodeValue as HTMLLabelElement | null;
        if (labelEl?.htmlFor) {
            return document.getElementById(labelEl.htmlFor) as HTMLInputElement;
        }
        if (labelEl) {
            const input = labelEl.querySelector('input, textarea, select');
            return input as HTMLInputElement;
        }
        const candidates = Array.from(document.querySelectorAll('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="combobox"]'));
        const scored = candidates.map(el => {
            const labels = getFieldLabels(el);
            const best = labels.reduce((acc, label) => Math.max(acc, scoreLabelMatch(label, text)), 0);
            return { el: el as HTMLElement, score: best };
        }).filter(item => item.score > 0);
        scored.sort((a, b) => b.score - a.score);
        return scored[0]?.el || null;
    } catch (e) {
        return null;
    }
}

chrome.runtime.onMessage.addListener((request: any, _sender: any, sendResponse: any) => {
    if (request.type === "GET_CONTENT") {
        const content = getPageContent();
        const elements = buildElementMap();
        const viewport = getViewportInfo();
        sendResponse({ content, url: window.location.href, elements, viewport });
    } else if (request.type === "EXECUTE_ACTION") {
        executeAction(request.action, request.assets).then(result => {
            sendResponse({ result });
        });
        return true; // async response
    }
});
