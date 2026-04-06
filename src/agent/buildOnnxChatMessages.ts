import type { AskPageInput, ProcessStepInput } from './brainTypes';
import getAskPageSystemPrompt from './getAskPageSystemPrompt';
import getProcessStepSystemPrompt from './getProcessStepSystemPrompt';

type Msg = {
	role: 'system' | 'user' | 'assistant';
	content:
		| string
		| Array<{ type: 'text'; text: string } | { type: 'image'; image: string }>;
};

const buildProcessStepUserContent = (
	input: ProcessStepInput
): Msg['content'] => {
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

	const textContext = `TASK:\n${task}

URL:\n${url}

PREVIOUS ACTIONS:\n${historyText}

PAGE CONTENT:\n${pageContent.substring(0, 20000)}\n(Content truncated if too long)

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

	const parts: Array<
		{ type: 'text'; text: string } | { type: 'image'; image: string }
	> = [{ type: 'text', text: textContext }];

	if (hasScreenshot && screenshotDataUrl) {
		const viewportText = viewport
			? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
			: 'Current page screenshot.';
		parts.push({ type: 'text', text: viewportText });
		parts.push({ type: 'image', image: screenshotDataUrl });
	}

	if (hasAttachedImages) {
		attachedImages.forEach((image) => {
			parts.push({
				type: 'text',
				text: `Attached file image: ${image.name}`,
			});
			parts.push({ type: 'image', image: image.dataUrl });
		});
	}

	return parts;
};

const buildAskPageUserContent = (input: AskPageInput): Msg['content'] => {
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

	const textContext = `QUESTION:\n${question}

URL:\n${url}

PAGE CONTENT:\n${pageContent.substring(0, 20000)}\n(Content truncated if too long)

FILES (text context):\n${fileContext || '(none)'}

ELEMENT MAP (JSON):\n${elementMap || '(none)'}

VISION CAPABILITY:\n${visionEnabled ? 'enabled' : 'disabled'}

SCREENSHOT AVAILABLE:\n${hasScreenshot ? 'yes' : 'no'}

ATTACHED IMAGE FILES:\n${
		hasAttachedImages
			? attachedImages.map((img) => `- ${img.name}`).join('\n')
			: '(none)'
	}`;

	const parts: Array<
		{ type: 'text'; text: string } | { type: 'image'; image: string }
	> = [{ type: 'text', text: textContext }];

	if (hasScreenshot && screenshotDataUrl) {
		const viewportText = viewport
			? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
			: 'Current page screenshot.';
		parts.push({ type: 'text', text: viewportText });
		parts.push({ type: 'image', image: screenshotDataUrl });
	}

	if (hasAttachedImages) {
		attachedImages.forEach((image) => {
			parts.push({
				type: 'text',
				text: `Attached file image: ${image.name}`,
			});
			parts.push({ type: 'image', image: image.dataUrl });
		});
	}

	return parts;
};

export const buildOnnxProcessStepMessages = (
	input: ProcessStepInput
): Msg[] => [
	{ role: 'system', content: getProcessStepSystemPrompt() },
	{ role: 'user', content: buildProcessStepUserContent(input) },
];

export const buildOnnxAskPageMessages = (input: AskPageInput): Msg[] => [
	{ role: 'system', content: getAskPageSystemPrompt() },
	{ role: 'user', content: buildAskPageUserContent(input) },
];
