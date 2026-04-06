import type { AssetsPathConfig } from '@wllama/wllama';

const wllamaPaths = (): AssetsPathConfig => {
	const base =
		typeof chrome !== 'undefined' && chrome.runtime?.getURL
			? chrome.runtime.getURL('')
			: `${typeof window !== 'undefined' ? window.location.origin : ''}/`;
	return {
		'single-thread/wllama.wasm': `${base}wllama/single-thread/wllama.wasm`,
		'multi-thread/wllama.wasm': `${base}wllama/multi-thread/wllama.wasm`,
	};
};

export default wllamaPaths;
