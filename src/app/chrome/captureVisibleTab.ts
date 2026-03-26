import getCurrentTab from './getCurrentTab';

const captureVisibleTab = async () => {
	const tab = await getCurrentTab();
	if (!tab?.windowId) return null;
	try {
		return await chrome.tabs.captureVisibleTab(tab.windowId, {
			format: 'png',
		});
	} catch {
		return null;
	}
};

export default captureVisibleTab;
