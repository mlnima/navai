import type { AssetFile } from './types/AssetFile';
import normalizeSkillKey from './normalizeSkillKey';

export type ResolveRequestedAssetRefsResult = {
	requestedAssets: AssetFile[];
	missing: string[];
};

const resolveRequestedAssetRefs = (
	text: string,
	assets: AssetFile[]
): ResolveRequestedAssetRefsResult => {
	const tags = Array.from(text.matchAll(/@asset:([^\s,;\[\]]+)/gi))
		.map((match) => match[1]?.trim() || '')
		.filter(Boolean);
	const keyToOriginalTag = new Map<string, string>();
	for (const tag of tags) {
		const key = normalizeSkillKey(tag);
		if (!keyToOriginalTag.has(key)) keyToOriginalTag.set(key, tag);
	}
	const uniqueKeys = Array.from(keyToOriginalTag.keys());

	const requestedAssets: AssetFile[] = [];
	const seen = new Set<string>();
	const missing: string[] = [];
	for (const key of uniqueKeys) {
		const label = keyToOriginalTag.get(key) ?? key;
		const match = assets.find(
			(asset) => normalizeSkillKey(asset.name) === key
		);
		if (!match) {
			missing.push(label);
			continue;
		}
		if (!seen.has(match.id)) {
			seen.add(match.id);
			requestedAssets.push(match);
		}
	}

	return { requestedAssets, missing };
};

export default resolveRequestedAssetRefs;
