import type { McpServerConfig } from '../agent/mcpConfig';
import normalizeSkillKey from './normalizeSkillKey';

export type ResolveRequestedMcpRefsResult = {
	requestedServers: McpServerConfig[];
	missing: string[];
	disabled: string[];
};

const resolveRequestedMcpRefs = (
	text: string,
	servers: McpServerConfig[]
): ResolveRequestedMcpRefsResult => {
	const tags = Array.from(text.matchAll(/@mcp:([^\s,;\[\]]+)/gi))
		.map((match) => match[1]?.trim() || '')
		.filter(Boolean);
	const keyToOriginalTag = new Map<string, string>();
	for (const tag of tags) {
		const key = normalizeSkillKey(tag);
		if (!keyToOriginalTag.has(key)) keyToOriginalTag.set(key, tag);
	}
	const uniqueKeys = Array.from(keyToOriginalTag.keys());

	const requestedServers: McpServerConfig[] = [];
	const seen = new Set<string>();
	const missing: string[] = [];
	const disabled: string[] = [];

	for (const key of uniqueKeys) {
		const label = keyToOriginalTag.get(key) ?? key;
		const match = servers.find(
			(s) =>
				normalizeSkillKey(s.name) === key || normalizeSkillKey(s.id) === key
		);
		if (!match) {
			missing.push(label);
			continue;
		}
		if (!match.enabled) {
			disabled.push(label);
			continue;
		}
		if (!seen.has(match.id)) {
			seen.add(match.id);
			requestedServers.push(match);
		}
	}

	return { requestedServers, missing, disabled };
};

export default resolveRequestedMcpRefs;
