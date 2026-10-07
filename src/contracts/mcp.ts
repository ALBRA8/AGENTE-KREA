/**
 * MCP Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Model Context Protocol (MCP) support for AGENTE-KREA.
 * MCP allows agents to expose their capabilities as tools/resources
 * and consume capabilities from other agents/servers.
 *
 * Key separation:
 * - KREA OFFERS: What capabilities KREA exposes to other agents
 * - KREA CONSUMES: What capabilities KREA uses from external sources
 *
 * No direct coupling to other agent implementations — all communication
 * goes through the MCP protocol abstraction.
 */

import { randomUUID } from "crypto";

// ─── MCP Common Types ────────────────────────────────────────────────────────

/** MCP protocol version */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/** MCP method names */
export type MCPMethod =
  | "initialize"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get"
  | "completion/complete"
  | "logging/setLevel"
  | "sampling/createMessage";

/** MCP log levels */
export type MCPLogLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

// ─── MCP Server: What KREA Offers ────────────────────────────────────────────

/** A tool that KREA exposes via MCP */
export interface MCPToolOffering {
  /** Tool name (unique within the server) */
  name: string;
  /** Human-readable description */
  description: string;
  /** JSON Schema for input parameters */
  inputSchema: {
    type: "object";
    properties: Record<string, MCPPropertySchema>;
    required?: string[];
  };
  /** JSON Schema for output */
  outputSchema?: {
    type: "object";
    properties: Record<string, MCPPropertySchema>;
  };
  /** Which KREA capability this tool maps to */
  capabilityId: string;
  /** Whether this tool has side effects */
  hasSideEffects: boolean;
  /** Estimated cost in credits */
  estimatedCost: number;
  /** Whether this tool is currently available */
  available: boolean;
}

/** Property schema for MCP tool input/output */
export interface MCPPropertySchema {
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  description?: string;
  enum?: string[];
  default?: unknown;
  items?: MCPPropertySchema;
  properties?: Record<string, MCPPropertySchema>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
}

/** A resource that KREA exposes via MCP */
export interface MCPResourceOffering {
  /** Resource URI (e.g., "krea://generations/recent") */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description */
  description: string;
  /** MIME type */
  mimeType: string;
  /** Whether this resource is subscription-capable */
  subscribable: boolean;
}

/** A prompt template that KREA exposes via MCP */
export interface MCPPromptOffering {
  /** Prompt name */
  name: string;
  /** Description */
  description: string;
  /** Arguments the prompt accepts */
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

/** MCP Server configuration for KREA */
export interface MCPServerConfig {
  /** Server name */
  name: string;
  /** Server version */
  version: string;
  /** Protocol version */
  protocolVersion: string;
  /** Tools offered */
  tools: MCPToolOffering[];
  /** Resources offered */
  resources: MCPResourceOffering[];
  /** Prompts offered */
  prompts: MCPPromptOffering[];
  /** Server capabilities */
  capabilities: {
    tools: boolean;
    resources: boolean;
    prompts: boolean;
    logging: boolean;
    sampling: boolean;
  };
}

// ─── MCP Client: What KREA Consumes ─────────────────────────────────────────

/** A remote MCP server that KREA can connect to */
export interface MCPRemoteServer {
  /** Server identifier */
  serverId: string;
  /** Server name */
  name: string;
  /** Connection endpoint (URL or path) */
  endpoint: string;
  /** Transport type */
  transport: "stdio" | "sse" | "streamable-http" | "websocket";
  /** Protocol version */
  protocolVersion: string;
  /** Whether currently connected */
  connected: boolean;
  /** Available tools from this server */
  remoteTools: MCPRemoteTool[];
  /** Available resources from this server */
  remoteResources: MCPRemoteResource[];
  /** Last connection attempt */
  lastConnectedAt?: string;
  /** Connection error if any */
  lastError?: string;
}

/** A tool available from a remote MCP server */
export interface MCPRemoteTool {
  /** Tool name on the remote server */
  name: string;
  /** Remote server ID */
  serverId: string;
  /** Description */
  description: string;
  /** Input schema */
  inputSchema: {
    type: "object";
    properties: Record<string, MCPPropertySchema>;
    required?: string[];
  };
  /** Whether this tool is available */
  available: boolean;
}

/** A resource available from a remote MCP server */
export interface MCPRemoteResource {
  /** Resource URI */
  uri: string;
  /** Remote server ID */
  serverId: string;
  /** Name */
  name: string;
  /** Description */
  description: string;
  /** MIME type */
  mimeType: string;
}

// ─── MCP Request/Response ────────────────────────────────────────────────────

/** MCP JSON-RPC request */
export interface MCPRequest {
  /** JSON-RPC version */
  jsonrpc: "2.0";
  /** Request ID */
  id: string | number;
  /** Method */
  method: MCPMethod;
  /** Method parameters */
  params?: Record<string, unknown>;
}

/** MCP JSON-RPC response */
export interface MCPResponse {
  /** JSON-RPC version */
  jsonrpc: "2.0";
  /** Request ID (matching the request) */
  id: string | number;
  /** Result (on success) */
  result?: unknown;
  /** Error (on failure) */
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ─── MCP Tool Call Result ────────────────────────────────────────────────────

/** Result of calling an MCP tool */
export interface MCPToolCallResult {
  /** Whether the call succeeded */
  success: boolean;
  /** Tool that was called */
  toolName: string;
  /** Content items (text, images, etc.) */
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    resourceUri?: string;
  }>;
  /** Whether the result indicates an error */
  isError: boolean;
  /** Execution metadata */
  meta?: {
    durationMs: number;
    creditsConsumed: number;
    evidenceIds: string[];
  };
}

// ─── MCP Server Implementation ───────────────────────────────────────────────

/**
 * MCPServer — Exposes KREA's capabilities to other agents via MCP.
 * This is WHAT KREA OFFERS.
 */
export class MCPServer {
  private config: MCPServerConfig;
  private toolHandlers: Map<string, (params: Record<string, unknown>) => Promise<MCPToolCallResult>> = new Map();
  private resourceHandlers: Map<string, () => Promise<unknown>> = new Map();
  private initialized: boolean = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /** Register a handler for a tool */
  registerToolHandler(toolName: string, handler: (params: Record<string, unknown>) => Promise<MCPToolCallResult>): void {
    this.toolHandlers.set(toolName, handler);
  }

  /** Register a handler for a resource */
  registerResourceHandler(uri: string, handler: () => Promise<unknown>): void {
    this.resourceHandlers.set(uri, handler);
  }

  /** Handle an incoming MCP request */
  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    try {
      switch (request.method) {
        case "initialize":
          return this.handleInitialize(request);
        case "tools/list":
          return this.handleToolsList(request);
        case "tools/call":
          return await this.handleToolsCall(request);
        case "resources/list":
          return this.handleResourcesList(request);
        case "resources/read":
          return await this.handleResourcesRead(request);
        case "prompts/list":
          return this.handlePromptsList(request);
        default:
          return {
            jsonrpc: "2.0",
            id: request.id,
            error: { code: -32601, message: `Method not found: ${request.method}` },
          };
      }
    } catch (error) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : "Internal error",
        },
      };
    }
  }

  /** Get the server config */
  getConfig(): MCPServerConfig {
    return this.config;
  }

  /** Get available tools */
  getAvailableTools(): MCPToolOffering[] {
    return this.config.tools.filter((t) => t.available);
  }

  /** Get available resources */
  getAvailableResources(): MCPResourceOffering[] {
    return this.config.resources;
  }

  // ── Private Handlers ──────────────────────────────────────────────────

  private handleInitialize(request: MCPRequest): MCPResponse {
    this.initialized = true;
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        protocolVersion: this.config.protocolVersion,
        capabilities: this.config.capabilities,
        serverInfo: {
          name: this.config.name,
          version: this.config.version,
        },
      },
    };
  }

  private handleToolsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        tools: this.config.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      },
    };
  }

  private async handleToolsCall(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params || {};
    const toolName = params.name as string;
    const toolArgs = (params.arguments as Record<string, unknown>) || {};

    const tool = this.config.tools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: `Unknown tool: ${toolName}` },
      };
    }

    if (!tool.available) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: `Tool not available: ${toolName}` },
      };
    }

    const handler = this.toolHandlers.get(toolName);
    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: `No handler for tool: ${toolName}` },
      };
    }

    const result = await handler(toolArgs);
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        content: result.content,
        isError: result.isError,
      },
    };
  }

  private handleResourcesList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        resources: this.config.resources.map((res) => ({
          uri: res.uri,
          name: res.name,
          description: res.description,
          mimeType: res.mimeType,
        })),
      },
    };
  }

  private async handleResourcesRead(request: MCPRequest): Promise<MCPResponse> {
    const params = request.params || {};
    const uri = params.uri as string;

    const resource = this.config.resources.find((r) => r.uri === uri);
    if (!resource) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32602, message: `Unknown resource: ${uri}` },
      };
    }

    const handler = this.resourceHandlers.get(uri);
    if (!handler) {
      return {
        jsonrpc: "2.0",
        id: request.id,
        error: { code: -32603, message: `No handler for resource: ${uri}` },
      };
    }

    const contents = await handler();
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        contents: [
          {
            uri,
            mimeType: resource.mimeType,
            text: typeof contents === "string" ? contents : JSON.stringify(contents),
          },
        ],
      },
    };
  }

  private handlePromptsList(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: "2.0",
      id: request.id,
      result: {
        prompts: this.config.prompts.map((prompt) => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments,
        })),
      },
    };
  }
}

// ─── MCP Client Implementation ──────────────────────────────────────────────

/**
 * MCPClient — Consumes capabilities from external MCP servers.
 * This is WHAT KREA CONSUMES.
 */
export class MCPClient {
  private remoteServers: Map<string, MCPRemoteServer> = new Map();
  private callLog: Array<{
    timestamp: string;
    serverId: string;
    toolName: string;
    success: boolean;
    durationMs: number;
  }> = [];

  /** Register a remote MCP server */
  registerRemoteServer(server: MCPRemoteServer): void {
    this.remoteServers.set(server.serverId, server);
  }

  /** Remove a remote MCP server */
  removeRemoteServer(serverId: string): void {
    this.remoteServers.delete(serverId);
  }

  /** Get all remote servers */
  getRemoteServers(): MCPRemoteServer[] {
    return Array.from(this.remoteServers.values());
  }

  /** Get a remote server by ID */
  getRemoteServer(serverId: string): MCPRemoteServer | undefined {
    return this.remoteServers.get(serverId);
  }

  /** Find a remote tool by name across all servers */
  findRemoteTool(toolName: string): MCPRemoteTool | undefined {
    for (const server of Array.from(this.remoteServers.values())) {
      const tool = server.remoteTools.find((t) => t.name === toolName && t.available);
      if (tool) return tool;
    }
    return undefined;
  }

  /** Find all tools matching a capability across all servers */
  findToolsByCapability(capability: string): MCPRemoteTool[] {
    const results: MCPRemoteTool[] = [];
    for (const server of Array.from(this.remoteServers.values())) {
      if (!server.connected) continue;
      for (const tool of server.remoteTools) {
        if (tool.available && tool.description.toLowerCase().includes(capability.toLowerCase())) {
          results.push(tool);
        }
      }
    }
    return results;
  }

  /**
   * Call a tool on a remote MCP server.
   * This is a stub — the actual transport (HTTP, SSE, etc.) must be provided.
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>,
    transport?: (request: MCPRequest) => Promise<MCPResponse>,
  ): Promise<MCPToolCallResult> {
    const server = this.remoteServers.get(serverId);
    const startTime = Date.now();

    if (!server) {
      return {
        success: false,
        toolName,
        content: [{ type: "text", text: `Unknown server: ${serverId}` }],
        isError: true,
      };
    }

    if (!server.connected) {
      return {
        success: false,
        toolName,
        content: [{ type: "text", text: `Server ${serverId} is not connected` }],
        isError: true,
      };
    }

    if (!transport) {
      return {
        success: false,
        toolName,
        content: [{ type: "text", text: `No transport configured for server ${serverId}` }],
        isError: true,
      };
    }

    try {
      const request: MCPRequest = {
        jsonrpc: "2.0",
        id: randomUUID(),
        method: "tools/call",
        params: { name: toolName, arguments: args },
      };

      const response = await transport(request);
      const durationMs = Date.now() - startTime;

      if (response.error) {
        this.callLog.push({
          timestamp: new Date().toISOString(),
          serverId,
          toolName,
          success: false,
          durationMs,
        });

        return {
          success: false,
          toolName,
          content: [{ type: "text", text: response.error.message }],
          isError: true,
          meta: { durationMs, creditsConsumed: 0, evidenceIds: [] },
        };
      }

      const result = response.result as { content?: MCPToolCallResult["content"]; isError?: boolean };

      this.callLog.push({
        timestamp: new Date().toISOString(),
        serverId,
        toolName,
        success: true,
        durationMs,
      });

      return {
        success: true,
        toolName,
        content: result.content || [{ type: "text", text: "No content returned" }],
        isError: result.isError || false,
        meta: { durationMs, creditsConsumed: 0, evidenceIds: [] },
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      this.callLog.push({
        timestamp: new Date().toISOString(),
        serverId,
        toolName,
        success: false,
        durationMs,
      });

      return {
        success: false,
        toolName,
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
        meta: { durationMs, creditsConsumed: 0, evidenceIds: [] },
      };
    }
  }

  /** Get call log */
  getCallLog(limit?: number): Array<{ timestamp: string; serverId: string; toolName: string; success: boolean; durationMs: number }> {
    const log = [...this.callLog];
    return limit ? log.slice(-limit) : log;
  }

  /** Get client stats */
  getStats(): {
    totalCalls: number;
    successful: number;
    failed: number;
    connectedServers: number;
    totalRemoteTools: number;
  } {
    const totalCalls = this.callLog.length;
    const successful = this.callLog.filter((c) => c.success).length;
    const servers = Array.from(this.remoteServers.values());
    const connectedServers = servers.filter((s) => s.connected).length;
    const totalRemoteTools = servers.reduce((sum, s) => sum + s.remoteTools.length, 0);

    return {
      totalCalls,
      successful,
      failed: totalCalls - successful,
      connectedServers,
      totalRemoteTools,
    };
  }
}

// ─── KREA MCP Server Configuration ───────────────────────────────────────────

/**
 * MCP Server configuration for AGENTE-KREA — WHAT KREA OFFERS.
 */
export const KREA_MCP_SERVER_CONFIG: MCPServerConfig = {
  name: "agente-krea",
  version: "1.0.0",
  protocolVersion: MCP_PROTOCOL_VERSION,
  tools: [
    {
      name: "generate_image",
      description: "Generate an image from a text prompt using AI",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Image generation prompt", minLength: 1 },
          size: { type: "string", description: "Image size", enum: ["512x512", "1024x1024", "1536x1024", "1024x1536"], default: "1024x1024" },
        },
        required: ["prompt"],
      },
      outputSchema: {
        type: "object",
        properties: {
          imageUrl: { type: "string", description: "URL of the generated image" },
          base64: { type: "string", description: "Base64-encoded image data" },
        },
      },
      capabilityId: "image_generation",
      hasSideEffects: true,
      estimatedCost: 3,
      available: true,
    },
    {
      name: "generate_text",
      description: "Generate creative text content (copy, scripts, subtitles, etc.)",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Text generation prompt", minLength: 1 },
          type: { type: "string", description: "Content type", enum: ["copy", "social", "email", "script", "subtitle"] },
          tone: { type: "string", description: "Desired tone of voice" },
        },
        required: ["prompt", "type"],
      },
      outputSchema: {
        type: "object",
        properties: {
          content: { type: "string", description: "Generated text content" },
        },
      },
      capabilityId: "text_generation",
      hasSideEffects: false,
      estimatedCost: 0,
      available: true,
    },
    {
      name: "generate_voice",
      description: "Generate speech from text using TTS",
      inputSchema: {
        type: "object",
        properties: {
          text: { type: "string", description: "Text to convert to speech", minLength: 1 },
          voice: { type: "string", description: "Voice to use", enum: ["tongtong", "xiaoyi", "zhiyan", "zhichu"], default: "tongtong" },
        },
        required: ["text"],
      },
      outputSchema: {
        type: "object",
        properties: {
          audioUrl: { type: "string", description: "URL of the generated audio" },
        },
      },
      capabilityId: "voice_generation",
      hasSideEffects: true,
      estimatedCost: 3,
      available: true,
    },
    {
      name: "generate_prompt",
      description: "Generate an optimized AI prompt from user intent",
      inputSchema: {
        type: "object",
        properties: {
          intent: { type: "string", description: "Raw user intent", minLength: 1 },
          style: { type: "string", description: "Visual style preference" },
          type: { type: "string", description: "Generation type", enum: ["image", "video", "animation", "cloning"] },
        },
        required: ["intent", "type"],
      },
      outputSchema: {
        type: "object",
        properties: {
          optimizedPrompt: { type: "string", description: "AI-optimized prompt" },
          negativePrompt: { type: "string", description: "Negative prompt" },
        },
      },
      capabilityId: "prompt_generation",
      hasSideEffects: false,
      estimatedCost: 0,
      available: true,
    },
    {
      name: "generate_ebook",
      description: "Generate a complete eBook in Markdown format",
      inputSchema: {
        type: "object",
        properties: {
          topic: { type: "string", description: "eBook topic", minLength: 1 },
          chapters: { type: "number", description: "Number of chapters", minimum: 1, maximum: 20, default: 5 },
        },
        required: ["topic"],
      },
      outputSchema: {
        type: "object",
        properties: {
          markdown: { type: "string", description: "Complete eBook in Markdown" },
        },
      },
      capabilityId: "ebook_generation",
      hasSideEffects: false,
      estimatedCost: 0,
      available: true,
    },
    {
      name: "get_campaign_metrics",
      description: "Get computed campaign metrics (ROAS, profit, status)",
      inputSchema: {
        type: "object",
        properties: {
          userId: { type: "string", description: "User ID" },
          dateFrom: { type: "string", description: "Start date (YYYY-MM-DD)" },
          dateTo: { type: "string", description: "End date (YYYY-MM-DD)" },
        },
        required: ["userId"],
      },
      outputSchema: {
        type: "object",
        properties: {
          metrics: { type: "object", description: "Campaign metrics object" },
        },
      },
      capabilityId: "campaign_metrics",
      hasSideEffects: false,
      estimatedCost: 0,
      available: true,
    },
  ],
  resources: [
    {
      uri: "krea://generations/recent",
      name: "Recent Generations",
      description: "List of recent generations across all types",
      mimeType: "application/json",
      subscribable: true,
    },
    {
      uri: "krea://campaign/metrics",
      name: "Campaign Metrics",
      description: "Current campaign performance metrics",
      mimeType: "application/json",
      subscribable: true,
    },
    {
      uri: "krea://agent/health",
      name: "Agent Health",
      description: "Current health status of the agent",
      mimeType: "application/json",
      subscribable: false,
    },
  ],
  prompts: [
    {
      name: "creative_brief",
      description: "Generate a creative brief for a campaign or project",
      arguments: [
        { name: "projectName", description: "Name of the project", required: true },
        { name: "targetAudience", description: "Target audience description", required: true },
        { name: "objective", description: "Campaign objective", required: false },
      ],
    },
    {
      name: "visual_concept",
      description: "Generate visual concept descriptions for a theme",
      arguments: [
        { name: "theme", description: "Visual theme or subject", required: true },
        { name: "style", description: "Desired visual style", required: false },
      ],
    },
  ],
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
    logging: true,
    sampling: false,
  },
};

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Create the MCP Server for AGENTE-KREA.
 * This exposes KREA's capabilities to other agents.
 */
export function createKreaMCPServer(): MCPServer {
  return new MCPServer(KREA_MCP_SERVER_CONFIG);
}

/**
 * Create the MCP Client for AGENTE-KREA.
 * This allows KREA to consume capabilities from external MCP servers.
 */
export function createKreaMCPClient(): MCPClient {
  const client = new MCPClient();

  // Register known ALBRA ecosystem servers as MCP remotes
  // These are placeholder entries — actual connections would be configured at runtime
  client.registerRemoteServer({
    serverId: "nex-scope-mcp",
    name: "NEX-SCOPE MCP Server",
    endpoint: "mcp://nex-scope",
    transport: "streamable-http",
    protocolVersion: MCP_PROTOCOL_VERSION,
    connected: false,
    remoteTools: [
      {
        name: "research_topic",
        serverId: "nex-scope-mcp",
        description: "Research a topic and return analysis",
        inputSchema: {
          type: "object",
          properties: {
            topic: { type: "string", description: "Topic to research" },
            depth: { type: "string", description: "Research depth", enum: ["brief", "standard", "deep"] },
          },
          required: ["topic"],
        },
        available: false,
      },
    ],
    remoteResources: [],
  });

  client.registerRemoteServer({
    serverId: "chismoso-mcp",
    name: "CHISMOSO MCP Server",
    endpoint: "mcp://chismoso",
    transport: "streamable-http",
    protocolVersion: MCP_PROTOCOL_VERSION,
    connected: false,
    remoteTools: [
      {
        name: "detect_trends",
        serverId: "chismoso-mcp",
        description: "Detect current trends and signals",
        inputSchema: {
          type: "object",
          properties: {
            category: { type: "string", description: "Category to analyze" },
            region: { type: "string", description: "Geographic region" },
          },
          required: ["category"],
        },
        available: false,
      },
    ],
    remoteResources: [],
  });

  return client;
}
