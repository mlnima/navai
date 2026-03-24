import type { McpServerConfig } from "./mcpConfig";

export interface McpToolDescriptor {
    serverId: string;
    serverName: string;
    name: string;
    description?: string;
    inputSchema?: unknown;
}

interface JsonRpcResult<T = any> {
    ok: boolean;
    result?: T;
    error?: string;
    sessionId?: string;
}

interface SseSessionState {
    signature: string;
    messagesUrl?: string;
    sessionId?: string;
    ready: Promise<void>;
    resolveReady: () => void;
    rejectReady: (error: Error) => void;
    abortController: AbortController;
    reader?: ReadableStreamDefaultReader<Uint8Array>;
    closed: boolean;
    pending: Map<number, { resolve: (result: any) => void; reject: (error: Error) => void; timer: number }>;
}

let rpcSequence = 0;
const nextRpcId = () => Date.now() * 1000 + ((rpcSequence = (rpcSequence + 1) % 1000));

const createRpcPayload = (method: string, params: Record<string, unknown> = {}) => ({
    jsonrpc: "2.0",
    id: nextRpcId(),
    method,
    params
});

const parseSseJsonRpc = (raw: string) => {
    const lines = raw.split(/\r?\n/);
    for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
            const parsed = JSON.parse(payload);
            if (parsed?.result || parsed?.error) return parsed;
        } catch {
            // Continue
        }
    }
    return null;
};

const sseSessions = new Map<string, SseSessionState>();
const sseSessionSignature = (server: McpServerConfig) =>
    JSON.stringify({
        url: server.url,
        type: server.type || "",
        headers: server.headers || {}
    });

const resolveEndpointUrl = (baseUrl: string, endpoint: string) => {
    try {
        return new URL(endpoint, baseUrl).toString();
    } catch {
        return endpoint;
    }
};

const parseSseEventBlocks = (raw: string) => {
    const blocks = raw.split(/\r?\n\r?\n/);
    return blocks
        .map((block) => {
            const lines = block.split(/\r?\n/);
            const event = lines
                .filter((line) => line.startsWith("event:"))
                .map((line) => line.slice(6).trim())[0] || "";
            const data = lines
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim())
                .join("\n");
            return { event, data };
        })
        .filter((item) => item.data || item.event);
};

const closeSseSession = (session: SseSessionState | undefined) => {
    if (!session || session.closed) return;
    session.closed = true;
    session.pending.forEach((entry) => {
        window.clearTimeout(entry.timer);
        entry.reject(new Error("SSE session closed."));
    });
    session.pending.clear();
    try {
        session.abortController.abort();
    } catch {
        // ignore
    }
    try {
        session.reader?.cancel();
    } catch {
        // ignore
    }
};

const createReadyPair = () => {
    let resolveReady: () => void = () => {};
    let rejectReady: (error: Error) => void = () => {};
    const ready = new Promise<void>((resolve, reject) => {
        resolveReady = () => resolve();
        rejectReady = (error: Error) => reject(error);
    });
    return { ready, resolveReady, rejectReady };
};

const getEndpointFromEvent = (event: { event: string; data: string }) => {
    if (event.event === "endpoint") return event.data;
    if (!event.data) return "";
    try {
        const parsed = JSON.parse(event.data);
        return String(parsed?.endpoint || "");
    } catch {
        return event.data.startsWith("/") || event.data.startsWith("http")
            ? event.data
            : "";
    }
};

const ensureSseSession = async (server: McpServerConfig) => {
    if (!server.url) return { ok: false as const, error: "Missing server URL." };
    const signature = sseSessionSignature(server);
    const existing = sseSessions.get(server.id);
    if (existing && existing.signature !== signature) {
        closeSseSession(existing);
        sseSessions.delete(server.id);
    }
    const current = sseSessions.get(server.id);
    if (current && !current.closed) {
        try {
            await current.ready;
            return {
                ok: true as const,
                messagesUrl: current.messagesUrl as string,
                sessionId: current.sessionId
            };
        } catch (e: any) {
            closeSseSession(current);
            sseSessions.delete(server.id);
            return { ok: false as const, error: e?.message || "SSE session unavailable." };
        }
    }

    const { ready, resolveReady, rejectReady } = createReadyPair();
    const state: SseSessionState = {
        signature,
        ready,
        resolveReady,
        rejectReady,
        abortController: new AbortController(),
        closed: false,
        pending: new Map()
    };
    sseSessions.set(server.id, state);

    if (server.url.endsWith("/sse")) {
        state.messagesUrl = `${server.url.replace(/\/sse\/?$/, "")}/messages`;
        state.resolveReady();
    }

    try {
        const response = await fetch(server.url, {
            method: "GET",
            headers: {
                accept: "text/event-stream",
                ...(server.headers || {})
            },
            signal: state.abortController.signal
        });
        if (!response.ok || !response.body) {
            state.rejectReady(new Error(`SSE handshake failed (HTTP ${response.status})`));
            return { ok: false as const, error: `SSE handshake failed (HTTP ${response.status})` };
        }
        const reader = response.body.getReader();
        state.reader = reader;
        state.sessionId =
            response.headers.get("mcp-session-id") ||
            response.headers.get("Mcp-Session-Id") ||
            undefined;
        void (async () => {
            const decoder = new TextDecoder();
            let buffer = "";
            const deadline = Date.now() + 7000;
            let hasResolvedByEvent = false;
            while (!state.closed) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const events = parseSseEventBlocks(buffer);
                for (const evt of events) {
                    const endpoint = getEndpointFromEvent(evt);
                    if (endpoint) {
                        state.messagesUrl = resolveEndpointUrl(server.url, endpoint);
                        if (!hasResolvedByEvent) {
                            hasResolvedByEvent = true;
                            state.resolveReady();
                        }
                    }
                    try {
                        const parsed = JSON.parse(evt.data);
                        const responseId = Number(parsed?.id);
                        if (!Number.isFinite(responseId)) {
                            continue;
                        }
                        const pending = state.pending.get(responseId);
                        if (!pending) continue;
                        state.pending.delete(responseId);
                        window.clearTimeout(pending.timer);
                        if (parsed?.error) {
                            pending.reject(new Error(JSON.stringify(parsed.error)));
                        } else {
                            pending.resolve(parsed?.result);
                        }
                    } catch {
                        // Ignore non-JSON events.
                    }
                }
                if (buffer.length > 32000) {
                    buffer = buffer.slice(-8000);
                }
                if (!hasResolvedByEvent && !state.messagesUrl && Date.now() > deadline) {
                    state.rejectReady(new Error("SSE endpoint did not publish a messages endpoint."));
                    break;
                }
            }
            if (!state.messagesUrl && !state.closed) {
                state.rejectReady(new Error("SSE stream closed before endpoint was discovered."));
            }
            if (!state.closed) {
                state.closed = true;
                sseSessions.delete(server.id);
            }
        })();
    } catch (e: any) {
        if (!state.closed) {
            state.rejectReady(new Error(e?.message || "SSE handshake network error."));
        }
    }

    try {
        await state.ready;
        return {
            ok: true as const,
            messagesUrl: state.messagesUrl as string,
            sessionId: state.sessionId
        };
    } catch (e: any) {
        closeSseSession(state);
        sseSessions.delete(server.id);
        return { ok: false as const, error: e?.message || "SSE session unavailable." };
    }
};

const postRpcToUrl = async <T>(
    postUrl: string,
    server: McpServerConfig,
    payload: Record<string, unknown>,
    sessionId?: string,
    allowAcceptedWithoutBody = false
): Promise<JsonRpcResult<T>> => {
    const response = await fetch(postUrl, {
        method: "POST",
        headers: {
            "content-type": "application/json",
            accept: "application/json, text/event-stream",
            ...(server.headers || {}),
            ...(sessionId ? { "mcp-session-id": sessionId } : {})
        },
        body: JSON.stringify(payload)
    });
    const nextSessionId = response.headers.get("mcp-session-id") || response.headers.get("Mcp-Session-Id") || sessionId;
    const raw = await response.text();
    if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status}: ${raw.slice(0, 400)}`, sessionId: nextSessionId || undefined };
    }
    const contentType = response.headers.get("content-type") || "";
    let parsed: any = null;
    try {
        parsed = JSON.parse(raw);
    } catch {
        if (contentType.includes("text/event-stream")) {
            parsed = parseSseJsonRpc(raw);
        }
    }
    if (!parsed) {
        if (allowAcceptedWithoutBody) {
            return { ok: true, result: undefined as T, sessionId: nextSessionId || undefined };
        }
        return { ok: false, error: `Unexpected MCP response: ${raw.slice(0, 400)}`, sessionId: nextSessionId || undefined };
    }
    if (parsed.error) {
        return { ok: false, error: JSON.stringify(parsed.error), sessionId: nextSessionId || undefined };
    }
    return { ok: true, result: parsed.result as T, sessionId: nextSessionId || undefined };
};

const waitForSseRpcResult = <T>(session: SseSessionState, rpcId: number, timeoutMs = 20000) =>
    new Promise<JsonRpcResult<T>>((resolve) => {
        const timer = window.setTimeout(() => {
            session.pending.delete(rpcId);
            resolve({ ok: false, error: `Timed out waiting for SSE response (id=${rpcId}).` });
        }, timeoutMs);
        session.pending.set(rpcId, {
            resolve: (result: any) => resolve({ ok: true, result: result as T, sessionId: session.sessionId }),
            reject: (error: Error) => resolve({ ok: false, error: error.message, sessionId: session.sessionId }),
            timer
        });
    });

const postRpc = async <T>(
    server: McpServerConfig,
    method: string,
    params: Record<string, unknown> = {},
    sessionId?: string
): Promise<JsonRpcResult<T>> => {
    if (!server.url) {
        return { ok: false, error: "This MCP server uses stdio command transport. HTTP URL is required in this extension." };
    }
    try {
        const sseTransport =
            String(server.type || "").toLowerCase() === "sse" ||
            /\/sse\/?$/i.test(server.url);
        const payload = createRpcPayload(method, params);
        if (!sseTransport) {
            return await postRpcToUrl<T>(server.url, server, payload, sessionId);
        }
        const discovered = await ensureSseSession(server);
        if (!discovered.ok) {
            return { ok: false, error: discovered.error };
        }
        const activeSession = sseSessions.get(server.id);
        const rpcId = Number(payload.id);
        const pendingPromise =
            activeSession && Number.isFinite(rpcId)
                ? waitForSseRpcResult<T>(activeSession, rpcId)
                : null;
        const rpcResult = await postRpcToUrl<T>(
            discovered.messagesUrl,
            server,
            payload,
            sessionId || discovered.sessionId,
            true
        );
        if (rpcResult.sessionId) {
            const session = sseSessions.get(server.id);
            if (session) session.sessionId = rpcResult.sessionId;
        }
        if (rpcResult.ok && rpcResult.result === undefined && pendingPromise) {
            return await pendingPromise;
        }
        if (!rpcResult.ok && pendingPromise) {
            const pending = activeSession?.pending.get(rpcId);
            if (pending) {
                window.clearTimeout(pending.timer);
                activeSession?.pending.delete(rpcId);
            }
        }
        return rpcResult;
    } catch (e: any) {
        return { ok: false, error: e?.message || "Network error" };
    }
};

const withInitializedSession = async (
    server: McpServerConfig,
    fn: (sessionId?: string) => Promise<JsonRpcResult<any>>
) => {
    const init = await postRpc(
        server,
        "initialize",
        {
            protocolVersion: "2025-03-26",
            capabilities: {},
            clientInfo: { name: "navai-extension", version: "1.0.0" }
        }
    );
    const sessionId = init.sessionId;
    if (init.ok || sessionId) {
        return fn(sessionId);
    }
    return fn(undefined);
};

export const listMcpTools = async (servers: McpServerConfig[]) => {
    const enabled = servers.filter((s) => s.enabled);
    const output: McpToolDescriptor[] = [];
    for (const server of enabled) {
        const response = await withInitializedSession(server, async (sessionId) =>
            postRpc<{ tools?: any[] }>(server, "tools/list", {}, sessionId)
        );
        if (!response.ok || !response.result) continue;
        const tools = Array.isArray((response.result as any).tools)
            ? (response.result as any).tools
            : [];
        tools.forEach((tool: any) => {
            if (!tool?.name) return;
            output.push({
                serverId: server.id,
                serverName: server.name,
                name: String(tool.name),
                description: typeof tool.description === "string" ? tool.description : undefined,
                inputSchema: tool.inputSchema
            });
        });
    }
    return output;
};

export const callMcpTool = async (
    servers: McpServerConfig[],
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
) => {
    const server = servers.find((s) => s.id === serverId && s.enabled);
    if (!server) return "Failed MCP_CALL: server not found or disabled.";
    const response = await withInitializedSession(server, async (sessionId) =>
        postRpc<any>(server, "tools/call", { name: toolName, arguments: args || {} }, sessionId)
    );
    if (!response.ok) {
        return `Failed MCP_CALL ${toolName} on ${server.name}: ${response.error}`;
    }
    const result = response.result as any;
    if (Array.isArray(result?.content)) {
        const text = result.content
            .map((item: any) => (typeof item?.text === "string" ? item.text : ""))
            .filter(Boolean)
            .join("\n");
        return text || JSON.stringify(result).slice(0, 4000);
    }
    if (typeof result === "string") return result;
    return JSON.stringify(result).slice(0, 4000);
};

export const buildMcpToolCatalogText = (tools: McpToolDescriptor[]) => {
    if (!tools.length) return "MCP TOOLS: none";
    const lines = tools.map((tool, index) => {
        const schema = tool.inputSchema ? ` schema=${JSON.stringify(tool.inputSchema).slice(0, 400)}` : "";
        return `[${index}] serverId=${tool.serverId} server="${tool.serverName}" tool="${tool.name}" desc="${tool.description || ""}"${schema}`;
    });
    return `MCP TOOLS:\n${lines.join("\n")}\nUse action MCP_CALL with serverId + tool + arguments.`;
};

export const testMcpConnection = async (server: McpServerConfig) => {
    if (!server.enabled) {
        return { ok: false, message: "Server is disabled." };
    }
    const response = await withInitializedSession(server, async (sessionId) =>
        postRpc<{ tools?: any[] }>(server, "tools/list", {}, sessionId)
    );
    if (!response.ok) {
        return { ok: false, message: response.error || "Connection failed." };
    }
    const tools = Array.isArray((response.result as any)?.tools)
        ? ((response.result as any).tools as any[])
        : [];
    return { ok: true, message: `Connected. ${tools.length} tool(s) discovered.` };
};
