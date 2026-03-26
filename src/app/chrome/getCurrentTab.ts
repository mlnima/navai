const getCurrentTab = async () => {
	const [tab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	return tab;
};

export default getCurrentTab;
