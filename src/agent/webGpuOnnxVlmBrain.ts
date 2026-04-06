import type { WebGpuOnnxModelConfig } from '../app/types/ModelConfig';
import getModelBlob from '../app/modelBlobDb/getModelBlob';
import loadOnnxVlmModel from './loadOnnxVlmModel';
import getAskPageSystemPrompt from './getAskPageSystemPrompt';
import getProcessStepSystemPrompt from './getProcessStepSystemPrompt';
import type {
	AskPageInput,
	ProcessStepInput,
	StreamingAgentBrain,
	VisualAttachment,
} from './brainTypes';

/* eslint-disable @typescript-eslint/no-explicit-any */

type ChatPart =
	| { type: 'text'; text: string }
	| { type: 'image' };

type ChatMsg = { role: 'system' | 'user' | 'model'; content: string | ChatPart[] };

const collectVisionImages = (
	supportsVision: boolean,
	screenshotDataUrl?: string,
	attachedImages?: VisualAttachment[]
): string[] => {
	if (!supportsVision) return [];
	const urls: string[] = [];
	if (screenshotDataUrl) urls.push(screenshotDataUrl);
	attachedImages?.forEach((img) => urls.push(img.dataUrl));
	return urls;
};

const buildProcessStepContent = (
	input: ProcessStepInput,
	imageCount: number
): ChatPart[] => {
	const parts: ChatPart[] = [];
	for (let i = 0; i < imageCount; i++) parts.push({ type: 'image' });

	const historyText =
		input.history.length > 0
			? input.history.map((h) => `- ${h}`).join('\n')
			: '(none)';

	parts.push({
		type: 'text',
		text: `TASK:\n${input.task}

URL:\n${input.url}

PREVIOUS ACTIONS:\n${historyText}

PAGE CONTENT:\n${input.pageContent.substring(0, 20000)}

FILES:\n${input.fileContext || '(none)'}

ELEMENT MAP:\n${input.elementMap || '(none)'}

ASSETS:\n${input.assetCatalog || '(none)'}

${input.tabContext || 'TAB CONTEXT: unavailable'}

${input.mcpCatalog || 'MCP TOOLS: none'}`,
	});
	return parts;
};

const buildAskPageContent = (
	input: AskPageInput,
	imageCount: number
): ChatPart[] => {
	const parts: ChatPart[] = [];
	for (let i = 0; i < imageCount; i++) parts.push({ type: 'image' });

	parts.push({
		type: 'text',
		text: `QUESTION:\n${input.question}

URL:\n${input.url}

PAGE CONTENT:\n${input.pageContent.substring(0, 20000)}

FILES:\n${input.fileContext || '(none)'}

ELEMENT MAP:\n${input.elementMap || '(none)'}`,
	});
	return parts;
};

const resolveOnnxVlmRef = async (
	config: WebGpuOnnxModelConfig
): Promise<string> => {
	if (config.source.type === 'huggingface') return config.source.repoId.trim();
	const blob = await getModelBlob(config.source.blobId);
	if (!blob) throw new Error('ONNX VLM model file missing from storage');
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

const loadImages = async (dataUrls: string[]): Promise<any[]> => {
	if (dataUrls.length === 0) return [];
	const { RawImage } = await import('@huggingface/transformers');
	return Promise.all(dataUrls.map((url) => RawImage.fromURL(url)));
};

const generate = async (
	model: any,
	processor: any,
	messages: ChatMsg[],
	imageDataUrls: string[],
	maxNewTokens: number,
	signal?: AbortSignal
): Promise<string> => {
	const prompt = processor.apply_chat_template(messages, {
		enable_thinking: false,
		add_generation_prompt: true,
	});

	const images = await loadImages(imageDataUrls);
	const inputs: any = await processor(
		prompt,
		images.length > 0 ? images : null,
		null,
		{ add_special_tokens: false }
	);

	const outputs: any = await model.generate({
		...inputs,
		max_new_tokens: maxNewTokens,
		do_sample: false,
		...(signal ? { abortSignal: signal } : {}),
	});

	const promptLen = inputs.input_ids.dims.at(-1) ?? 0;
	const decoded: string[] = processor.batch_decode(
		outputs.slice(null, [promptLen, null]),
		{ skip_special_tokens: true }
	);
	return (decoded[0] ?? '').trim();
};

class WebGpuOnnxVlmBrain implements StreamingAgentBrain {
	private readonly model: any;
	private readonly processor: any;
	private readonly supportsVision: boolean;
	private readonly contextWindowTokens: number;
	private readonly requestTimeoutMs: number;
	private readonly getAbortSignal?: () => AbortSignal | undefined;

	private constructor(
		model: any,
		processor: any,
		supportsVision: boolean,
		contextWindowTokens: number,
		requestTimeoutMs: number,
		getAbortSignal?: () => AbortSignal | undefined
	) {
		this.model = model;
		this.processor = processor;
		this.supportsVision = supportsVision;
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
	): Promise<WebGpuOnnxVlmBrain> {
		const ref = await resolveOnnxVlmRef(config);
		const { model, processor } = await loadOnnxVlmModel(ref);
		return new WebGpuOnnxVlmBrain(
			model,
			processor,
			config.supportsVision,
			config.contextWindowTokens,
			opts.requestTimeoutMs,
			opts.getAbortSignal
		);
	}

	async *processStep(input: ProcessStepInput) {
		const imageDataUrls = collectVisionImages(
			this.supportsVision,
			input.screenshotDataUrl,
			input.attachedImages
		);
		const messages: ChatMsg[] = [
			{ role: 'system', content: getProcessStepSystemPrompt() },
			{ role: 'user', content: buildProcessStepContent(input, imageDataUrls.length) },
		];
		const maxNew = Math.min(2048, Math.max(64, this.contextWindowTokens - 256));
		const signal = this.getAbortSignal?.();
		try {
			const text = await withTimeout(
				generate(this.model, this.processor, messages, imageDataUrls, maxNew, signal),
				this.requestTimeoutMs,
				signal
			);
			if (text) yield text;
		} catch (e: any) {
			const msg = (e.message || '').toLowerCase();
			if (msg.includes('context') || msg.includes('token') || msg.includes('length')) throw e;
			yield `{"action":"DONE","params":{"summary":"Error: ${e.message}"}}`;
		}
	}

	async *askPage(input: AskPageInput) {
		const imageDataUrls = collectVisionImages(
			this.supportsVision,
			input.screenshotDataUrl,
			input.attachedImages
		);
		const messages: ChatMsg[] = [
			{ role: 'system', content: getAskPageSystemPrompt() },
			{ role: 'user', content: buildAskPageContent(input, imageDataUrls.length) },
		];
		const maxNew = Math.min(2048, Math.max(64, this.contextWindowTokens - 256));
		const signal = this.getAbortSignal?.();
		try {
			const text = await withTimeout(
				generate(this.model, this.processor, messages, imageDataUrls, maxNew, signal),
				this.requestTimeoutMs,
				signal
			);
			if (text) yield text;
		} catch (e: any) {
			yield `I hit an error while answering: ${e.message}`;
		}
	}
}

export default WebGpuOnnxVlmBrain;
