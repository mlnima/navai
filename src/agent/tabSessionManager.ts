export interface TabSessionState {
    mainTabId: number | null;
    currentTabId: number | null;
    openedTabIds: number[];
    updatedAt: number;
}

interface SwitchTabParams {
    tabId?: number;
    index?: number;
    urlContains?: string;
}

const storageKeyFor = (sessionId: string) => `agent_tab_state_${sessionId}`;

const now = () => Date.now();

const sanitizeIds = (ids: number[]) =>
    Array.from(new Set(ids.filter((id) => Number.isInteger(id) && id > 0)));

const loadState = (sessionId: string): TabSessionState => {
    try {
        const raw = localStorage.getItem(storageKeyFor(sessionId));
        if (!raw) {
            return { mainTabId: null, currentTabId: null, openedTabIds: [], updatedAt: now() };
        }
        const parsed = JSON.parse(raw);
        return {
            mainTabId: Number.isInteger(parsed?.mainTabId) ? parsed.mainTabId : null,
            currentTabId: Number.isInteger(parsed?.currentTabId) ? parsed.currentTabId : null,
            openedTabIds: sanitizeIds(Array.isArray(parsed?.openedTabIds) ? parsed.openedTabIds : []),
            updatedAt: Number.isFinite(parsed?.updatedAt) ? parsed.updatedAt : now()
        };
    } catch {
        return { mainTabId: null, currentTabId: null, openedTabIds: [], updatedAt: now() };
    }
};

const tabExists = async (tabId: number | null) => {
    if (!tabId) return false;
    try {
        await chrome.tabs.get(tabId);
        return true;
    } catch {
        return false;
    }
};

export const clearTabSessionState = (sessionId: string) => {
    localStorage.removeItem(storageKeyFor(sessionId));
};

export const createTabSessionManager = (sessionId: string) => {
    let state = loadState(sessionId);

    const persist = () => {
        state = { ...state, updatedAt: now() };
        localStorage.setItem(storageKeyFor(sessionId), JSON.stringify(state));
    };

    const normalize = async () => {
        const existingOpened: number[] = [];
        for (const tabId of state.openedTabIds) {
            if (await tabExists(tabId)) existingOpened.push(tabId);
        }
        const mainAlive = await tabExists(state.mainTabId);

        state.mainTabId = mainAlive ? state.mainTabId : null;
        state.openedTabIds = sanitizeIds(existingOpened.filter((id) => id !== state.mainTabId));
        const activeTab = await getActiveTabInLastFocusedWindow();
        const activeTabId = Number.isInteger(activeTab?.id) ? Number(activeTab?.id) : null;
        const openerTabId = Number.isInteger(activeTab?.openerTabId) ? Number(activeTab?.openerTabId) : null;
        if (
            activeTabId &&
            isManaged(activeTabId) &&
            (!state.currentTabId || !isManaged(state.currentTabId))
        ) {
            state.currentTabId = activeTabId;
        } else if (
            activeTabId &&
            openerTabId &&
            isManaged(openerTabId)
        ) {
            // If a managed tab opens a new tab via page click, adopt it into this session.
            if (activeTabId !== state.mainTabId && !state.openedTabIds.includes(activeTabId)) {
                state.openedTabIds.push(activeTabId);
                state.openedTabIds = sanitizeIds(state.openedTabIds);
            }
            state.currentTabId = activeTabId;
        }
        const currentAlive = await tabExists(state.currentTabId);
        if (!currentAlive || (state.currentTabId && !isManaged(state.currentTabId))) {
            state.currentTabId = state.mainTabId ?? state.openedTabIds[0] ?? null;
        }
        persist();
    };

    const managedIds = () =>
        sanitizeIds([state.mainTabId || -1, ...state.openedTabIds].filter((id) => id > 0));

    const isManaged = (tabId: number) => managedIds().includes(tabId);

    const getActiveTabInLastFocusedWindow = async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            return tab ?? null;
        } catch {
            return null;
        }
    };

    const activateTab = async (tabId: number) => {
        const tab = await chrome.tabs.get(tabId);
        if (Number.isInteger(tab.windowId)) {
            await chrome.windows.update(tab.windowId, { focused: true });
        }
        await chrome.tabs.update(tabId, { active: true });
    };

    const beginRun = async (startingTabId: number) => {
        await normalize();
        state.mainTabId = startingTabId;
        state.currentTabId = startingTabId;
        state.openedTabIds = sanitizeIds(state.openedTabIds.filter((id) => id !== startingTabId));
        persist();
    };

    const getTargetTabId = async () => {
        await normalize();
        if (state.currentTabId && await tabExists(state.currentTabId)) return state.currentTabId;
        if (state.mainTabId && await tabExists(state.mainTabId)) {
            state.currentTabId = state.mainTabId;
            persist();
            return state.currentTabId;
        }
        const firstOpened = state.openedTabIds[0];
        if (firstOpened && await tabExists(firstOpened)) {
            state.currentTabId = firstOpened;
            persist();
            return state.currentTabId;
        }
        return null;
    };

    const openTab = async (url: string, background = false) => {
        const tab = await chrome.tabs.create({ url, active: !background });
        if (!tab.id) return "Failed to open tab.";
        if (tab.id !== state.mainTabId && !state.openedTabIds.includes(tab.id)) {
            state.openedTabIds.push(tab.id);
        }
        if (!background) {
            state.currentTabId = tab.id;
        }
        persist();
        return `Opened tab ${tab.id} (${url})`;
    };

    const switchTab = async (params: SwitchTabParams) => {
        await normalize();
        const ids = managedIds();
        if (ids.length === 0) return "No managed tabs available.";

        let targetId: number | null = null;
        if (typeof params.tabId === "number" && isManaged(params.tabId)) {
            targetId = params.tabId;
        } else if (typeof params.index === "number") {
            const sorted = ids;
            targetId = sorted[params.index] ?? null;
        } else if (typeof params.urlContains === "string" && params.urlContains.trim()) {
            const tabs = await Promise.all(ids.map(async (id) => {
                try {
                    return await chrome.tabs.get(id);
                } catch {
                    return null;
                }
            }));
            const hit = tabs.find((tab) => tab?.url?.toLowerCase().includes(params.urlContains!.toLowerCase()));
            targetId = hit?.id ?? null;
        }

        if (!targetId) return "Failed to switch tab (target not found in managed tabs).";
        await activateTab(targetId);
        state.currentTabId = targetId;
        persist();
        return `Switched to tab ${targetId}`;
    };

    const closeTab = async (tabId?: number) => {
        await normalize();
        const targetId = Number.isInteger(tabId) ? tabId! : state.currentTabId;
        if (!targetId) return "No tab selected to close.";
        if (targetId === state.mainTabId) return "Refused to close main tab.";
        if (!state.openedTabIds.includes(targetId)) {
            return "Refused to close unmanaged tab.";
        }
        try {
            await chrome.tabs.remove(targetId);
        } catch {
            return `Failed to close tab ${targetId}`;
        }
        state.openedTabIds = state.openedTabIds.filter((id) => id !== targetId);
        state.currentTabId = state.mainTabId ?? state.openedTabIds[0] ?? null;
        if (state.currentTabId && await tabExists(state.currentTabId)) {
            await activateTab(state.currentTabId);
        }
        persist();
        return `Closed tab ${targetId}`;
    };

    const closeExtraTabs = async () => {
        await normalize();
        const toClose = [...state.openedTabIds];
        for (const tabId of toClose) {
            try {
                await chrome.tabs.remove(tabId);
            } catch {
                // Ignore tabs already closed by user.
            }
        }
        state.openedTabIds = [];
        state.currentTabId = state.mainTabId;
        if (state.mainTabId && await tabExists(state.mainTabId)) {
            await activateTab(state.mainTabId);
        }
        persist();
        return toClose.length > 0 ? `Closed ${toClose.length} extra tab(s).` : "No extra tabs to close.";
    };

    const buildTabContext = async () => {
        await normalize();
        const ids = managedIds();
        if (ids.length === 0) return "TAB CONTEXT: no managed tabs";
        const lines: string[] = [];
        for (const id of ids) {
            try {
                const tab = await chrome.tabs.get(id);
                const role =
                    id === state.mainTabId
                        ? "main"
                        : id === state.currentTabId
                            ? "current"
                            : "extra";
                lines.push(
                    `- tabId=${id} role=${role} url=${tab.url || "(unknown)"} title=${tab.title || "(untitled)"}`
                );
            } catch {
                lines.push(`- tabId=${id} role=missing`);
            }
        }
        return `TAB CONTEXT:\n${lines.join("\n")}\nRules: close only extra tabs; never close main tab ${state.mainTabId}.`;
    };

    const ensureCurrentTabActive = async () => {
        const tabId = await getTargetTabId();
        if (!tabId) return null;
        await activateTab(tabId);
        return tabId;
    };

    return {
        beginRun,
        getTargetTabId,
        openTab,
        switchTab,
        closeTab,
        closeExtraTabs,
        buildTabContext,
        ensureCurrentTabActive
    };
};
