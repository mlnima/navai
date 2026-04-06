const parseHfRepoId = (raw: string): string => {
	const t = raw.trim();
	if (!t) return '';
	const slashRepo = t.match(/huggingface\.co\/([^/]+\/[^/?#]+)/i);
	if (slashRepo?.[1]) return slashRepo[1];
	const tree = t.match(/huggingface\.co\/([^/]+\/[^/]+)\/tree\//i);
	if (tree?.[1]) return tree[1];
	const blob = t.match(/huggingface\.co\/([^/]+\/[^/]+)\/blob\//i);
	if (blob?.[1]) return blob[1];
	if (/^[\w.-]+\/[\w.-]+$/.test(t)) return t;
	return t;
};

export default parseHfRepoId;
