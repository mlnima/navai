export type ParsedHfGgufResolveUrl = {
	repoId: string;
	revision: string;
	fileName: string;
};

const parseHfGgufResolveUrl = (raw: string): ParsedHfGgufResolveUrl | null => {
	const t = raw.trim();
	if (!t) return null;
	const resolveMatch = t.match(
		/^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/resolve\/([^/]+)\/(.+?)(?:\?|#|$)/i
	);
	if (resolveMatch?.[1] && resolveMatch[2] && resolveMatch[3]) {
		const fileName = decodeURIComponent(resolveMatch[3].trim());
		if (!fileName.toLowerCase().endsWith('.gguf')) return null;
		return { repoId: resolveMatch[1], revision: resolveMatch[2], fileName };
	}
	const blobMatch = t.match(
		/^https:\/\/huggingface\.co\/([^/]+\/[^/]+)\/blob\/([^/]+)\/(.+?)(?:\?|#|$)/i
	);
	if (blobMatch?.[1] && blobMatch[2] && blobMatch[3]) {
		const fileName = decodeURIComponent(blobMatch[3].trim());
		if (!fileName.toLowerCase().endsWith('.gguf')) return null;
		return { repoId: blobMatch[1], revision: blobMatch[2], fileName };
	}
	return null;
};

export default parseHfGgufResolveUrl;
