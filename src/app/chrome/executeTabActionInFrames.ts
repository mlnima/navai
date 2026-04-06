import listTabFrameIds from './listTabFrameIds';

const executeTabActionInFrames = async (
	tabId: number,
	action: { action: string; params?: Record<string, unknown> },
	assets: unknown[],
	elements: unknown[]
) => {
	const params =
		action?.params && typeof action.params === 'object' ? action.params : {};
	const idParam = typeof params.id === 'string' ? params.id : '';
	const explicitFrameId = Number(params.frameId);
	const frameFromParams = Number.isInteger(explicitFrameId) ? explicitFrameId : null;
	const frameFromId =
		idParam && Array.isArray(elements)
			? (elements as Array<Record<string, unknown>>).find(
					(el) => el?.id === idParam && Number.isInteger(el?.frameId as number)
			  )?.frameId
			: null;
	const knownFrameIds = Array.isArray(elements)
		? Array.from(
				new Set(
					(elements as Array<Record<string, unknown>>)
						.map((el) => el?.frameId)
						.filter((id): id is number => Number.isInteger(id as number))
				)
		  )
		: [];
	const discoveredFrameIds = await listTabFrameIds(tabId);
	const primaryFrameId =
		typeof frameFromParams === 'number'
			? frameFromParams
			: typeof frameFromId === 'number'
			? frameFromId
			: 0;
	const shouldTryManyFrames =
		!Number.isFinite(Number(params.x)) &&
		!Number.isFinite(Number(params.y)) &&
		[
			'CLICK',
			'CLICK_INDEX',
			'CLICK_ID',
			'TYPE',
			'TYPE_ID',
			'CLEAR',
			'FOCUS',
			'SELECT',
			'SELECT_ID',
			'HOVER',
			'HOVER_ID',
			'DOUBLE_CLICK',
			'UPLOAD_ASSET',
		].includes(String(action?.action || ''));
	const frameQueue = shouldTryManyFrames
		? Array.from(
				new Set([primaryFrameId, ...knownFrameIds, ...discoveredFrameIds])
		  )
		: [primaryFrameId];

	let lastResult: any = null;
	for (const frameId of frameQueue) {
		try {
			const result = await chrome.tabs.sendMessage(
				tabId,
				{
					type: 'EXECUTE_ACTION',
					action,
					assets,
				},
				{ frameId }
			);
			lastResult = result;
			const text =
				typeof result?.result === 'string' ? result.result : String(result || '');
			if (!/(Failed|Error)/i.test(text)) {
				return result;
			}
		} catch (error) {
			lastResult = { result: `Error executing action in frame ${frameId}: ${error}` };
		}
	}

	return lastResult || { result: 'No result' };
};

export default executeTabActionInFrames;
