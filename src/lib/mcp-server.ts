/**
 * KREA MCP Server — ADN GENERAL DEL AGENTE V1.0
 *
 * Exposes KREA's own capabilities as MCP (Model Context Protocol) tools.
 * These are the tools that OTHER agents can call to leverage KREA.
 *
 * Tools exposed:
 *   - krea_generate_image   — AI image generation
 *   - krea_generate_text    — Text/copy generation
 *   - krea_generate_voice   — TTS voice generation
 *   - krea_generate_ebook   — Ebook document generation
 *   - krea_get_metrics      — Campaign metrics & analytics
 *   - krea_doctor           — Health diagnostics
 *   - krea_get_capabilities — List all available capabilities
 *
 * Architecture: MCP is conceptual — the actual HTTP transport is via Next.js API routes.
 * This module provides the tool definitions, schemas, and handlers.
 */

import { db } from "@/lib/db";
import { KreaDoctorV2 } from "@/lib/doctor-v2";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface MCPToolSchema {
  type: "object";
  properties: Record<string, MCPPropertyDef>;
  required?: string[];
}

export interface MCPPropertyDef {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: MCPPropertyDef;
  default?: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  category: string;
  inputSchema: MCPToolSchema;
  outputSchema: MCPToolSchema;
  version: string;
  creditCost: number;
  requiredPlan: string[];
}

export interface MCPToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  evidence: {
    timestamp: string;
    source: string;
    truthLevel: "VERIFIED" | "OBSERVED" | "ESTIMATED" | "UNKNOWN";
    executionId: string;
  };
  creditsUsed: number;
  latencyMs: number;
}

export interface MCPServerStatus {
  name: string;
  version: string;
  status: "online" | "degraded" | "offline";
  toolsCount: number;
  uptime: number;
  lastCheckedAt: string;
}

// ──────────────────────────────────────────────
// Tool Definitions
// ──────────────────────────────────────────────

const TOOLS: MCPTool[] = [
  {
    name: "krea_generate_image",
    description: "Generate an image using AI. Supports various styles and sizes for marketing, product, and creative content.",
    category: "generation",
    version: "1.0.0",
    creditCost: 5,
    requiredPlan: ["starter", "pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Text description of the image to generate" },
        style: { type: "string", description: "Visual style", enum: ["photorealistic", "illustration", "3d", "minimalist", "marketing", "product"] },
        size: { type: "string", description: "Image dimensions", enum: ["1024x1024", "1792x1024", "1024x1792"] },
        userId: { type: "string", description: "User ID requesting generation" },
      },
      required: ["prompt", "userId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the generated image" },
        prompt: { type: "string", description: "The prompt used" },
        creditsUsed: { type: "number", description: "Credits consumed" },
      },
      required: ["url"],
    },
  },
  {
    name: "krea_generate_text",
    description: "Generate marketing copy, ad text, social media posts, or other textual content.",
    category: "generation",
    version: "1.0.0",
    creditCost: 2,
    requiredPlan: ["starter", "pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What text to generate" },
        type: { type: "string", description: "Type of text", enum: ["ad_copy", "social_post", "email", "product_description", "headline", "slogan"] },
        tone: { type: "string", description: "Tone of voice", enum: ["professional", "casual", "luxury", "friendly", "urgent"] },
        language: { type: "string", description: "Output language code (e.g., en, es, pt)" },
        userId: { type: "string", description: "User ID requesting generation" },
      },
      required: ["prompt", "type", "userId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Generated text content" },
        type: { type: "string", description: "Type of text generated" },
        creditsUsed: { type: "number", description: "Credits consumed" },
      },
      required: ["text"],
    },
  },
  {
    name: "krea_generate_voice",
    description: "Convert text to speech audio. Supports multiple voices and languages for voiceovers and audio content.",
    category: "generation",
    version: "1.0.0",
    creditCost: 8,
    requiredPlan: ["pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text to convert to speech" },
        voice: { type: "string", description: "Voice ID or name", enum: ["alloy", "echo", "fable", "onyx", "nova", "shimmer"] },
        language: { type: "string", description: "Language code (e.g., en, es, pt)" },
        speed: { type: "number", description: "Speech speed multiplier (0.5 - 2.0)" },
        userId: { type: "string", description: "User ID requesting generation" },
      },
      required: ["text", "userId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the generated audio file" },
        duration: { type: "number", description: "Duration in seconds" },
        creditsUsed: { type: "number", description: "Credits consumed" },
      },
      required: ["url"],
    },
  },
  {
    name: "krea_generate_ebook",
    description: "Generate a complete ebook document with chapters, formatting, and cover.",
    category: "generation",
    version: "1.0.0",
    creditCost: 15,
    requiredPlan: ["pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Ebook topic or title" },
        chapters: { type: "number", description: "Number of chapters" },
        style: { type: "string", description: "Writing style", enum: ["professional", "educational", "narrative", "technical"] },
        language: { type: "string", description: "Language code" },
        userId: { type: "string", description: "User ID requesting generation" },
      },
      required: ["topic", "userId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL of the generated ebook file" },
        title: { type: "string", description: "Ebook title" },
        pageCount: { type: "number", description: "Approximate page count" },
        creditsUsed: { type: "number", description: "Credits consumed" },
      },
      required: ["url"],
    },
  },
  {
    name: "krea_get_metrics",
    description: "Get campaign performance metrics and analytics data.",
    category: "analytics",
    version: "1.0.0",
    creditCost: 0,
    requiredPlan: ["starter", "pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "User ID to get metrics for" },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)" },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)" },
        granularity: { type: "string", description: "Data granularity", enum: ["daily", "weekly", "monthly"] },
      },
      required: ["userId"],
    },
    outputSchema: {
      type: "object",
      properties: {
        totalRevenue: { type: "number", description: "Total revenue in period" },
        totalInvestment: { type: "number", description: "Total investment in period" },
        totalSales: { type: "number", description: "Total sales in period" },
        roi: { type: "number", description: "Return on investment percentage" },
        entries: { type: "array", description: "Detailed entries", items: { type: "object", description: "Campaign entry data" } },
      },
    },
  },
  {
    name: "krea_doctor",
    description: "Run KREA health diagnostics. Returns comprehensive system health report.",
    category: "system",
    version: "1.0.0",
    creditCost: 0,
    requiredPlan: ["pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        verbose: { type: "boolean", description: "Include detailed check information" },
        authorizeFixes: { type: "boolean", description: "Allow the doctor to apply safe fixes" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        overallStatus: { type: "string", description: "Overall health status" },
        healthScore: { type: "number", description: "Health score 0-100" },
        checks: { type: "array", description: "Individual check results", items: { type: "object", description: "Health check result" } },
        recommendations: { type: "array", description: "List of recommendations", items: { type: "string", description: "Recommendation text" } },
      },
    },
  },
  {
    name: "krea_get_capabilities",
    description: "List all capabilities that KREA offers via MCP. Use this to discover available tools.",
    category: "system",
    version: "1.0.0",
    creditCost: 0,
    requiredPlan: ["starter", "pro", "enterprise"],
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by category", enum: ["generation", "analytics", "system", "all"] },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        tools: { type: "array", description: "List of available tools", items: { type: "object", description: "MCP tool definition" } },
        total: { type: "number", description: "Total tools available" },
      },
    },
  },
];

// ──────────────────────────────────────────────
// KreaMCPServer
// ──────────────────────────────────────────────

export class KreaMCPServer {
  readonly name = "krea-mcp-server";
  readonly version = "1.0.0";
  private startTime = Date.now();

  /**
   * List all available MCP tools.
   */
  listTools(): MCPTool[] {
    return [...TOOLS];
  }

  /**
   * List tools filtered by category.
   */
  listToolsByCategory(category: string): MCPTool[] {
    if (category === "all") return this.listTools();
    return TOOLS.filter((t) => t.category === category);
  }

  /**
   * Get a specific tool definition.
   */
  getTool(name: string): MCPTool | undefined {
    return TOOLS.find((t) => t.name === name);
  }

  /**
   * Handle a tool call — dispatches to the appropriate handler.
   */
  async handleToolCall(toolName: string, params: Record<string, unknown>): Promise<MCPToolResult> {
    const start = Date.now();
    const executionId = crypto.randomUUID();
    const tool = TOOLS.find((t) => t.name === toolName);

    if (!tool) {
      return {
        success: false,
        error: `Unknown tool: ${toolName}. Available: ${TOOLS.map((t) => t.name).join(", ")}`,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-server",
          truthLevel: "VERIFIED",
          executionId,
        },
        creditsUsed: 0,
        latencyMs: Date.now() - start,
      };
    }

    // Validate required input params
    const requiredParams = tool.inputSchema.required || [];
    const missingParams = requiredParams.filter((p) => params[p] === undefined || params[p] === null);
    if (missingParams.length > 0) {
      return {
        success: false,
        error: `Missing required params: ${missingParams.join(", ")}`,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-server",
          truthLevel: "VERIFIED",
          executionId,
        },
        creditsUsed: 0,
        latencyMs: Date.now() - start,
      };
    }

    // Dispatch to handler
    try {
      const result = await this.dispatchToolCall(toolName, params, executionId);
      return {
        success: true,
        data: result,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-server",
          truthLevel: "OBSERVED",
          executionId,
        },
        creditsUsed: tool.creditCost,
        latencyMs: Date.now() - start,
      };
    } catch (e: any) {
      return {
        success: false,
        error: e.message,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-server",
          truthLevel: "OBSERVED",
          executionId,
        },
        creditsUsed: 0,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Internal dispatcher for tool calls.
   */
  private async dispatchToolCall(
    toolName: string,
    params: Record<string, unknown>,
    executionId: string
  ): Promise<unknown> {
    switch (toolName) {
      case "krea_generate_image":
        return this.handleGenerateImage(params, executionId);
      case "krea_generate_text":
        return this.handleGenerateText(params, executionId);
      case "krea_generate_voice":
        return this.handleGenerateVoice(params, executionId);
      case "krea_generate_ebook":
        return this.handleGenerateEbook(params, executionId);
      case "krea_get_metrics":
        return this.handleGetMetrics(params, executionId);
      case "krea_doctor":
        return this.handleDoctor(params, executionId);
      case "krea_get_capabilities":
        return this.handleGetCapabilities(params, executionId);
      default:
        throw new Error(`No handler for tool: ${toolName}`);
    }
  }

  // ──────────────────────────────────────────────
  // Tool Handlers
  // ──────────────────────────────────────────────

  private async handleGenerateImage(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ url: string; prompt: string; style: string; executionId: string }> {
    const prompt = String(params.prompt);
    const style = String(params.style || "photorealistic");
    const size = String(params.size || "1024x1024");

    // Call the actual API route
    const res = await fetch("http://localhost:3000/api/generate/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, style, size, userId: params.userId }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Image generation API returned ${res.status}`);
    }

    const data = await res.json();
    return {
      url: data.url || data.result || "",
      prompt,
      style,
      executionId,
    };
  }

  private async handleGenerateText(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ text: string; type: string; executionId: string }> {
    const prompt = String(params.prompt);
    const type = String(params.type || "ad_copy");

    const res = await fetch("http://localhost:3000/api/generate/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, type, tone: params.tone, language: params.language, userId: params.userId }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`Text generation API returned ${res.status}`);
    }

    const data = await res.json();
    return {
      text: data.text || data.result || "",
      type,
      executionId,
    };
  }

  private async handleGenerateVoice(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ url: string; duration: number; executionId: string }> {
    const text = String(params.text);

    const res = await fetch("http://localhost:3000/api/generate/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: params.voice || "alloy",
        speed: params.speed || 1.0,
        userId: params.userId,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      throw new Error(`Voice generation API returned ${res.status}`);
    }

    const data = await res.json();
    return {
      url: data.url || data.result || "",
      duration: data.duration || 0,
      executionId,
    };
  }

  private async handleGenerateEbook(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ url: string; title: string; pageCount: number; executionId: string }> {
    const topic = String(params.topic);

    const res = await fetch("http://localhost:3000/api/generate/ebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        chapters: params.chapters || 5,
        style: params.style || "professional",
        language: params.language || "en",
        userId: params.userId,
      }),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) {
      throw new Error(`Ebook generation API returned ${res.status}`);
    }

    const data = await res.json();
    return {
      url: data.url || data.result || "",
      title: data.title || topic,
      pageCount: data.pageCount || 0,
      executionId,
    };
  }

  private async handleGetMetrics(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{
    totalRevenue: number;
    totalInvestment: number;
    totalSales: number;
    roi: number;
    entries: unknown[];
    executionId: string;
  }> {
    const userId = String(params.userId);
    const startDate = params.startDate ? String(params.startDate) : undefined;
    const endDate = params.endDate ? String(params.endDate) : undefined;

    const where: Record<string, unknown> = { userId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) (where.date as Record<string, unknown>).gte = startDate;
      if (endDate) (where.date as Record<string, unknown>).lte = endDate;
    }

    const entries = await db.campaignEntry.findMany({ where, orderBy: { date: "desc" } });

    const totalRevenue = entries.reduce((sum, e) => sum + e.revenue, 0);
    const totalInvestment = entries.reduce((sum, e) => sum + e.investment, 0);
    const totalSales = entries.reduce((sum, e) => sum + e.sales, 0);
    const roi = totalInvestment > 0 ? ((totalRevenue - totalInvestment) / totalInvestment) * 100 : 0;

    return {
      totalRevenue,
      totalInvestment,
      totalSales,
      roi: Math.round(roi * 100) / 100,
      entries,
      executionId,
    };
  }

  private async handleDoctor(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ report: unknown; executionId: string }> {
    const doctor = new KreaDoctorV2({
      authorizeFixes: Boolean(params.authorizeFixes),
    });
    const report = await doctor.runFullCheck();
    return { report, executionId };
  }

  private async handleGetCapabilities(
    params: Record<string, unknown>,
    executionId: string
  ): Promise<{ tools: MCPTool[]; total: number; executionId: string }> {
    const category = String(params.category || "all");
    const tools = this.listToolsByCategory(category);
    return { tools, total: tools.length, executionId };
  }

  // ──────────────────────────────────────────────
  // Server Status
  // ──────────────────────────────────────────────

  getStatus(): MCPServerStatus {
    return {
      name: this.name,
      version: this.version,
      status: "online",
      toolsCount: TOOLS.length,
      uptime: Math.round((Date.now() - this.startTime) / 1000),
      lastCheckedAt: new Date().toISOString(),
    };
  }

  /**
   * Health check — verifies all tools are defined and have valid schemas.
   */
  healthCheck(): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const tool of TOOLS) {
      if (!tool.name) issues.push(`Tool missing name`);
      if (!tool.description) issues.push(`Tool ${tool.name} missing description`);
      if (!tool.inputSchema || !tool.inputSchema.properties) {
        issues.push(`Tool ${tool.name} missing inputSchema`);
      }
      if (tool.creditCost < 0) issues.push(`Tool ${tool.name} has negative creditCost`);
    }

    return {
      healthy: issues.length === 0,
      issues,
    };
  }
}
