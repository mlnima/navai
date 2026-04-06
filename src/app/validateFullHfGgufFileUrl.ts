import type { ParsedHfGgufResolveUrl } from './parseHfGgufResolveUrl';
import parseHfGgufResolveUrl from './parseHfGgufResolveUrl';

type Result =
	| { ok: true; parsed: ParsedHfGgufResolveUrl }
	| { ok: false; message: string };

const validateFullHfGgufFileUrl = (raw: string): Result => {
	const t = raw.trim();
	if (!t) {
		return { ok: false, message: 'Paste the full file URL (not only the repo name).' };
	}
	let u: URL;
	try {
		u = new URL(t);
	} catch {
		return { ok: false, message: 'Invalid URL.' };
	}
	if (u.protocol !== 'https:') {
		return { ok: false, message: 'URL must use https://' };
	}
	const host = u.hostname.toLowerCase();
	if (host !== 'huggingface.co' && !host.endsWith('.huggingface.co')) {
		return { ok: false, message: 'URL must be on huggingface.co.' };
	}
	const segments = u.pathname.split('/').filter(Boolean);
	if (segments.length < 5) {
		return {
			ok: false,
			message:
				'Use the full path to one .gguf file (…/resolve/…/…/file.gguf), not only the repo.',
		};
	}
	const parsed = parseHfGgufResolveUrl(t);
	if (!parsed) {
		return {
			ok: false,
			message:
				'Use a …/resolve/…/file.gguf or …/blob/…/file.gguf link with the complete file path.',
		};
	}
	return { ok: true, parsed };
};

export default validateFullHfGgufFileUrl;
