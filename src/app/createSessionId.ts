const createSessionId = () =>
	`sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export default createSessionId;
