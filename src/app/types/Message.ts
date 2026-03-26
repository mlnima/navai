export type Message = {
	role: 'user' | 'agent' | 'system';
	content: string;
	action?: 'continue_agent';
};
