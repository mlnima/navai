import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatOpenAI } from '@langchain/openai';
import type {
	AskPageInput,
	ProcessStepInput,
	StreamingAgentBrain,
} from './brainTypes';
import getAskPageSystemPrompt from './getAskPageSystemPrompt';
import getProcessStepSystemPrompt from './getProcessStepSystemPrompt';

export class OpenAiAgentBrain implements StreamingAgentBrain {
	private llm: ChatOpenAI;

	constructor(
		apiKey: string,
		baseUrl: string,
		modelName: string,
		requestTimeoutMs: number
	) {
		const isMissingKey = !apiKey || apiKey.trim().length === 0;
		const resolvedApiKey = isMissingKey ? 'local-no-key' : apiKey;
		const baseConfig: { baseURL: string; fetch?: typeof fetch } = {
			baseURL: baseUrl,
		};

		if (isMissingKey) {
			baseConfig.fetch = (input, init = {}) => {
				const headers = new Headers(init.headers || {});
				headers.delete('Authorization');
				headers.delete('authorization');
				return fetch(input, { ...init, headers });
			};
		}

		this.llm = new ChatOpenAI({
			apiKey: resolvedApiKey,
			configuration: baseConfig,
			modelName,
			temperature: 0,
			streaming: true,
			timeout: requestTimeoutMs,
		});
	}

	async *processStep(input: ProcessStepInput) {
		const {
			task,
			url,
			pageContent,
			history,
			fileContext,
			elementMap,
			assetCatalog,
			tabContext,
			mcpCatalog,
			supportsVision,
			screenshotDataUrl,
			viewport,
			attachedImages = [],
		} = input;

		const historyText =
			history.length > 0 ? history.map((h) => `- ${h}`).join('\n') : '(none)';
		const visionEnabled = Boolean(supportsVision);
		const hasScreenshot = visionEnabled && Boolean(screenshotDataUrl);
		const hasAttachedImages = visionEnabled && attachedImages.length > 0;

		const systemPrompt = getProcessStepSystemPrompt();

		const textContext = `TASK:\n${task}

URL:\n${url}

PREVIOUS ACTIONS:\n${historyText}

PAGE CONTENT:\n${pageContent.substring(
			0,
			20000
		)}\n(Content truncated if too long)

FILES (text context):\n${fileContext || '(none)'}

ELEMENT MAP (JSON):\n${elementMap || '(none)'}

ASSETS (upload-only list):\n${assetCatalog || '(none)'}

${tabContext || 'TAB CONTEXT: unavailable'}

${mcpCatalog || 'MCP TOOLS: none'}

VISION CAPABILITY:\n${visionEnabled ? 'enabled' : 'disabled'}

SCREENSHOT AVAILABLE:\n${hasScreenshot ? 'yes' : 'no'}

ATTACHED IMAGE FILES:\n${
			hasAttachedImages
				? attachedImages.map((img) => `- ${img.name}`).join('\n')
				: '(none)'
		}`;

		const contentParts: unknown[] = [{ type: 'text', text: textContext }];

		if (hasScreenshot && screenshotDataUrl) {
			const viewportText = viewport
				? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
				: 'Current page screenshot.';
			contentParts.push({ type: 'text', text: viewportText });
			contentParts.push({
				type: 'image_url',
				image_url: { url: screenshotDataUrl },
			});
		}

		if (hasAttachedImages) {
			attachedImages.forEach((image) => {
				contentParts.push({
					type: 'text',
					text: `Attached file image: ${image.name}`,
				});
				contentParts.push({
					type: 'image_url',
					image_url: { url: image.dataUrl },
				});
			});
		}

		const messages = [
			new SystemMessage(systemPrompt),
			new HumanMessage({ content: contentParts } as any),
		];

		try {
			const stream = await this.llm.stream(messages);
			for await (const chunk of stream) {
				if (!chunk.content) continue;
				if (typeof chunk.content === 'string') {
					yield chunk.content;
					continue;
				}
				if (Array.isArray(chunk.content)) {
					const text = chunk.content
						.map((part: any) =>
							typeof part === 'string' ? part : part?.text || ''
						)
						.join('');
					if (text) yield text;
				}
			}
		} catch (e: any) {
			const msg = (e.message || '').toLowerCase();
			const isContextError =
				msg.includes('context length') ||
				msg.includes('context_length') ||
				msg.includes('token limit') ||
				msg.includes('too many tokens') ||
				msg.includes('maximum.*exceeded') ||
				msg.includes('model_max_length') ||
				(msg.includes('maximum') && msg.includes('tokens'));
			if (isContextError) throw e;
			console.error('LLM Error:', e);
			yield `{"action":"DONE","params":{"summary":"Error: ${e.message}"}}`;
		}
	}

	async *askPage(input: AskPageInput) {
		const {
			question,
			url,
			pageContent,
			fileContext,
			elementMap,
			supportsVision,
			screenshotDataUrl,
			viewport,
			attachedImages = [],
		} = input;

		const visionEnabled = Boolean(supportsVision);
		const hasScreenshot = visionEnabled && Boolean(screenshotDataUrl);
		const hasAttachedImages = visionEnabled && attachedImages.length > 0;

		const systemPrompt = getAskPageSystemPrompt();

		const textContext = `QUESTION:\n${question}

URL:\n${url}

PAGE CONTENT:\n${pageContent.substring(
			0,
			20000
		)}\n(Content truncated if too long)

FILES (text context):\n${fileContext || '(none)'}

ELEMENT MAP (JSON):\n${elementMap || '(none)'}

VISION CAPABILITY:\n${visionEnabled ? 'enabled' : 'disabled'}

SCREENSHOT AVAILABLE:\n${hasScreenshot ? 'yes' : 'no'}

ATTACHED IMAGE FILES:\n${
			hasAttachedImages
				? attachedImages.map((img) => `- ${img.name}`).join('\n')
				: '(none)'
		}`;

		const contentParts: unknown[] = [{ type: 'text', text: textContext }];

		if (hasScreenshot && screenshotDataUrl) {
			const viewportText = viewport
				? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
				: 'Current page screenshot.';
			contentParts.push({ type: 'text', text: viewportText });
			contentParts.push({
				type: 'image_url',
				image_url: { url: screenshotDataUrl },
			});
		}

		if (hasAttachedImages) {
			attachedImages.forEach((image) => {
				contentParts.push({
					type: 'text',
					text: `Attached file image: ${image.name}`,
				});
				contentParts.push({
					type: 'image_url',
					image_url: { url: image.dataUrl },
				});
			});
		}

		const messages = [
			new SystemMessage(systemPrompt),
			new HumanMessage({ content: contentParts } as any),
		];

		try {
			const stream = await this.llm.stream(messages);
			for await (const chunk of stream) {
				if (!chunk.content) continue;
				if (typeof chunk.content === 'string') {
					yield chunk.content;
					continue;
				}
				if (Array.isArray(chunk.content)) {
					const text = chunk.content
						.map((part: any) =>
							typeof part === 'string' ? part : part?.text || ''
						)
						.join('');
					if (text) yield text;
				}
			}
		} catch (e: any) {
			console.error('Ask Mode Error:', e);
			yield `I hit an error while answering: ${e.message}`;
		}
	}

	static async fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
		try {
			const headers: Record<string, string> = {};
			if (apiKey && apiKey.trim().length > 0) {
				headers.Authorization = `Bearer ${apiKey}`;
			}
			const response = await fetch(`${baseUrl}/models`, { headers });
			if (!response.ok) throw new Error('Failed to fetch models');

			const data = await response.json();
			if (data.data && Array.isArray(data.data)) {
				return data.data.map((m: any) => m.id);
			}
			return [];
		} catch (e) {
			console.error('Fetch Models Error', e);
			return [];
		}
	}
}

export { OpenAiAgentBrain as AgentBrain };
