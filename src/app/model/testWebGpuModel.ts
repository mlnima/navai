import type { ModelConfig } from '../types/ModelConfig';
import createStreamingBrain from '../../agent/createStreamingBrain';

const testWebGpuModel = async (
	config: Extract<ModelConfig, { kind: 'webgpu' }>,
	requestTimeoutMs: number
): Promise<{ ok: boolean; message: string }> => {
	try {
		const brain = await createStreamingBrain(config, {
			requestTimeoutMs: Math.min(120_000, Math.max(5000, requestTimeoutMs)),
		});
		let out = '';
		const stream = brain.askPage({
			question: 'Reply with exactly: ok',
			url: 'about:blank',
			pageContent: '(test)',
			supportsVision: false,
		});
		for await (const chunk of stream) {
			out += chunk;
			if (out.length > 32) break;
		}
		return {
			ok: true,
			message: out.trim()
				? `Local model responded (${config.backend}).`
				: 'Local model finished with empty output.',
		};
	} catch (e: any) {
		return {
			ok: false,
			message: `Local model test failed: ${e?.message || 'unknown error'}`,
		};
	}
};

export default testWebGpuModel;
