export type ApiModelConfig = {
	kind: 'api';
	id: string;
	name: string;
	baseUrl: string;
	apiKey: string;
	modelName: string;
	supportsVision: boolean;
};

export type WebGpuOnnxSource =
	| { type: 'huggingface'; repoId: string }
	| { type: 'upload'; fileName: string; blobId: string; byteSize: number };

export type WebGpuGgufSource =
	| { type: 'huggingface'; repoId: string; fileName: string }
	| { type: 'upload'; fileName: string; blobId: string; byteSize: number };

export type WebGpuOnnxModelConfig = {
	kind: 'webgpu';
	id: string;
	name: string;
	backend: 'onnx';
	supportsVision: boolean;
	/** Total context window in tokens (prompt + generation budget for local runtimes). */
	contextWindowTokens: number;
	source: WebGpuOnnxSource;
};

export type WebGpuGgufModelConfig = {
	kind: 'webgpu';
	id: string;
	name: string;
	backend: 'gguf';
	supportsVision: boolean;
	/** Total context window in tokens (maps to llama.cpp n_ctx). */
	contextWindowTokens: number;
	source: WebGpuGgufSource;
};

export type WebGpuModelConfig = WebGpuOnnxModelConfig | WebGpuGgufModelConfig;

export type ModelConfig = ApiModelConfig | WebGpuModelConfig;

export const isApiModel = (m: ModelConfig): m is ApiModelConfig => m.kind === 'api';

export const isWebGpuModel = (m: ModelConfig): m is WebGpuModelConfig =>
	m.kind === 'webgpu';
