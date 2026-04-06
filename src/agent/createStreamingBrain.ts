import type { ModelConfig } from '../app/types/ModelConfig';
import { OpenAiAgentBrain } from './brain';
import type { StreamingAgentBrain } from './brainTypes';
import WebGpuGgufBrain from './webGpuGgufBrain';
import WebGpuOnnxBrain from './webGpuOnnxBrain';

const createStreamingBrain = async (
	config: ModelConfig,
	opts: {
		requestTimeoutMs: number;
		getAbortSignal?: () => AbortSignal | undefined;
	}
): Promise<StreamingAgentBrain> => {
	if (config.kind === 'api') {
		return new OpenAiAgentBrain(
			config.apiKey,
			config.baseUrl,
			config.modelName,
			opts.requestTimeoutMs
		);
	}
	if (config.backend === 'onnx') {
		return WebGpuOnnxBrain.create(config, opts);
	}
	return WebGpuGgufBrain.create(config, opts);
};

export default createStreamingBrain;
