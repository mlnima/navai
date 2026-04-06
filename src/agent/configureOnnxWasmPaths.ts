/**
 * ONNX Runtime Web defaults to jsDelivr; MV3 extension CSP only allows 'self'.
 * Set a prefix so ORT picks the right module (jsep for WebGPU, asyncify for WASM).
 */
const configureOnnxWasmPaths = async (): Promise<void> => {
	const ort = await import('onnxruntime-web/webgpu');
	const wasm = ort.env?.wasm;
	if (!wasm) return;
	const base =
		typeof chrome !== 'undefined' && typeof chrome.runtime?.getURL === 'function'
			? chrome.runtime.getURL('onnxruntime/')
			: `${typeof window !== 'undefined' ? window.location.origin : ''}/onnxruntime/`;
	wasm.wasmPaths = base;
};

export default configureOnnxWasmPaths;
