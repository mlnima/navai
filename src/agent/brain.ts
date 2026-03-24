import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

interface ViewportInfo {
    width: number;
    height: number;
    devicePixelRatio: number;
}

interface VisualAttachment {
    name: string;
    dataUrl: string;
}

interface ProcessStepInput {
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

interface AskPageInput {
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

export class AgentBrain {
    private llm: ChatOpenAI;

    constructor(
        apiKey: string,
        baseUrl: string,
        modelName: string,
        requestTimeoutMs: number
    ) {
        const isMissingKey = !apiKey || apiKey.trim().length === 0;
        const resolvedApiKey = isMissingKey ? "local-no-key" : apiKey;
        const baseConfig: { baseURL: string; fetch?: typeof fetch } = { baseURL: baseUrl };

        if (isMissingKey) {
            baseConfig.fetch = (input, init = {}) => {
                const headers = new Headers(init.headers || {});
                headers.delete("Authorization");
                headers.delete("authorization");
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

        const historyText = history.length > 0 ? history.map((h) => `- ${h}`).join("\n") : "(none)";
        const visionEnabled = Boolean(supportsVision);
        const hasScreenshot = visionEnabled && Boolean(screenshotDataUrl);
        const hasAttachedImages = visionEnabled && attachedImages.length > 0;

        const systemPrompt = `You are a precise autonomous agent navigating a web browser.
Your goal is to complete the user's task safely and efficiently.

You must choose the next best action based on available context.
If visual inputs are present, use them only when needed.
If text and element map are already sufficient, do not over-rely on vision.

Return ONLY one valid JSON object with keys "action" and "params".
Do NOT include markdown fences or extra text.

Do not repeat the same failed action. If blocked, use ASK.
Prefer ids from ELEMENT MAP first, then exact labels, then coordinates.
Prefer staying in the current tab; use OPEN_TAB only when a new tab is clearly needed.
If you output invalid JSON, recover by outputting valid JSON only.

Supported Actions:
1. CLICK -> { "label": "text on button" }
2. CLICK_INDEX -> { "index": 0 }
3. CLICK_ID -> { "id": "el_..." }
4. CLICK_COORDS -> { "x": 123, "y": 456 }
5. TYPE -> { "label": "label", "text": "value" }
6. TYPE_ID -> { "id": "el_...", "text": "value" }
7. TYPE_COORDS -> { "x": 123, "y": 456, "text": "value" }
8. NAVIGATE -> { "url": "https://..." }
9. SCROLL -> { "direction": "down" | "up" }
10. WAIT -> { "ms": 1000 }
11. HOVER -> { "label": "text on element" }
12. HOVER_ID -> { "id": "el_..." }
13. HOVER_COORDS -> { "x": 123, "y": 456 }
14. SELECT -> { "label": "field label", "value": "option" }
15. SELECT_ID -> { "id": "el_...", "value": "option" }
16. UPLOAD_ASSET -> { "assetName": "file.pdf", "id"?: "el_...", "x"?: 123, "y"?: 456, "label"?: "Upload" }
17. KEY -> { "key": "Enter" }
18. OPEN_TAB -> { "url": "https://...", "background"?: false }
19. SWITCH_TAB -> { "tabId"?: 123, "index"?: 0, "urlContains"?: "docs" }
20. CLOSE_TAB -> { "tabId"?: 123 }
21. CLOSE_EXTRA_TABS -> {}
22. MCP_CALL -> { "serverId": "mcp_...", "tool": "tool_name", "arguments": { "key": "value" } }
For MCP attachments, prefer arguments.attachments with filename/content(base64)/mimeType.
You may also provide attachments[].textContent or arguments.generatedFiles and the client will convert to base64.
Canonical target shape sent to MCP is always:
{ "attachments": [ { "filename": "...", "content": "<base64>", "mimeType": "..." } ] }.
Example for CV + generated cover letter:
{
  "action":"MCP_CALL",
  "params":{
    "serverId":"mcp_...",
    "tool":"create_draft",
    "arguments":{
      "to":"user@example.com",
      "subject":"Application",
      "body":"Please find attachments.",
      "attachments":[
        { "assetName":"CV.pdf" },
        { "filename":"CoverLetter.txt", "textContent":"Dear Hiring Manager...", "mimeType":"text/plain" }
      ]
    }
  }
}
23. DONE -> { "summary": "message" }
24. ASK -> { "question": "text" }`;

        const textContext = `TASK:\n${task}

URL:\n${url}

PREVIOUS ACTIONS:\n${historyText}

PAGE CONTENT:\n${pageContent.substring(0, 20000)}\n(Content truncated if too long)

FILES (text context):\n${fileContext || "(none)"}

ELEMENT MAP (JSON):\n${elementMap || "(none)"}

ASSETS (upload-only list):\n${assetCatalog || "(none)"}

${tabContext || "TAB CONTEXT: unavailable"}

${mcpCatalog || "MCP TOOLS: none"}

VISION CAPABILITY:\n${visionEnabled ? "enabled" : "disabled"}

SCREENSHOT AVAILABLE:\n${hasScreenshot ? "yes" : "no"}

ATTACHED IMAGE FILES:\n${hasAttachedImages ? attachedImages.map((img) => `- ${img.name}`).join("\n") : "(none)"}`;

        const contentParts: any[] = [{ type: "text", text: textContext }];

        if (hasScreenshot && screenshotDataUrl) {
            const viewportText = viewport
                ? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
                : "Current page screenshot.";
            contentParts.push({ type: "text", text: viewportText });
            contentParts.push({ type: "image_url", image_url: { url: screenshotDataUrl } });
        }

        if (hasAttachedImages) {
            attachedImages.forEach((image) => {
                contentParts.push({ type: "text", text: `Attached file image: ${image.name}` });
                contentParts.push({ type: "image_url", image_url: { url: image.dataUrl } });
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
                if (typeof chunk.content === "string") {
                    yield chunk.content;
                    continue;
                }
                if (Array.isArray(chunk.content)) {
                    const text = chunk.content
                        .map((part: any) => (typeof part === "string" ? part : part?.text || ""))
                        .join("");
                    if (text) yield text;
                }
            }
        } catch (e: any) {
            console.error("LLM Error:", e);
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

        const systemPrompt = `You are a web page assistant in ASK mode.
You must answer questions and provide guidance only.
Do NOT output browser actions, commands, JSON actions, or automation steps to execute.
If information is missing, say what is missing and ask a concise follow-up question.
Prefer clear, practical answers grounded in the provided page context.`;

        const textContext = `QUESTION:\n${question}

URL:\n${url}

PAGE CONTENT:\n${pageContent.substring(0, 20000)}\n(Content truncated if too long)

FILES (text context):\n${fileContext || "(none)"}

ELEMENT MAP (JSON):\n${elementMap || "(none)"}

VISION CAPABILITY:\n${visionEnabled ? "enabled" : "disabled"}

SCREENSHOT AVAILABLE:\n${hasScreenshot ? "yes" : "no"}

ATTACHED IMAGE FILES:\n${hasAttachedImages ? attachedImages.map((img) => `- ${img.name}`).join("\n") : "(none)"}`;

        const contentParts: any[] = [{ type: "text", text: textContext }];

        if (hasScreenshot && screenshotDataUrl) {
            const viewportText = viewport
                ? `Current page screenshot (${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x).`
                : "Current page screenshot.";
            contentParts.push({ type: "text", text: viewportText });
            contentParts.push({ type: "image_url", image_url: { url: screenshotDataUrl } });
        }

        if (hasAttachedImages) {
            attachedImages.forEach((image) => {
                contentParts.push({ type: "text", text: `Attached file image: ${image.name}` });
                contentParts.push({ type: "image_url", image_url: { url: image.dataUrl } });
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
                if (typeof chunk.content === "string") {
                    yield chunk.content;
                    continue;
                }
                if (Array.isArray(chunk.content)) {
                    const text = chunk.content
                        .map((part: any) => (typeof part === "string" ? part : part?.text || ""))
                        .join("");
                    if (text) yield text;
                }
            }
        } catch (e: any) {
            console.error("Ask Mode Error:", e);
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
            if (!response.ok) throw new Error("Failed to fetch models");

            const data = await response.json();
            if (data.data && Array.isArray(data.data)) {
                return data.data.map((m: any) => m.id);
            }
            return [];
        } catch (e) {
            console.error("Fetch Models Error", e);
            return [];
        }
    }
}
