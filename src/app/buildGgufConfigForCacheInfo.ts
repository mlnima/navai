import parseHfRepoId from '../agent/parseHfRepoId';
import getDefaultWebGpuContextWindowTokens from './getDefaultWebGpuContextWindowTokens';
import type { ModelConfig, WebGpuGgufModelConfig } from './types/ModelConfig';
import normalizeGgufHfFilePathInput from './normalizeGgufHfFilePathInput';
import validateFullHfGgufFileUrl from './validateFullHfGgufFileUrl';

type Args = {
	backend: 'onnx' | 'gguf';
	source: 'hf' | 'upload' | 'url';
	modelFormWebGpuHfGgufRepo: string;
	modelFormWebGpuHfGgufFile: string;
	modelFormWebGpuGgufUrl: string;
	modelFormWebGpuUpload: File | null;
	editingModelId: string | null;
	modelConfigs: ModelConfig[];
};

const buildGgufConfigForCacheInfo = (a: Args): WebGpuGgufModelConfig | null => {
	if (a.backend !== 'gguf') return null;
	if (a.source === 'hf') {
		const repoId = parseHfRepoId(a.modelFormWebGpuHfGgufRepo);
		const fileName = normalizeGgufHfFilePathInput(a.modelFormWebGpuHfGgufFile);
		if (!repoId || !fileName || !fileName.toLowerCase().endsWith('.gguf')) {
			return null;
		}
		return {
			kind: 'webgpu',
			id: 'cache',
			name: '',
			backend: 'gguf',
			supportsVision: false,
			contextWindowTokens: getDefaultWebGpuContextWindowTokens(),
			source: { type: 'huggingface', repoId, fileName },
		};
	}
	if (a.source === 'url') {
		const v = validateFullHfGgufFileUrl(a.modelFormWebGpuGgufUrl);
		if (!v.ok) return null;
		return {
			kind: 'webgpu',
			id: 'cache',
			name: '',
			backend: 'gguf',
			supportsVision: false,
			contextWindowTokens: getDefaultWebGpuContextWindowTokens(),
			source: {
				type: 'huggingface',
				repoId: v.parsed.repoId,
				fileName: v.parsed.fileName,
			},
		};
	}
	if (a.modelFormWebGpuUpload) {
		return {
			kind: 'webgpu',
			id: 'cache',
			name: '',
			backend: 'gguf',
			supportsVision: false,
			contextWindowTokens: getDefaultWebGpuContextWindowTokens(),
			source: {
				type: 'upload',
				fileName: a.modelFormWebGpuUpload.name,
				blobId: '__draft__',
				byteSize: a.modelFormWebGpuUpload.size,
			},
		};
	}
	if (a.editingModelId) {
		const c = a.modelConfigs.find((m) => m.id === a.editingModelId);
		if (c?.kind === 'webgpu' && c.backend === 'gguf' && c.source.type === 'upload') {
			return c;
		}
	}
	return null;
};

export default buildGgufConfigForCacheInfo;
