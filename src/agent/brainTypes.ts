export interface ViewportInfo {
	width: number;
	height: number;
	devicePixelRatio: number;
}

export interface VisualAttachment {
	name: string;
	dataUrl: string;
}

export interface ProcessStepInput {
	task: string;
	url: string;
	pageContent: string;
	history: string[];
	fileContext?: string;
	elementMap?: string;
	assetCatalog?: string;
	tabContext?: string;
	mcpCatalog?: string;
	supportsVision?: boolean;
	screenshotDataUrl?: string;
	viewport?: ViewportInfo;
	attachedImages?: VisualAttachment[];
}

export interface AskPageInput {
	question: string;
	url: string;
	pageContent: string;
	fileContext?: string;
	elementMap?: string;
	supportsVision?: boolean;
	screenshotDataUrl?: string;
	viewport?: ViewportInfo;
	attachedImages?: VisualAttachment[];
}

export interface StreamingAgentBrain {
	processStep(input: ProcessStepInput): AsyncGenerator<string, void, unknown>;
	askPage(input: AskPageInput): AsyncGenerator<string, void, unknown>;
}
