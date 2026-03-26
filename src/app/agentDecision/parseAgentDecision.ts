import repairJson from './repairJson';
import tryParseJson from './tryParseJson';

const parseAgentDecision = (raw: string) => {
	const stripThinkBlocks = (input: string) =>
		input.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
	const collectBalancedObjects = (input: string) => {
		const found: string[] = [];
		let start = -1;
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = 0; i < input.length; i++) {
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
				if (ch === '"') {
					inString = false;
				}
				continue;
			}
			if (ch === '"') {
				inString = true;
				continue;
			}
			if (ch === '{') {
				if (depth === 0) start = i;
				depth += 1;
			} else if (ch === '}') {
				if (depth > 0) depth -= 1;
				if (depth === 0 && start !== -1) {
					found.push(input.slice(start, i + 1));
					start = -1;
				}
			}
		}
		return found;
	};
	const extractBalancedObjectFrom = (input: string, startIndex: number) => {
		if (startIndex < 0 || startIndex >= input.length || input[startIndex] !== '{')
			return '';
		let depth = 0;
		let inString = false;
		let escape = false;
		for (let i = startIndex; i < input.length; i++) {
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
			if (ch === '{') depth += 1;
			if (ch === '}') {
				depth -= 1;
				if (depth === 0) return input.slice(startIndex, i + 1);
			}
		}
		return '';
	};
	const extractObjectAroundAction = (input: string) => {
		const actionIndex = input.indexOf('"action"');
		if (actionIndex === -1) return '';
		let start = -1;
		let inString = false;
		let escape = false;
		for (let i = actionIndex; i >= 0; i--) {
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
			if (ch === '{') {
				start = i;
				break;
			}
		}
		if (start === -1) return '';
		let depth = 0;
		inString = false;
		escape = false;
		for (let i = start; i < input.length; i++) {
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
			if (ch === '{') depth += 1;
			if (ch === '}') {
				depth -= 1;
				if (depth === 0) return input.slice(start, i + 1);
			}
		}
		return '';
	};
	const fallbackParseByFields = (input: string) => {
		const actionMatch = input.match(/"action"\s*:\s*"([^"]+)"/i);
		if (!actionMatch?.[1]) return null;
		const action = actionMatch[1];
		const paramsKeyIndex = input.search(/"params"\s*:/i);
		if (paramsKeyIndex === -1) return { action, params: {} };
		const braceIndex = input.indexOf('{', paramsKeyIndex);
		if (braceIndex === -1) return { action, params: {} };
		const paramsRaw = extractBalancedObjectFrom(input, braceIndex);
		if (!paramsRaw) return { action, params: {} };
		const direct = tryParseJson(paramsRaw);
		if (direct && typeof direct === 'object') return { action, params: direct };
		const repaired = tryParseJson(repairJson(paramsRaw));
		if (repaired && typeof repaired === 'object') return { action, params: repaired };
		return { action, params: {} };
	};

	const cleanedRaw = stripThinkBlocks(raw);
	const candidates: string[] = [];
	const fenceMatches = cleanedRaw.matchAll(/```json\s*([\s\S]*?)\s*```/gi);
	for (const match of fenceMatches) {
		if (match[1]) candidates.push(match[1]);
	}
	candidates.push(...collectBalancedObjects(cleanedRaw));
	const aroundAction = extractObjectAroundAction(cleanedRaw);
	if (aroundAction) candidates.push(aroundAction);
	candidates.push(cleanedRaw);
	candidates.push(raw);

	for (const candidate of candidates) {
		const direct = tryParseJson(candidate);
		if (direct?.action) return direct;
		const repaired = tryParseJson(repairJson(candidate));
		if (repaired?.action) return repaired;
		const fallback = fallbackParseByFields(candidate);
		if (fallback?.action) return fallback;
	}
	const cleanedFallback = fallbackParseByFields(cleanedRaw);
	if (cleanedFallback?.action) return cleanedFallback;
	const rawFallback = fallbackParseByFields(raw);
	if (rawFallback?.action) return rawFallback;
	return null;
};

export default parseAgentDecision;
