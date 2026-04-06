import listTabFrameIds from './listTabFrameIds';

const getTabStateFromFrames = async (tabId: number) => {
	const frameIds = await listTabFrameIds(tabId);
	const frameStates = await Promise.all(
		frameIds.map(async (frameId) => {
			try {
				const response = await chrome.tabs.sendMessage(
					tabId,
					{ type: 'GET_CONTENT' },
					{ frameId }
				);
				if (!response || typeof response !== 'object') return null;
				return { frameId, response };
			} catch {
				return null;
			}
		})
	);

	const available = frameStates.filter(
		(item): item is { frameId: number; response: any } => !!item
	);
	if (available.length === 0) return null;

	const sorted = [...available].sort((a, b) => {
		if (a.frameId === 0) return -1;
		if (b.frameId === 0) return 1;
		return a.frameId - b.frameId;
	});
	const primary = sorted[0]?.response || {};
	const elements = sorted.flatMap(({ frameId, response }) =>
		Array.isArray(response?.elements)
			? response.elements.map((el: Record<string, unknown>) => ({
					...el,
					frameId,
					frameUrl:
						typeof response?.url === 'string' ? response.url : undefined,
			  }))
			: []
	);
	const content = sorted
		.map(({ frameId, response }) => {
			const text =
				typeof response?.content === 'string' ? response.content.trim() : '';
			if (!text) return '';
			const frameLabel =
				frameId === 0
					? 'Frame[0 main document]'
					: `Frame[${frameId}] ${String(response?.url || '').slice(0, 180)}`;
			return `${frameLabel}\n${text}`;
		})
		.filter(Boolean)
		.join('\n\n');

	return {
		content: content || String(primary?.content || ''),
		url: String(primary?.url || ''),
		elements,
		viewport: primary?.viewport,
	};
};

export default getTabStateFromFrames;
