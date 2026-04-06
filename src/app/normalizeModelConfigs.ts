import normalizeWebGpuContextWindowTokens from './normalizeWebGpuContextWindowTokens';
import type { ApiModelConfig, ModelConfig } from './types/ModelConfig';

type LegacyFlat = {
	id: string;
	name: string;
	baseUrl: string;
	apiKey?: string;
	modelName: string;
	supportsVision: boolean;
};

const isLegacyApi = (item: unknown): item is LegacyFlat =>
	Boolean(
		item &&
			typeof item === 'object' &&
			!('kind' in (item as object)) &&
			'id' in (item as object) &&
			'baseUrl' in (item as object) &&
			'modelName' in (item as object)
	);

const toApi = (item: LegacyFlat): ApiModelConfig => ({
	kind: 'api',
	id: String(item.id),
	name: String(item.name ?? ''),
	baseUrl: String(item.baseUrl ?? ''),
	apiKey: String(item.apiKey ?? ''),
	modelName: String(item.modelName ?? ''),
	supportsVision: Boolean(item.supportsVision),
});

const normalizeModelConfigs = (parsed: unknown): ModelConfig[] => {
	if (!Array.isArray(parsed)) return [];
	const out: ModelConfig[] = [];
	for (const item of parsed) {
		if (!item || typeof item !== 'object') continue;
		if ('kind' in item && (item as ModelConfig).kind === 'api') {
			const m = item as ApiModelConfig;
			if (!m.id || !m.name || !m.baseUrl || !m.modelName) continue;
			out.push({
				kind: 'api',
				id: m.id,
				name: m.name,
				baseUrl: m.baseUrl,
				apiKey: m.apiKey ?? '',
				modelName: m.modelName,
				supportsVision: Boolean(m.supportsVision),
			});
			continue;
		}
		if ('kind' in item && (item as ModelConfig).kind === 'webgpu') {
			const w = item as ModelConfig & { contextWindowTokens?: unknown };
			if (w.kind !== 'webgpu') continue;
			if (!w.id || !w.name) continue;
			const ctx = normalizeWebGpuContextWindowTokens(
				w.contextWindowTokens,
				w.backend === 'onnx' ? 'onnx' : 'gguf'
			);
			if (w.backend === 'onnx' && w.source) {
				out.push({ ...w, contextWindowTokens: ctx } as ModelConfig);
				continue;
			}
			if (w.backend === 'gguf' && w.source) {
				const g = w as ModelConfig & { supportsVision?: boolean };
				out.push({
					...g,
					supportsVision: Boolean(g.supportsVision),
					contextWindowTokens: ctx,
				} as ModelConfig);
				continue;
			}
			continue;
		}
		if (isLegacyApi(item)) {
			out.push(toApi(item));
		}
	}
	return out;
};

export default normalizeModelConfigs;
