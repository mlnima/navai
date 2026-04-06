/**
 * ONNX Runtime Web defaults to jsDelivr; MV3 extension CSP only allows 'self'.
 * Call once before importing @huggingface/transformers (after onnxruntime-web).
 */
const configureOnnxWasmPaths = async (): Promise<void> => {
	const ort = await import('onnxruntime-web/webgpu');
	const wasm = ort.env?.wasm;
	if (!wasm) return;
	const base =
		typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function'
			? chrome.runtime.getURL('onnxruntime/')
			: `${typeof window !== 'undefined' ? window.location.origin : ''}/onnxruntime/`;
	wasm.wasmPaths = {
		mjs: `${base}ort-wasm-simd-threaded.asyncify.mjs`,
		wasm: `${base}ort-wasm-simd-threaded.asyncify.wasm`,
	};
};

export default configureOnnxWasmPaths;
