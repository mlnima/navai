import { WEBGPU_CONTEXT_WINDOW_MAX_ONNX_TOKENS } from '../app/webGpuContextWindowPolicy';

/**
 * Aligns with browser ONNX context policy (see webGpuContextWindowPolicy.ts).
 */
const clampOnnxTokenizerEncodeMaxLength = (maxLength: number): number =>
	Math.min(
		Math.max(64, Math.floor(maxLength)),
		WEBGPU_CONTEXT_WINDOW_MAX_ONNX_TOKENS
	);

export default clampOnnxTokenizerEncodeMaxLength;
