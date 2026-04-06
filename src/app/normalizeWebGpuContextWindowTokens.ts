import getDefaultWebGpuContextWindowTokens from './getDefaultWebGpuContextWindowTokens';
import { snapWebGpuContextWindowTokens } from './webGpuContextWindowPolicy';

const normalizeWebGpuContextWindowTokens = (
	raw: unknown,
	backend?: 'onnx' | 'gguf'
): number => {
	const mode = backend ?? 'gguf';
	if (typeof raw !== 'number' || !Number.isFinite(raw)) {
		return snapWebGpuContextWindowTokens(getDefaultWebGpuContextWindowTokens(), mode);
	}
	return snapWebGpuContextWindowTokens(raw, mode);
};

export default normalizeWebGpuContextWindowTokens;
