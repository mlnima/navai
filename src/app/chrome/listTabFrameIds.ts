const listTabFrameIds = async (tabId: number) => {
	try {
		const frames = await chrome.webNavigation.getAllFrames({ tabId });
		if (!Array.isArray(frames) || frames.length === 0) return [0];
		const ids = frames
			.map((frame) => frame.frameId)
			.filter((id): id is number => Number.isInteger(id));
		const unique = Array.from(new Set(ids));
		if (!unique.includes(0)) unique.unshift(0);
		return unique;
	} catch {
		return [0];
	}
};

export default listTabFrameIds;
