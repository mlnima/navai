type OnProgress = (loaded: number, total: number | null) => void;

const pickFilename = (res: Response, requestUrl: string): string => {
	const cd = res.headers.get('content-disposition');
	const fromCd = cd?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
	if (fromCd?.[1]) return decodeURIComponent(fromCd[1].trim());
	try {
		const path = new URL(requestUrl).pathname.split('/').filter(Boolean).pop();
		if (path?.toLowerCase().endsWith('.gguf')) return decodeURIComponent(path);
	} catch {
		/* keep default */
	}
	return 'model.gguf';
};

const downloadGgufFromUrl = async (
	url: string,
	opts?: { onProgress?: OnProgress }
): Promise<{ ok: boolean; message: string }> => {
	const u = url.trim();
	if (!u.startsWith('https://')) {
		return { ok: false, message: 'URL must start with https://' };
	}
	try {
		const res = await fetch(u);
		if (!res.ok) {
			return { ok: false, message: `Download failed: HTTP ${res.status}` };
		}
		const total = (() => {
			const c = res.headers.get('content-length');
			if (!c) return null;
			const n = Number(c);
			return Number.isFinite(n) && n > 0 ? n : null;
		})();
		const name = pickFilename(res, u);
		opts?.onProgress?.(0, total);

		const body = res.body;
		if (!body) {
			const blob = await res.blob();
			opts?.onProgress?.(blob.size, blob.size);
			const href = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = href;
			a.download = name;
			a.rel = 'noopener';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(href);
			return {
				ok: true,
				message: `Saved (${(blob.size / (1024 * 1024)).toFixed(1)} MB).`,
			};
		}

		const reader = body.getReader();
		const chunks: BlobPart[] = [];
		let loaded = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (value?.length) {
				chunks.push(value);
				loaded += value.length;
				opts?.onProgress?.(loaded, total);
			}
		}
		const blob = new Blob(chunks);
		opts?.onProgress?.(blob.size, blob.size);
		const href = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = href;
		a.download = name;
		a.rel = 'noopener';
		document.body.appendChild(a);
		a.click();
		a.remove();
		URL.revokeObjectURL(href);
		return {
			ok: true,
			message: `Saved (${(blob.size / (1024 * 1024)).toFixed(1)} MB).`,
		};
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, message: msg };
	}
};

export default downloadGgufFromUrl;
