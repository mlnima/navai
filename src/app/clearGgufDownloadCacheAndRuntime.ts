import { unloadGgufRuntimeAndExit } from '../agent/webGpuGgufBrain';
import findHfGgufCachedModel from './findHfGgufCachedModel';
import type { WebGpuGgufModelConfig } from './types/ModelConfig';

const clearGgufDownloadCacheAndRuntime = async (
	config: WebGpuGgufModelConfig
): Promise<void> => {
	await unloadGgufRuntimeAndExit(config);
	if (config.source.type !== 'huggingface') return;
	const { repoId, fileName } = config.source;
	for (;;) {
		const model = await findHfGgufCachedModel(repoId, fileName);
		if (!model || model.size === -1) break;
		await model.remove();
	}
};

export default clearGgufDownloadCacheAndRuntime;
