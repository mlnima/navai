import type { WebGpuOnnxModelConfig } from '../app/types/ModelConfig';
import getModelBlob from '../app/modelBlobDb/getModelBlob';
import {
	buildOnnxAskPageMessages,
	buildOnnxProcessStepMessages,
} from './buildOnnxChatMessages';
import clampOnnxTokenizerEncodeMaxLength from './clampOnnxTokenizerEncodeMaxLength';
import loadOnnxPipeline from './loadOnnxPipeline';
import wrapOnnxTextGenerationPipelineCall from './wrapOnnxTextGenerationPipelineCall';
import type {
	AskPageInput,
	ProcessStepInput,
	StreamingAgentBrain,
} from './brainTypes';

const buildOnnxGenerateOpts = (contextWindowTokens: number) => {
	const maxNew = Math.min(2048, Math.max(64, contextWindowTokens - 256));
	const promptMax = Math.max(64, contextWindowTokens - maxNew);
	return {
		max_new_tokens: maxNew,
		do_sample: false,
		tokenizer_encode_kwargs: {
			truncation: true as const,
			max_length: clampOnnxTokenizerEncodeMaxLength(promptMax),
		},
	};
};

const extractChatText = (generated: unknown): string => {
	if (typeof generated === 'string') return generated;
	if (Array.isArray(generated)) {
		const last = generated[generated.length - 1] as { content?: string } | undefined;
		if (last?.content && typeof last.content === 'string') return last.content;
	}
	return '';
};

const resolveOnnxModelRef = async (
	config: WebGpuOnnxModelConfig
): Promise<string> => {
	if (config.source.type === 'huggingface') return config.source.repoId.trim();
	const blob = await getModelBlob(config.source.blobId);
	if (!blob) throw new Error('ONNX model file missing from storage');
	return URL.createObjectURL(blob);
};

const withTimeout = async <T>(
	p: Promise<T>,
	ms: number,
	signal?: AbortSignal
): Promise<T> => {
	let to: ReturnType<typeof setTimeout>;
	const timeoutP = new Promise<never>((_, rej) => {
		to = setTimeout(() => rej(new Error('Model request timed out')), ms);
		signal?.addEventListener('abort', () => rej(new Error('aborted')), {
			once: true,
		});
	});
	try {
		return await Promise.race([p, timeoutP]);
	} finally {
		clearTimeout(to!);
	}
};

class WebGpuOnnxBrain implements StreamingAgentBrain {
	private readonly generator: any;
	private readonly contextWindowTokens: number;
	private readonly requestTimeoutMs: number;
	private readonly getAbortSignal?: () => AbortSignal | undefined;

	private constructor(
		generator: any,
		contextWindowTokens: number,
		requestTimeoutMs: number,
		getAbortSignal?: () => AbortSignal | undefined
	) {
		this.generator = generator;
		this.contextWindowTokens = contextWindowTokens;
		this.requestTimeoutMs = requestTimeoutMs;
		this.getAbortSignal = getAbortSignal;
	}

	static async create(
		config: WebGpuOnnxModelConfig,
		opts: {
			requestTimeoutMs: number;
			getAbortSignal?: () => AbortSignal | undefined;
		}
	): Promise<WebGpuOnnxBrain> {
		const ref = await resolveOnnxModelRef(config);
		const gen = (await loadOnnxPipeline(ref)) as any;
		wrapOnnxTextGenerationPipelineCall(gen);
		return new WebGpuOnnxBrain(
			gen,
			config.contextWindowTokens,
			opts.requestTimeoutMs,
			opts.getAbortSignal
		);
	}

	async *processStep(input: ProcessStepInput) {
		const messages = buildOnnxProcessStepMessages(input);
		const signal = this.getAbortSignal?.();
		try {
			const output = (await withTimeout(
				this.generator(messages, buildOnnxGenerateOpts(this.contextWindowTokens)),
				this.requestTimeoutMs,
				signal
			)) as { generated_text?: unknown }[];
			const text = extractChatText(output?.[0]?.generated_text);
			if (text) yield text;
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
		const messages = buildOnnxAskPageMessages(input);
		const signal = this.getAbortSignal?.();
		try {
			const output = (await withTimeout(
				this.generator(messages, buildOnnxGenerateOpts(this.contextWindowTokens)),
				this.requestTimeoutMs,
				signal
			)) as { generated_text?: unknown }[];
			const text = extractChatText(output?.[0]?.generated_text);
			if (text) yield text;
		} catch (e: any) {
			yield `I hit an error while answering: ${e.message}`;
		}
	}
}

export default WebGpuOnnxBrain;
