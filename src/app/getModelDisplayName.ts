import type { ModelConfig } from './types/ModelConfig';

const getModelDisplayName = (m: ModelConfig | null | undefined): string => {
	if (!m) return '';
	if (m.kind === 'api') return m.modelName;
	if (m.backend === 'onnx') {
		return m.source.type === 'huggingface'
			? m.source.repoId
			: m.source.fileName;
	}
	return m.source.type === 'huggingface'
		? `${m.source.repoId}/${m.source.fileName}`
		: m.source.fileName;
};

export default getModelDisplayName;
