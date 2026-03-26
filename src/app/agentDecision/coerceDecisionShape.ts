const coerceDecisionShape = (decision: any) => {
	if (!decision || typeof decision !== 'object') return decision;
	const actionAliases: Record<string, string> = {
		INPUT: 'TYPE',
		FILL: 'TYPE',
		TYPE_TEXT: 'TYPE',
		PRESS_KEY: 'KEY',
		KEYPRESS: 'KEY',
		FINISH: 'DONE',
		COMPLETE: 'DONE',
		ANSWER: 'ASK',
		UPLOAD: 'UPLOAD_ASSET',
		OPEN_NEW_TAB: 'OPEN_TAB',
		NEW_TAB: 'OPEN_TAB',
		OPEN_URL: 'NAVIGATE',
		CHANGE_TAB: 'SWITCH_TAB',
		FOCUS_TAB: 'SWITCH_TAB',
		CLOSE_CURRENT_TAB: 'CLOSE_TAB',
		CLOSE_OTHER_TABS: 'CLOSE_EXTRA_TABS',
		WAIT_FOR_USER: 'WAIT_FOR_USER_ACTION',
		WAIT_USER_ACTION: 'WAIT_FOR_USER_ACTION',
		WAIT_FOR_USER_INPUT: 'WAIT_FOR_USER_ACTION',
		TOOL_CALL: 'MCP_CALL',
		CALL_TOOL: 'MCP_CALL',
	};
	const rawAction = String(decision.action || '')
		.trim()
		.toUpperCase();
	const action = actionAliases[rawAction] || rawAction;
	const params =
		decision.params && typeof decision.params === 'object'
			? { ...decision.params }
			: {};
	const topLevelKeys = [
		'id',
		'label',
		'text',
		'value',
		'x',
		'y',
		'url',
		'key',
		'index',
		'ms',
		'question',
		'assetName',
		'summary',
		'target',
		'field',
		'tabId',
		'urlContains',
		'background',
		'serverId',
		'tool',
		'arguments',
	];
	topLevelKeys.forEach((key) => {
		if (params[key] == null && decision[key] != null) params[key] = decision[key];
	});
	if (params.label == null && typeof params.target === 'string') {
		params.label = params.target;
	}
	if (params.label == null && typeof params.field === 'string') {
		params.label = params.field;
	}
	if (params.text == null && params.value != null && action.startsWith('TYPE')) {
		params.text = params.value;
	}
	if (params.id != null) params.id = String(params.id);
	if (params.tabId != null) {
		const nextTabId = Number(params.tabId);
		params.tabId = Number.isFinite(nextTabId) ? nextTabId : params.tabId;
	}
	if (params.index != null) {
		const nextIndex = Number(params.index);
		params.index = Number.isFinite(nextIndex) ? nextIndex : params.index;
	}
	if (params.background != null) {
		params.background = Boolean(params.background);
	}
	if (params.key == null && action === 'KEY') params.key = 'Enter';
	if (params.direction == null && action === 'SCROLL') params.direction = 'down';
	if (params.ms == null && action === 'WAIT') params.ms = 1000;
	return { action, params };
};

export default coerceDecisionShape;
