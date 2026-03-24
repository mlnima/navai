export interface McpServerConfig {
    id: string;
    name: string;
    url: string;
    type?: string;
    enabled: boolean;
    headers?: Record<string, string>;
}

const asStringRecord = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const out: Record<string, string> = {};
    Object.entries(value as Record<string, unknown>).forEach(([k, v]) => {
        if (typeof k === "string" && typeof v === "string") out[k] = v;
    });
    return Object.keys(out).length > 0 ? out : undefined;
};

const normalizeServerFromEntry = (name: string, value: unknown): McpServerConfig | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    const url = String(item.url || "").trim();
    if (!url) return null;
    return {
        id: name,
        name,
        url,
        type: typeof item.type === "string" ? item.type : undefined,
        enabled: item.disabled ? false : true,
        headers: asStringRecord(item.headers)
    };
};

export const parseMcpServersJsonInput = (jsonText: string): McpServerConfig[] => {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error("Invalid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Expected object format: { \"mcpServers\": { ... } }");
    }
    const root = parsed as Record<string, unknown>;
    const map = root.mcpServers;
    if (!map || typeof map !== "object" || Array.isArray(map)) {
        throw new Error("Expected key \"mcpServers\" as object.");
    }
    const servers = Object.entries(map as Record<string, unknown>)
        .map(([name, value]) => normalizeServerFromEntry(name, value))
        .filter((item): item is McpServerConfig => Boolean(item));
    return servers;
};

export const toMcpServersJsonText = (servers: McpServerConfig[]) => {
    const mcpServers: Record<string, Record<string, unknown>> = {};
    servers.forEach((server) => {
        mcpServers[server.name] = {
            url: server.url,
            ...(server.type ? { type: server.type } : {}),
            ...(server.headers ? { headers: server.headers } : {}),
            ...(server.enabled ? {} : { disabled: true })
        };
    });
    return JSON.stringify({ mcpServers }, null, 2);
};
