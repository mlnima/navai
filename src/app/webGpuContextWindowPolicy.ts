/**
 * UI + stored config bounds for context window (snap + clamp). Actual runtime limits depend on model and ORT.
 */

export const WEBGPU_CONTEXT_WINDOW_MIN_TOKENS = 256;
export const WEBGPU_CONTEXT_WINDOW_SNAP_STEP = 256;
export const WEBGPU_CONTEXT_WINDOW_MAX_ONNX_TOKENS = 1_000_000;
export const WEBGPU_CONTEXT_WINDOW_MAX_GGUF_TOKENS = 1_000_000;

export const getWebGpuContextWindowMax = (backend: 'onnx' | 'gguf'): number =>
	backend === 'onnx'
		? WEBGPU_CONTEXT_WINDOW_MAX_ONNX_TOKENS
		: WEBGPU_CONTEXT_WINDOW_MAX_GGUF_TOKENS;

export const snapWebGpuContextWindowTokens = (
	value: number,
	backend: 'onnx' | 'gguf'
): number => {
	const max = getWebGpuContextWindowMax(backend);
	const step = WEBGPU_CONTEXT_WINDOW_SNAP_STEP;
	const clamped = Math.min(max, Math.max(WEBGPU_CONTEXT_WINDOW_MIN_TOKENS, Math.floor(value)));
	const snapped = Math.round(clamped / step) * step;
	return Math.min(max, Math.max(WEBGPU_CONTEXT_WINDOW_MIN_TOKENS, snapped));
};
