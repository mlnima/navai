export interface ParsedAgentMessage {
	thinking: string;
	displayContent: string;
	actionType: string;
	actionSummary: string;
	actionDetails: Array<{ label: string; value: string }>;
	hasStructuredContent: boolean;
}

export const parseAgentMessage = (content: string): ParsedAgentMessage => {
	const trimmed = content.trim();
	if (!trimmed) {
		return {
			thinking: '',
			displayContent: '',
			actionType: '',
			actionSummary: '',
			actionDetails: [],
			hasStructuredContent: false,
		};
	}

	const tryParseJson = (raw: string) => {
		try {
			return JSON.parse(raw);
		} catch {
			return null;
		}
	};

	const thinkMatches = Array.from(trimmed.matchAll(/<think>([\s\S]*?)<\/think>/gi));
	const extractedThink = thinkMatches
		.map((match) => match[1]?.trim())
		.filter(Boolean)
		.join('\n\n');
	const withoutThink = trimmed.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	const collectCandidates = () => {
		const candidates: string[] = [];
		const fencedJsonMatches = withoutThink.matchAll(/```json\s*([\s\S]*?)\s*```/gi);
		for (const match of fencedJsonMatches) {
			if (match[1]) candidates.push(match[1].trim());
		}
		const fencedMatches = withoutThink.matchAll(/```[\w-]*\s*([\s\S]*?)\s*```/gi);
		for (const match of fencedMatches) {
			if (match[1]) candidates.push(match[1].trim());
		}
		if (withoutThink.startsWith('{') && withoutThink.endsWith('}')) {
			candidates.push(withoutThink);
		}
		const firstBrace = withoutThink.indexOf('{');
		const lastBrace = withoutThink.lastIndexOf('}');
		if (firstBrace !== -1 && lastBrace > firstBrace) {
			candidates.push(withoutThink.slice(firstBrace, lastBrace + 1));
		}
		candidates.push(withoutThink);
		return candidates;
	};

	const parsedJson =
		collectCandidates()
			.map((candidate) => tryParseJson(candidate))
			.find(Boolean) ?? null;

	const normalizeActionDetails = (params: unknown) => {
		if (!params || typeof params !== 'object') return [];
		return Object.entries(params as Record<string, unknown>)
			.filter(([key]) => key.toLowerCase() !== 'summary')
			.map(([key, value]) => {
				const formattedValue =
					typeof value === 'string'
						? value
						: value == null
						? 'null'
						: JSON.stringify(value);
				return {
					label: key
						.replace(/([a-z])([A-Z])/g, '$1 $2')
						.replace(/[_-]+/g, ' ')
						.replace(/^./, (c) => c.toUpperCase()),
					value: formattedValue,
				};
			});
	};

	const thoughtMatch = withoutThink.match(
		/(?:Thought|Thinking|Reasoning)\s*:\s*([\s\S]*?)(?=\n```|\n\{|\n$)/i
	);

	const thinking =
		(typeof parsedJson?.thinking === 'string' && parsedJson.thinking.trim()) ||
		(typeof parsedJson?.thought === 'string' && parsedJson.thought.trim()) ||
		(typeof parsedJson?.reasoning === 'string' && parsedJson.reasoning.trim()) ||
		extractedThink ||
		(thoughtMatch?.[1]?.trim() ?? '');

	const actionPayload =
		parsedJson?.action && typeof parsedJson.action === 'object'
			? parsedJson.action
			: parsedJson;
	const actionType =
		(typeof actionPayload?.action === 'string' && actionPayload.action) ||
		(typeof parsedJson?.action === 'string' && parsedJson.action) ||
		'';
	const params =
		(actionPayload?.params && typeof actionPayload.params === 'object'
			? actionPayload.params
			: parsedJson?.params && typeof parsedJson.params === 'object'
			? parsedJson.params
			: null) ?? null;
	const actionSummary =
		(typeof params?.summary === 'string' && params.summary) ||
		(typeof actionPayload?.summary === 'string' && actionPayload.summary) ||
		'';
	const actionDetails = normalizeActionDetails(params);

	const displayContent =
		actionType || actionSummary || actionDetails.length > 0
			? withoutThink
					.replace(/```json\s*[\s\S]*?\s*```/gi, '')
					.replace(/\{[\s\S]*\}/g, '')
					.trim()
			: withoutThink;

	return {
		thinking,
		displayContent,
		actionType,
		actionSummary,
		actionDetails,
		hasStructuredContent: Boolean(
			thinking ||
				actionType ||
				actionSummary ||
				withoutThink !== trimmed ||
				displayContent !== withoutThink
		),
	};
};
