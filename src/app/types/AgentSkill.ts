export type AgentSkill = {
	id: string;
	name: string;
	content: string;
	source: 'user' | 'predefined';
	filePath?: string;
};
