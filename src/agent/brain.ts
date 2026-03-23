import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

export class AgentBrain {
    private llm: ChatOpenAI;
    private visionLlm?: ChatOpenAI;

    constructor(
        apiKey: string,
        baseUrl: string,
        modelName: string,
        visionApiKey?: string,
        visionBaseUrl?: string,
        visionModelName?: string
    ) {
        const requestTimeoutMs = 15 * 60 * 1000;
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
        this.llm = new ChatOpenAI({
            apiKey: resolvedApiKey,
            configuration: baseConfig,
            modelName: modelName,
            temperature: 0,
            streaming: true,
            timeout: requestTimeoutMs,
        });

        if (visionBaseUrl && visionModelName) {
            const isMissingVisionKey = !visionApiKey || visionApiKey.trim().length === 0;
            const resolvedVisionKey = isMissingVisionKey ? 'local-no-key' : visionApiKey;
            const visionConfig: { baseURL: string; fetch?: typeof fetch } = { baseURL: visionBaseUrl };
            if (isMissingVisionKey) {
                visionConfig.fetch = (input, init = {}) => {
                    const headers = new Headers(init.headers || {});
                    headers.delete('Authorization');
                    headers.delete('authorization');
                    return fetch(input, { ...init, headers });
                };
            }
            this.visionLlm = new ChatOpenAI({
                apiKey: resolvedVisionKey,
                configuration: visionConfig,
                modelName: visionModelName,
                temperature: 0,
                streaming: false,
                timeout: requestTimeoutMs,
            });
        }
    }

    async observeWithVision(
        task: string,
        url: string,
        imageDataUrl?: string,
        viewport?: { width: number; height: number; devicePixelRatio: number }
    ) {
        if (!this.visionLlm || !imageDataUrl) return "";
        const systemPrompt = `You are a visual observer for a web automation agent.
You NEVER take actions. You only describe what you see.
Return ONLY valid JSON, no markdown.

Schema:
{
  "elements": [
    {
      "label": "text on element",
      "type": "button|input|link|menu|tab|checkbox|radio|modal|toast|other",
      "x": 0,
      "y": 0,
      "width": 0,
      "height": 0,
      "color": "#RRGGBB",
      "background": "#RRGGBB",
      "confidence": 0.0
    }
  ],
  "notes": "short summary of blockers or required steps"
}

Coordinates MUST be in viewport CSS pixels with (0,0) at top-left of the screenshot.
Include the most relevant interactive elements first.`;

        const humanText = `Task: ${task}
URL: ${url}
Viewport: ${viewport ? `${viewport.width}x${viewport.height} @${viewport.devicePixelRatio}x` : "unknown"}
Describe the visible UI in JSON using the schema.`;

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage({
                content: [
                    { type: "text", text: humanText },
                    { type: "image_url", image_url: { url: imageDataUrl } }
                ],
            } as any),
        ];

        try {
            const response = await this.visionLlm.invoke(messages);
            return typeof response.content === "string" ? response.content : "";
        } catch (e: any) {
            console.error("Vision LLM Error:", e);
            return "";
        }
    }

    async describeImage(task: string, imageDataUrl: string, fileName: string) {
        if (!this.visionLlm || !imageDataUrl) return "";
        const systemPrompt = `You are a file analyzer for a web automation agent.
You NEVER take actions. You only describe the content and relevant details.
Summarize text, forms, labels, and anything useful for completing the task.`;

        const humanText = `Task: ${task}\nFile: ${fileName}\nDescribe the image content.`;

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage({
                content: [
                    { type: "text", text: humanText },
                    { type: "image_url", image_url: { url: imageDataUrl } }
                ],
            } as any),
        ];

        try {
            const response = await this.visionLlm.invoke(messages);
            return typeof response.content === "string" ? response.content : "";
        } catch (e: any) {
            console.error("Vision File Error:", e);
            return "";
        }
    }

    async *processStep(
        task: string,
        url: string,
        pageContent: string,
        history: string[],
        visionObservation?: string,
        fileContext?: string,
        elementMap?: string,
        assetCatalog?: string
    ) {
        const historyText = history.map((h) => `- ${h}`).join("\n");

        const systemPrompt = `You are a precise autonomous agent navigating a web browser.
Your goal is to complete the user's Task.

You will be given:
1. The Task description
2. The Current URL
3. The Simplified Page Content (Visible text and interactive elements)
4. PREVIOUS ACTIONS: A list of actions you have already taken.
5. OPTIONAL VISION OBSERVATION: A passive visual description from a vision model.
6. OPTIONAL FILES: User-provided files (text or image summaries).
7. OPTIONAL ELEMENT MAP: JSON of UI elements with ids, text, rect, and styles.
8. OPTIONAL ASSETS: List of asset filenames for upload (NOT content).

You must output ONLY a JSON object with "action" and "params".
Do NOT include markdown, explanations, or extra text.

Example:
{
  "action": "TYPE",
  "params": { "label": "Search", "text": "Deepmind" }
}
Do NOT repeat the same action if it already failed. Ask for help instead.
Prefer coordinate-based actions if VISION OBSERVATION includes element coordinates. Use element ids if coordinates are missing. Use label only if id is missing.
Prefer labels that exactly match the PAGE CONTENT.
If your output would be invalid JSON, output ONLY valid JSON with double quotes and no trailing commas.

Supported Actions:
1. \`CLICK\`
   - params: { "label": "text on button" } 
2. \`CLICK_INDEX\`
   - params: { "index": 0 }
3. \`CLICK_ID\`
   - params: { "id": "el_..." }
4. \`CLICK_COORDS\`
   - params: { "x": 123, "y": 456 }
5. \`TYPE\`
   - params: { "label": "label", "text": "value" }
6. \`TYPE_ID\`
   - params: { "id": "el_...", "text": "value" }
7. \`TYPE_COORDS\`
   - params: { "x": 123, "y": 456, "text": "value" }
8. \`NAVIGATE\`
   - params: { "url": "url" }
9. \`SCROLL\`
   - params: { "direction": "down" | "up" }
10. \`WAIT\`
   - params: { "ms": 1000 }
11. \`HOVER\`
   - params: { "label": "text on element" }
12. \`HOVER_ID\`
   - params: { "id": "el_..." }
13. \`HOVER_COORDS\`
   - params: { "x": 123, "y": 456 }
14. \`SELECT\`
   - params: { "label": "field label", "value": "option value or text" }
15. \`SELECT_ID\`
   - params: { "id": "el_...", "value": "option value or text" }
16. \`UPLOAD_ASSET\`
   - params: { "assetName": "filename.pdf", "id"?: "el_...", "x"?: 123, "y"?: 456, "label"?: "Upload" }
17. \`KEY\`
   - params: { "key": "Enter" }
18. \`DONE\`
   - params: { "summary": "message" }
19. \`ASK\`
   - params: { "question": "text" }
`;

        const userContent = `
    TASK: ${task}
    URL: ${url}

    PREVIOUS ACTIONS:
    ${historyText}

    PAGE CONTENT:
    ${pageContent.substring(0, 20000)}
    (Content truncated if too long)

    VISION OBSERVATION:
    ${visionObservation || "(none)"}

    FILES:
    ${fileContext || "(none)"}

    ELEMENT MAP (JSON):
    ${elementMap || "(none)"}

    ASSETS (upload-only list):
    ${assetCatalog || "(none)"}
    `;

        const messages = [
            new SystemMessage(systemPrompt),
            new HumanMessage(userContent),
        ];

        try {
            const stream = await this.llm.stream(messages);
            for await (const chunk of stream) {
                if (chunk.content) {
                    yield chunk.content as string;
                }
            }
        } catch (e: any) {
            console.error("LLM Error:", e);
            yield `\n\`\`\`json\n{"action": "DONE", "params": {"summary": "Error: ${e.message}"}}\n\`\`\``;
        }
    }

    static async fetchModels(baseUrl: string, apiKey: string): Promise<string[]> {
        try {
            // Remove /v1 if present for the fetch, or just try standards
            // OpenWebUI / Ollama usually works with /v1/models
            let url = baseUrl;
            if (!url.endsWith('/v1')) {
                // Try to be smart? Or just expect user provides correct base url
            }

            // Standard OpenAI format
            const headers: Record<string, string> = {};
            if (apiKey && apiKey.trim().length > 0) {
                headers.Authorization = `Bearer ${apiKey}`;
            }
            const response = await fetch(`${baseUrl}/models`, { headers });

            if (!response.ok) throw new Error("Failed to fetch models");

            const data = await response.json();
            // Handle standard OpenAI { data: [{ id: "..." }] }
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
