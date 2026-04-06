import type { ParsedHfGgufResolveUrl } from './parseHfGgufResolveUrl';

const buildHfGgufDownloadUrl = (p: ParsedHfGgufResolveUrl): string => {
	const path = p.fileName
		.split('/')
		.map((seg) => encodeURIComponent(seg))
		.join('/');
	return `https://huggingface.co/${p.repoId}/resolve/${p.revision}/${path}`;
};

export default buildHfGgufDownloadUrl;
