import getTabStateFromFrames from './getTabStateFromFrames';

const resolveAgentTab = async () => {
	const isAutomatableUrl = (url?: string) => /^https?:\/\//i.test(url ?? '');

	const ensureTabIsActive = async (tab: chrome.tabs.Tab) => {
		if (!tab.id) return;
		if (Number.isInteger(tab.windowId)) {
			await chrome.windows.update(tab.windowId, { focused: true });
		}
		await chrome.tabs.update(tab.id, { active: true });
	};

	const canConnectToTab = async (tabId: number) => {
		const tryRead = async () => getTabStateFromFrames(tabId);

		try {
			const state = await tryRead();
			return !!state;
		} catch {
			try {
				await chrome.scripting.executeScript({
					target: { tabId },
					files: ['content.js'],
				});
				const state = await tryRead();
				return !!state;
			} catch {
				return false;
			}
		}
	};

	const waitUntilLoadComplete = async (tabId: number) => {
		for (let i = 0; i < 40; i += 1) {
			try {
				const tab = await chrome.tabs.get(tabId);
				if (tab.status === 'complete') return;
			} catch {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	};

	const sortTabsForAgentResolution = (tabs: chrome.tabs.Tab[]) =>
		[...tabs].sort((a, b) => {
			if (a.active && !b.active) return -1;
			if (!a.active && b.active) return 1;
			const la = a.lastAccessed ?? 0;
			const lb = b.lastAccessed ?? 0;
			if (lb !== la) return lb - la;
			return (a.index ?? 0) - (b.index ?? 0);
		});

	const windowTabs = await chrome.tabs.query({ currentWindow: true });
	const ordered = sortTabsForAgentResolution(windowTabs);

	for (const candidate of ordered) {
		const tabId = candidate.id;
		if (tabId === undefined || !Number.isInteger(tabId) || !isAutomatableUrl(candidate.url)) continue;
		const ok = await canConnectToTab(tabId);
		if (!ok) continue;
		await ensureTabIsActive(candidate);
		return { tab: candidate, openedNewTab: false };
	}

	const createdTab = await chrome.tabs.create({
		url: 'https://example.com',
		active: true,
	});
	if (!createdTab.id) {
		throw new Error('Could not create a browser tab.');
	}
	await waitUntilLoadComplete(createdTab.id);
	const connected = await canConnectToTab(createdTab.id);
	if (!connected) {
		throw new Error('Could not connect to page after opening a new tab.');
	}
	const tab = await chrome.tabs.get(createdTab.id);
	return { tab, openedNewTab: true };
};

export default resolveAgentTab;
