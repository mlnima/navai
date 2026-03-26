const getSessionMessagesKey = (sessionId: string) =>
	`agent_session_messages_${sessionId}`;

export default getSessionMessagesKey;
