import { ModelValidationStatus } from '@wllama/wllama';
import ggufHfWllamaResolveUrl from '../agent/ggufHfWllamaResolveUrl';
import { isGgufRuntimeLoaded } from '../agent/webGpuGgufBrain';
import findHfGgufCachedModel from './findHfGgufCachedModel';
import type { WebGpuGgufModelConfig } from './types/ModelConfig';
import getModelBlob from './modelBlobDb/getModelBlob';

export type GgufStorageInfo =
	| {
			kind: 'huggingface';
			resolveUrl: string;
			onDisk: boolean;
			cacheValid: boolean;
			diskBytes: number;
			runtimeLoaded: boolean;
	  }
	| {
			kind: 'upload';
			blobPresent: boolean;
			blobBytes: number;
			runtimeLoaded: boolean;
	  };

const getGgufStorageInfo = async (
	config: WebGpuGgufModelConfig
): Promise<GgufStorageInfo | null> => {
	if (
		config.source.type === 'upload' &&
		config.source.blobId === '__draft__'
	) {
		return {
			kind: 'upload',
			blobPresent: false,
			blobBytes: config.source.byteSize,
			runtimeLoaded: false,
		};
	}
	if (config.source.type === 'huggingface') {
		const resolveUrl = ggufHfWllamaResolveUrl(
			config.source.repoId,
			config.source.fileName
		);
		const model = await findHfGgufCachedModel(
			config.source.repoId,
			config.source.fileName
		);
		const runtimeLoaded = isGgufRuntimeLoaded(config);
		if (!model) {
			return {
				kind: 'huggingface',
				resolveUrl,
				onDisk: false,
				cacheValid: false,
				diskBytes: 0,
				runtimeLoaded,
			};
		}
		const st = model.validate();
		return {
			kind: 'huggingface',
			resolveUrl,
			onDisk: model.size > 0,
			cacheValid: st === ModelValidationStatus.VALID,
			diskBytes: Math.max(0, model.size),
			runtimeLoaded,
		};
	}
	const blob = await getModelBlob(config.source.blobId);
	return {
		kind: 'upload',
		blobPresent: Boolean(blob),
		blobBytes: blob?.size ?? config.source.byteSize,
		runtimeLoaded: isGgufRuntimeLoaded(config),
	};
};

export default getGgufStorageInfo;
