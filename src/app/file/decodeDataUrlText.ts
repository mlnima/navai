import extractBase64FromDataUrl from './extractBase64FromDataUrl';

const decodeDataUrlText = (dataUrl: string) => {
	try {
		const base64 = extractBase64FromDataUrl(dataUrl);
		if (!base64) return '';
		const binary = atob(base64);
		const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return '';
	}
};

export default decodeDataUrlText;
