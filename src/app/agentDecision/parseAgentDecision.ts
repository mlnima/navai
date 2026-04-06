import repairJson from './repairJson';
import tryParseJson from './tryParseJson';

type Decision = { action: string; params: Record<string, unknown> };
type AnyObject = Record<string, unknown>;

const parseAgentDecisions = (raw: string): Decision[] => {
	const stripThinkBlocks = (input: string) =>
		input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

	const collectBalanced = (
		input: string,
		openChar: '{' | '[',
		closeChar: '}' | ']'
	) => {
		const found: string[] = [];
		let start = -1;
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = 0; i < input.length; i += 1) {
			const ch = input[i];
			if (inString) {
				if (escape) {
					escape = false;
					continue;
				}
				if (ch === '\\') {
					escape = true;
					continue;
				}
				if (ch === '"') inString = false;
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === openChar) {
				if (depth === 0) start = i;
				depth += 1;
				continue;
			}
			if (ch === closeChar) {
				if (depth > 0) depth -= 1;
				if (depth === 0 && start !== -1) {
					found.push(input.slice(start, i + 1));
					start = -1;
				}
			}
		}
		return found;
	};

	const isObject = (value: unknown): value is AnyObject =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const parseJsonLike = (input: string) =>
		tryParseJson(input) ?? tryParseJson(repairJson(input));

	const parseParamsLike = (value: unknown): Record<string, unknown> => {
		if (isObject(value)) return value;
		if (Array.isArray(value)) return { items: value };
		if (typeof value !== 'string') return {};
		const parsed = parseJsonLike(value);
		if (isObject(parsed)) return parsed;
		if (Array.isArray(parsed)) return { items: parsed };
		const objects = collectBalanced(value, '{', '}');
		for (const candidate of objects) {
			const nested = parseJsonLike(candidate);
			if (isObject(nested)) return nested;
		}
		return {};
	};

	const toInlineParams = (
		value: AnyObject,
		omitKeys: string[] = []
	): Record<string, unknown> => {
		const skip = new Set([
			// 'action',
			// 'tool',
			// 'name',
			// 'params',
			// 'args',
			// 'arguments',
			// 'input',
			// 'type',
			...omitKeys,
		]);
		const out: Record<string, unknown> = {};
		Object.entries(value).forEach(([key, val]) => {
			if (skip.has(key)) return;
			out[key] = val;
		});
		return out;
	};

	const looksLikeActionToken = (value: string) =>
		/^[A-Za-z][A-Za-z0-9_:-]{1,50}$/.test(value);

	const flattenFromValue = (value: unknown): Decision[] => {
		if (Array.isArray(value)) {
			return value.flatMap((entry) => flattenFromValue(entry));
		}
		if (!isObject(value)) return [];

		const directActionSource =
			typeof value.action === 'string'
				? 'action'
				: typeof value.tool === 'string'
				? 'tool'
				: typeof value.name === 'string'
				? 'name'
				: typeof value.id === 'string' && looksLikeActionToken(value.id)
				? 'id'
				: '';
		const directAction =
			directActionSource === 'action'
				? (value.action as string)
				: directActionSource === 'tool'
				? (value.tool as string)
				: directActionSource === 'name'
				? (value.name as string)
				: directActionSource === 'id'
				? (value.id as string)
				: '';

		if (directAction) {
			const rawParams =
				value.params ?? value.args ?? value.arguments ?? value.input ?? {};
			const inlineParams = toInlineParams(
				value,
				directActionSource === 'id' ? ['id'] : []
			);
			const parsedParams = parseParamsLike(rawParams);
			return [
				{
					action: directAction,
					params: { ...inlineParams, ...parsedParams },
				},
			];
		}

		if (value.type === 'tool_use' && typeof value.name === 'string') {
			return [
				{
					action: value.name,
					params: parseParamsLike(value.input ?? {}),
				},
			];
		}

		const nestedKeys = [
			'function_call',
			'function',
			'tool_call',
			'tool_calls',
			'function_calls',
			'calls',
			'content',
			'message',
			'output',
			'response',
			'choices',
			'items',
		];
		for (const key of nestedKeys) {
			const next = flattenFromValue(value[key]);
			if (next.length > 0) return next;
		}
		return [];
	};

	const extractXmlLikeCall = (input: string): Decision | null => {
		const actionMatch =
			input.match(
				/<(?:action|tool|name|id)>\s*([^<]+)\s*<\/(?:action|tool|name|id)>/i
			) ||
			input.match(
				/\b(?:action|tool|name|id)\b\s*(?::|=>|=)\s*['"]?([A-Za-z0-9_:-]+)['"]?/i
			);
		if (!actionMatch?.[1]) return null;
		const action = actionMatch[1].trim();
		if (!looksLikeActionToken(action)) return null;
		const paramsMatch =
			input.match(
				/<(?:params|args|arguments|input)>\s*([\s\S]*?)\s*<\/(?:params|args|arguments|input)>/i
			) ||
			input.match(/\b(?:params|args|arguments|input)\b\s*(?::|=>|=)\s*({[\s\S]*})/i);
		return {
			action,
			params: parseParamsLike(paramsMatch?.[1] ?? '{}'),
		};
	};

	const extractFromText = (input: string) => {
		const decisions: Decision[] = [];
		const parsed = parseJsonLike(input);
		decisions.push(...flattenFromValue(parsed));

		if (decisions.length === 0) {
			const arrays = collectBalanced(input, '[', ']');
			for (const arr of arrays) {
				decisions.push(...flattenFromValue(parseJsonLike(arr)));
			}
		}
		if (decisions.length === 0) {
			const objects = collectBalanced(input, '{', '}');
			for (const obj of objects) {
				decisions.push(...flattenFromValue(parseJsonLike(obj)));
			}
		}
		if (decisions.length === 0) {
			const xmlDecision = extractXmlLikeCall(input);
			if (xmlDecision) decisions.push(xmlDecision);
		}
		return decisions;
	};

	const cleanedRaw = stripThinkBlocks(raw);
	const segments: string[] = [];
	const push = (value?: string | null) => {
		if (!value) return;
		const trimmed = value.trim();
		if (trimmed) segments.push(trimmed);
	};

	const toolBlockMatches = cleanedRaw.matchAll(
		/\[(?:TOOL_CALL|TOOL_CALLS|FUNCTION_CALL|FUNCTION_CALLS)\]\s*([\s\S]*?)\s*\[\/(?:TOOL_CALL|TOOL_CALLS|FUNCTION_CALL|FUNCTION_CALLS)\]/gi
	);
	for (const match of toolBlockMatches) push(match[1]);

	const xmlBlockMatches = cleanedRaw.matchAll(
		/<(?:tool_call|tool_calls|function_call|function_calls)[^>]*>\s*([\s\S]*?)\s*<\/(?:tool_call|tool_calls|function_call|function_calls)>/gi
	);
	for (const match of xmlBlockMatches) push(match[1]);

	const fencedMatches = cleanedRaw.matchAll(
		/```(?:json|xml|js|javascript|tool_call)?\s*([\s\S]*?)\s*```/gi
	);
	for (const match of fencedMatches) push(match[1]);

	push(cleanedRaw);
	push(raw);

	const results: Decision[] = [];
	const seen = new Set<string>();
	for (const segment of segments) {
		const extracted = extractFromText(segment);
		for (const decision of extracted) {
			const key = `${decision.action}:${JSON.stringify(decision.params || {})}`;
			if (seen.has(key)) continue;
			seen.add(key);
			results.push(decision);
		}
	}

	return results;
};

const parseAgentDecision = (raw: string) => parseAgentDecisions(raw)[0] || null;

export { parseAgentDecisions };
export default parseAgentDecision;
