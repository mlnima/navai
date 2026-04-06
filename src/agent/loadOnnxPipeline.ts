import type { ProgressCallback } from '@huggingface/transformers';
import configureOnnxWasmPaths from './configureOnnxWasmPaths';

const onnxPipelineCache = new Map<string, Promise<unknown>>();

const loadOnnxPipelineInner = async (
	modelRef: string,
	progress_callback?: ProgressCallback
) => {
	await configureOnnxWasmPaths();
	const { pipeline, env } = await import('@huggingface/transformers');
	env.useBrowserCache = true;
	env.allowLocalModels = true;
	const webgpu =
		typeof navigator !== 'undefined' &&
		Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
	const tryLoad = async (device: 'webgpu' | 'wasm') =>
		pipeline('text-generation', modelRef, {
			device,
			dtype: 'q4f16',
			...(progress_callback ? { progress_callback } : {}),
		});
	try {
		if (webgpu) return await tryLoad('webgpu');
	} catch {
		/* fall through */
	}
	return tryLoad('wasm');
};

const loadOnnxPipeline = async (
	modelRef: string,
	opts?: { progress_callback?: ProgressCallback }
): Promise<unknown> => {
	const key = modelRef.trim();
	if (!key) throw new Error('Empty ONNX model reference');
	const hit = onnxPipelineCache.get(key);
	if (hit) return hit;
	const p = loadOnnxPipelineInner(key, opts?.progress_callback).catch((e) => {
		onnxPipelineCache.delete(key);
		throw e;
	});
	onnxPipelineCache.set(key, p);
	return p;
};

export const isOnnxPipelineCached = (modelRef: string): boolean =>
	onnxPipelineCache.has(modelRef.trim());

export default loadOnnxPipeline;
