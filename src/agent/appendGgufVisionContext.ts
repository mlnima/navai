import type { ViewportInfo, VisualAttachment } from './brainTypes';

type VisionFields = {
	supportsVision?: boolean;
	screenshotDataUrl?: string;
	viewport?: ViewportInfo;
	attachedImages?: VisualAttachment[];
};

const cap = (s: string, max: number) =>
	s.length <= max ? s : `${s.slice(0, max)}…[truncated]`;

const appendGgufVisionContext = (
	fields: VisionFields,
	modelSupportsVision: boolean
): string => {
	if (!modelSupportsVision || !fields.supportsVision) return '';
	const parts: string[] = [];
	if (fields.screenshotDataUrl) {
		parts.push(`SCREENSHOT (data URL):\n${cap(fields.screenshotDataUrl, 120_000)}`);
	}
	if (fields.viewport) {
		parts.push(
			`VIEWPORT: ${fields.viewport.width}x${fields.viewport.height} dpr ${fields.viewport.devicePixelRatio}`
		);
	}
	for (const img of fields.attachedImages ?? []) {
		parts.push(`IMAGE ${img.name}:\n${cap(img.dataUrl, 80_000)}`);
	}
	return parts.length > 0 ? `\n\nVISUAL INPUT:\n${parts.join('\n\n')}` : '';
};

export default appendGgufVisionContext;
