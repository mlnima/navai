import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import createStreamingBrain from '../agent/createStreamingBrain';
import type { ModelConfig } from './types/ModelConfig';

interface SummarizeInput {
	originalTask: string;
	actionHistory: string[];
	modelConfig: ModelConfig;
	requestTimeoutMs: number;
}

const summarizeWithApi = async (
	originalTask: string,
	actionHistory: string[],
	cfg: Extract<ModelConfig, { kind: 'api' }>,
	requestTimeoutMs: number
): Promise<string[]> => {
	const apiKey = cfg.apiKey;
	const baseUrl = cfg.baseUrl;
	const modelName = cfg.modelName;
	const isMissingKey = !apiKey || apiKey.trim().length === 0;
	const resolvedApiKey = isMissingKey ? 'local-no-key' : apiKey;
	const baseConfig: { baseURL: string; fetch?: typeof fetch } = { baseURL: baseUrl };

	if (isMissingKey) {
		baseConfig.fetch = (input, init = {}) => {
			const headers = new Headers(init.headers || {});
			headers.delete('Authorization');
			headers.delete('authorization');
			return fetch(input, { ...init, headers });
		};
	}

	const llm = new ChatOpenAI({
		apiKey: resolvedApiKey,
		configuration: baseConfig,
		modelName,
		temperature: 0,
		timeout: requestTimeoutMs,
	});

	const historyBlock = actionHistory.map((h, i) => `${i + 1}. ${h}`).join('\n');

	const systemPrompt = `You are a session memory compressor for a browser automation agent.
Your job: compress a long action history into a concise summary so the agent can continue its task with minimal context tokens.

Rules:
- Output ONLY a short bullet-point summary of significant progress, decisions, navigation, data gathered, and errors encountered.
- Skip trivial actions like WAIT, redundant SCROLLs, repeated failures that were retried.
- Keep names, URLs, form values, important text the agent typed or read.
- Do NOT include any JSON actions or instructions. Only summarize what happened.
- Be extremely concise. Target under 30 lines.`;

	const userPrompt = `Original task:\n${originalTask}\n\nFull action history (${actionHistory.length} entries):\n${historyBlock}\n\nProvide a compressed summary of the above session.`;

	const messages = [
		new SystemMessage(systemPrompt),
		new HumanMessage(userPrompt),
	];

	try {
		const response = await llm.invoke(messages);
		const text =
			typeof response.content === 'string'
				? response.content
				: Array.isArray(response.content)
					? response.content
							.map((p: any) => (typeof p === 'string' ? p : p?.text || ''))
							.join('')
					: '';
		return [`[Session Memory Summary]\n${text.trim()}`];
	} catch (e: any) {
		return [
			`[Session Memory Summary] Compression failed: ${e.message}. Last ${Math.min(10, actionHistory.length)} actions preserved.`,
			...actionHistory.slice(-10),
		];
	}
};

const summarizeWithWebGpu = async (
	originalTask: string,
	actionHistory: string[],
	cfg: Extract<ModelConfig, { kind: 'webgpu' }>,
	requestTimeoutMs: number
): Promise<string[]> => {
	const historyBlock = actionHistory.map((h, i) => `${i + 1}. ${h}`).join('\n');
	const question = `Original task:\n${originalTask}\n\nFull action history (${actionHistory.length} entries):\n${historyBlock}\n\nCompress this into a concise bullet summary for session memory. Output only the summary.`;
	try {
		const brain = await createStreamingBrain(cfg, { requestTimeoutMs });
		let text = '';
		const stream = brain.askPage({
			question,
			url: 'about:blank',
			pageContent: '(memory compression)',
			supportsVision: false,
		});
		for await (const chunk of stream) {
			text += chunk;
		}
		return [`[Session Memory Summary]\n${text.trim()}`];
	} catch (e: any) {
		return [
			`[Session Memory Summary] Compression failed: ${e.message}. Last ${Math.min(10, actionHistory.length)} actions preserved.`,
			...actionHistory.slice(-10),
		];
	}
};

const summarizeSession = async ({
	originalTask,
	actionHistory,
	modelConfig,
	requestTimeoutMs,
}: SummarizeInput): Promise<string[]> => {
	if (modelConfig.kind === 'api') {
		return summarizeWithApi(
			originalTask,
			actionHistory,
			modelConfig,
			requestTimeoutMs
		);
	}
	return summarizeWithWebGpu(
		originalTask,
		actionHistory,
		modelConfig,
		requestTimeoutMs
	);
};

export default summarizeSession;
