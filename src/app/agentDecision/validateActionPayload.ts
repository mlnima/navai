const validateActionPayload = (decision: any) => {
	if (!decision?.action) return 'Missing action';
	const params = decision.params ?? {};
	const hasId = typeof params.id === 'string' && params.id.trim().length > 0;
	const hasLabel =
		typeof params.label === 'string' && params.label.trim().length > 0;
	const hasText =
		typeof params.text === 'string' || typeof params.text === 'number';
	const hasValue =
		typeof params.value === 'string' || typeof params.value === 'number';
	const hasCoords =
		typeof params.x === 'number' && typeof params.y === 'number';

	switch (decision.action) {
		case 'CLICK':
			return hasLabel ? '' : 'CLICK requires params.label';
		case 'CLICK_ID':
			return hasId ? '' : 'CLICK_ID requires params.id';
		case 'CLICK_COORDS':
			return hasCoords ? '' : 'CLICK_COORDS requires params.x and params.y';
		case 'TYPE':
			return hasLabel && hasText
				? ''
				: 'TYPE requires params.label and params.text';
		case 'TYPE_ID':
			return hasId && hasText ? '' : 'TYPE_ID requires params.id and params.text';
		case 'TYPE_COORDS':
			return hasCoords && hasText
				? ''
				: 'TYPE_COORDS requires params.x, params.y and params.text';
		case 'HOVER':
			return hasLabel ? '' : 'HOVER requires params.label';
		case 'HOVER_ID':
			return hasId ? '' : 'HOVER_ID requires params.id';
		case 'HOVER_COORDS':
			return hasCoords ? '' : 'HOVER_COORDS requires params.x and params.y';
		case 'SELECT':
			return hasLabel && hasValue
				? ''
				: 'SELECT requires params.label and params.value';
		case 'SELECT_ID':
			return hasId && hasValue
				? ''
				: 'SELECT_ID requires params.id and params.value';
		case 'UPLOAD_ASSET':
			return typeof params.assetName === 'string' && params.assetName.trim()
				? ''
				: 'UPLOAD_ASSET requires params.assetName';
		case 'KEY':
			return typeof params.key === 'string' && params.key.trim()
				? ''
				: 'KEY requires params.key';
		case 'NAVIGATE':
			return typeof params.url === 'string' && params.url.trim()
				? ''
				: 'NAVIGATE requires params.url';
		case 'OPEN_TAB':
			return typeof params.url === 'string' && params.url.trim()
				? ''
				: 'OPEN_TAB requires params.url';
		case 'SWITCH_TAB':
			return typeof params.tabId === 'number' ||
				typeof params.index === 'number' ||
				(typeof params.urlContains === 'string' &&
					params.urlContains.trim().length > 0)
				? ''
				: 'SWITCH_TAB requires params.tabId or params.index or params.urlContains';
		case 'CLOSE_TAB':
			return '';
		case 'CLOSE_EXTRA_TABS':
			return '';
		case 'WAIT_FOR_USER_ACTION':
			return '';
		case 'MCP_CALL':
			return typeof params.serverId === 'string' &&
				params.serverId.trim().length > 0 &&
				typeof params.tool === 'string' &&
				params.tool.trim().length > 0
				? ''
				: 'MCP_CALL requires params.serverId and params.tool';
		case 'WAIT':
			return '';
		case 'ASK':
			return typeof params.question === 'string' && params.question.trim()
				? ''
				: 'ASK requires params.question';
		default:
			return '';
	}
};

export default validateActionPayload;
