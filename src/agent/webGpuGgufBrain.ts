import { Wllama } from '@wllama/wllama';
import type { WebGpuGgufModelConfig } from '../app/types/ModelConfig';
import getModelBlob from '../app/modelBlobDb/getModelBlob';
import appendGgufVisionContext from './appendGgufVisionContext';
import getAskPageSystemPrompt from './getAskPageSystemPrompt';
import getProcessStepSystemPrompt from './getProcessStepSystemPrompt';
import type {
	AskPageInput,
	ProcessStepInput,
	StreamingAgentBrain,
} from './brainTypes';
import wllamaPaths from './wllamaPaths';

const wllamaInstanceCache = new Map<string, Promise<Wllama>>();

const buildGgufProcessText = (
	input: ProcessStepInput,
	modelSupportsVision: boolean
): string => {
	const stripped: ProcessStepInput = {
		...input,
		supportsVision: false,
		screenshotDataUrl: undefined,
		attachedImages: [],
	};
	const historyText =
		stripped.history.length > 0
			? stripped.history.map((h) => `- ${h}`).join('\n')
			: '(none)';
	const base = `TASK:\n${stripped.task}

URL:\n${stripped.url}

PREVIOUS ACTIONS:\n${historyText}

PAGE CONTENT:\n${stripped.pageContent.substring(0, 20000)}

FILES:\n${stripped.fileContext || '(none)'}

ELEMENT MAP:\n${stripped.elementMap || '(none)'}

ASSETS:\n${stripped.assetCatalog || '(none)'}

${stripped.tabContext || 'TAB CONTEXT: unavailable'}

${stripped.mcpCatalog || 'MCP TOOLS: none'}`;
	return base + appendGgufVisionContext(input, modelSupportsVision);
};

const buildGgufAskText = (input: AskPageInput, modelSupportsVision: boolean): string => {
	const stripped: AskPageInput = {
		...input,
		supportsVision: false,
		screenshotDataUrl: undefined,
		attachedImages: [],
	};
	const base = `QUESTION:\n${stripped.question}

URL:\n${stripped.url}

PAGE:\n${stripped.pageContent.substring(0, 20000)}

FILES:\n${stripped.fileContext || '(none)'}

MAP:\n${stripped.elementMap || '(none)'}`;
	return base + appendGgufVisionContext(input, modelSupportsVision);
};

export const getGgufWllamaCacheKey = (config: WebGpuGgufModelConfig) =>
	`${
		config.source.type === 'huggingface'
			? `hf:${config.source.repoId}:${config.source.fileName}`
			: `blob:${config.source.blobId}`
	}:ctx${config.contextWindowTokens}`;

export const isGgufRuntimeLoaded = (config: WebGpuGgufModelConfig) =>
	wllamaInstanceCache.has(getGgufWllamaCacheKey(config));

export const unloadGgufRuntimeAndExit = async (
	config: WebGpuGgufModelConfig
): Promise<void> => {
	const key = getGgufWllamaCacheKey(config);
	const entry = wllamaInstanceCache.get(key);
	if (!entry) return;
	wllamaInstanceCache.delete(key);
	try {
		const w = await entry;
		await w.exit();
	} catch {
		/* ignore */
	}
};

const cacheKeyForGguf = getGgufWllamaCacheKey;

const loadWllama = async (config: WebGpuGgufModelConfig): Promise<Wllama> => {
	const key = cacheKeyForGguf(config);
	if (!wllamaInstanceCache.has(key)) {
		wllamaInstanceCache.set(
			key,
			(async () => {
				const w = new Wllama(wllamaPaths(), { allowOffline: true });
				const loadOpts = { n_ctx: config.contextWindowTokens };
				if (config.source.type === 'huggingface') {
					await w.loadModelFromHF(
						config.source.repoId,
						config.source.fileName,
						loadOpts
					);
				} else {
					const blob = await getModelBlob(config.source.blobId);
					if (!blob) throw new Error('GGUF model data missing');
					await w.loadModel([blob], loadOpts);
				}
				return w;
			})()
		);
	}
	return wllamaInstanceCache.get(key)!;
};

class WebGpuGgufBrain implements StreamingAgentBrain {
	private readonly wllama: Wllama;
	private readonly modelSupportsVision: boolean;
	private readonly contextWindowTokens: number;
	private readonly getAbortSignal?: () => AbortSignal | undefined;

	private constructor(
		wllama: Wllama,
		modelSupportsVision: boolean,
		contextWindowTokens: number,
		_requestTimeoutMs: number,
		getAbortSignal?: () => AbortSignal | undefined
	) {
		this.wllama = wllama;
		this.modelSupportsVision = modelSupportsVision;
		this.contextWindowTokens = contextWindowTokens;
		this.getAbortSignal = getAbortSignal;
	}

	static async create(
		config: WebGpuGgufModelConfig,
		opts: {
			requestTimeoutMs: number;
			getAbortSignal?: () => AbortSignal | undefined;
		}
	): Promise<WebGpuGgufBrain> {
		const w = await loadWllama(config);
		return new WebGpuGgufBrain(
			w,
			config.supportsVision,
			config.contextWindowTokens,
			opts.requestTimeoutMs,
			opts.getAbortSignal
		);
	}

	async *processStep(input: ProcessStepInput) {
		const userText = buildGgufProcessText(input, this.modelSupportsVision);
		const messages = [
			{ role: 'system' as const, content: getProcessStepSystemPrompt() },
			{ role: 'user' as const, content: userText },
		];
		const signal = this.getAbortSignal?.();
		let prev = '';
		try {
			const stream = await this.wllama.createChatCompletion(messages, {
				stream: true,
				nPredict: Math.min(
					2048,
					Math.max(32, this.contextWindowTokens - 64)
				),
				sampling: { temp: 0 },
				abortSignal: signal,
			});
			for await (const chunk of stream) {
				const t = chunk.currentText;
				if (t.length > prev.length) {
					yield t.slice(prev.length);
					prev = t;
				}
			}
		} catch (e: any) {
			const msg = (e.message || '').toLowerCase();
			const isContextError =
				msg.includes('context') ||
				msg.includes('token') ||
				msg.includes('length');
			if (isContextError) throw e;
			yield `{"action":"DONE","params":{"summary":"Error: ${e.message}"}}`;
		}
	}

	async *askPage(input: AskPageInput) {
		const userText = buildGgufAskText(input, this.modelSupportsVision);
		const messages = [
			{ role: 'system' as const, content: getAskPageSystemPrompt() },
			{ role: 'user' as const, content: userText },
		];
		const signal = this.getAbortSignal?.();
		let prev = '';
		try {
			const stream = await this.wllama.createChatCompletion(messages, {
				stream: true,
				nPredict: Math.min(
					2048,
					Math.max(32, this.contextWindowTokens - 64)
				),
				sampling: { temp: 0 },
				abortSignal: signal,
			});
			for await (const chunk of stream) {
				const t = chunk.currentText;
				if (t.length > prev.length) {
					yield t.slice(prev.length);
					prev = t;
				}
			}
		} catch (e: any) {
			yield `I hit an error while answering: ${e.message}`;
		}
	}
}

export default WebGpuGgufBrain;
