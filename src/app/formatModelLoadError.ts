/** Maps low-level browser/WASM failures to a short hint for GGUF loads. */
const formatModelLoadError = (e: unknown): string => {
	const base = e instanceof Error ? e.message : String(e);
	if (/invalid typed array length/i.test(base)) {
		return `${base} — Large single-file GGUF often exceeds contiguous WASM heap in the browser; split into ~512MB shards (llama-gguf-split) or use a smaller quant.`;
	}
	return base;
};

export default formatModelLoadError;
