import type { ProgressCallback } from '@huggingface/transformers';
import configureOnnxWasmPaths from './configureOnnxWasmPaths';

export type OnnxVlmBundle = { model: any; processor: any };

const vlmCache = new Map<string, Promise<OnnxVlmBundle>>();

const loadInner = async (
	modelRef: string,
	progress_callback?: ProgressCallback
): Promise<OnnxVlmBundle> => {
	await configureOnnxWasmPaths();
	const { AutoProcessor, AutoModelForImageTextToText, env } =
		await import('@huggingface/transformers');
	env.useBrowserCache = true;
	env.allowLocalModels = true;
	const hasWebGpu =
		typeof navigator !== 'undefined' &&
		Boolean((navigator as Navigator & { gpu?: unknown }).gpu);

	const loadModel = async (device: 'webgpu' | 'wasm') =>
		AutoModelForImageTextToText.from_pretrained(modelRef, {
			dtype: 'q4f16',
			device,
			...(progress_callback ? { progress_callback } : {}),
		});

	const processor = await AutoProcessor.from_pretrained(modelRef);

	let model: any;
	try {
		if (hasWebGpu) model = await loadModel('webgpu');
	} catch {
		/* fall through to wasm */
	}
	if (!model) model = await loadModel('wasm');

	return { model, processor };
};

const loadOnnxVlmModel = async (
	modelRef: string,
	opts?: { progress_callback?: ProgressCallback }
): Promise<OnnxVlmBundle> => {
	const key = modelRef.trim();
	if (!key) throw new Error('Empty ONNX VLM model reference');
	const hit = vlmCache.get(key);
	if (hit) return hit;
	const p = loadInner(key, opts?.progress_callback).catch((e) => {
		vlmCache.delete(key);
		throw e;
	});
	vlmCache.set(key, p);
	return p;
};

export const isOnnxVlmCached = (modelRef: string): boolean =>
	vlmCache.has(modelRef.trim());

export default loadOnnxVlmModel;
