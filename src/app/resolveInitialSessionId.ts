import createSessionId from './createSessionId';
import { sessionIdKey } from './agentStorageConstants';

const resolveInitialSessionId = () => {
	const existing = localStorage.getItem(sessionIdKey);
	if (existing?.trim()) return existing;
	const next = createSessionId();
	localStorage.setItem(sessionIdKey, next);
	return next;
};

export default resolveInitialSessionId;
