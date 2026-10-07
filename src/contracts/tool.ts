/**
 * Tool Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the tools the agent uses: their identity, purpose, schemas,
 * permissions, risk, side effects, and execution tracking.
 *
 * Tools are the lowest-level primitives that capabilities compose.
 * Each tool execution produces evidence for the provenance chain.
 */

import { randomUUID } from "crypto";

// ─── Tool Identity ───────────────────────────────────────────────────────────

/** Tool category */
export type ToolCategory =
  | "sdk"            // External SDK wrapper (e.g., z-ai-web-dev-sdk)
  | "database"       // Database operations
  | "filesystem"     // File system operations
  | "network"        // Network/HTTP operations
  | "computation"    // Pure computation/transformation
  | "external_api"   // External API calls
  | "system";        // System-level operations

/** Risk level of a tool */
export type ToolRiskLevel = "none" | "low" | "medium" | "high" | "critical";

/** Side effect classification */
export type SideEffect =
  | "none"           // No side effects (pure function)
  | "writes_file"    // Writes to filesystem
  | "writes_db"      // Writes to database
  | "external_call"  // Makes external API/network calls
  | "consumes_credits" // Consumes user credits
  | "sends_data"     // Sends data externally
  | "modifies_state";  // Modifies application state

// ─── Schema Definitions ──────────────────────────────────────────────────────

/** JSON Schema-like type for input/output validation */
export interface SchemaProperty {
  /** Property name */
  name: string;
  /** Property type */
  type: "string" | "number" | "boolean" | "object" | "array" | "null";
  /** Whether this property is required */
  required: boolean;
  /** Human-readable description */
  description: string;
  /** Default value */
  default?: unknown;
  /** Enum values if applicable */
  enum?: string[];
  /** Nested properties for object type */
  properties?: SchemaProperty[];
  /** Items schema for array type */
  items?: SchemaProperty;
  /** Minimum value for number type */
  minimum?: number;
  /** Maximum value for number type */
  maximum?: number;
  /** Min length for string type */
  minLength?: number;
  /** Max length for string type */
  maxLength?: number;
}

/** Full schema definition for tool inputs or outputs */
export interface ToolSchema {
  /** Schema type */
  type: "object";
  /** Properties of the schema */
  properties: SchemaProperty[];
  /** Additional properties allowed */
  additionalProperties: boolean;
}

// ─── Retry Policy ────────────────────────────────────────────────────────────

/** Retry policy for tool execution */
export interface ToolRetryPolicy {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in ms */
  delayMs: number;
  /** Whether to use exponential backoff */
  backoff: boolean;
  /** Maximum total retry duration in ms */
  maxTotalDelayMs: number;
  /** HTTP status codes that should trigger a retry */
  retryOnStatuses?: number[];
}

// ─── Tool Evidence ───────────────────────────────────────────────────────────

/** Evidence produced by a tool execution */
export interface ToolEvidence {
  /** Evidence ID */
  evidenceId: string;
  /** Tool that produced this evidence */
  toolId: string;
  /** Execution ID this evidence belongs to */
  executionId: string;
  /** Timestamp of evidence creation */
  timestamp: string;
  /** What was observed/verified */
  observation: string;
  /** Confidence level (0-1) */
  confidence: number;
  /** Truth level of this evidence */
  truthLevel: "OBSERVED" | "VERIFIED" | "ESTIMATED" | "MODELED" | "INFERRED" | "UNKNOWN";
  /** Source of the evidence (e.g., "z-ai-web-dev-sdk response") */
  source: string;
  /** Raw data that supports this evidence */
  rawData?: unknown;
}

// ─── Tool Audit ──────────────────────────────────────────────────────────────

/** Audit record for a tool execution */
export interface ToolAuditRecord {
  /** Audit record ID */
  auditId: string;
  /** Tool ID */
  toolId: string;
  /** Execution ID */
  executionId: string;
  /** Who initiated the execution */
  initiatedBy: string;
  /** When execution started */
  startedAt: string;
  /** When execution ended */
  endedAt: string;
  /** Execution duration in ms */
  durationMs: number;
  /** Whether execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Side effects that occurred */
  sideEffectsObserved: SideEffect[];
  /** Evidence produced */
  evidenceIds: string[];
  /** Credits consumed */
  creditsConsumed: number;
  /** Inputs (redacted if sensitive) */
  inputsRedacted: boolean;
  /** Outputs (redacted if large) */
  outputsRedacted: boolean;
}

// ─── Tool Definition ─────────────────────────────────────────────────────────

/**
 * Full definition of a tool that the agent can use.
 * Tools are the atomic primitives; capabilities compose tools.
 */
export interface ToolDefinition {
  // ── Identity ──────────────────────────────────────────────────────────
  /** Unique tool identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Purpose — why this tool exists */
  purpose: string;
  /** Tool category */
  category: ToolCategory;

  // ── Interface ─────────────────────────────────────────────────────────
  /** Input schema */
  inputSchema: ToolSchema;
  /** Output schema */
  outputSchema: ToolSchema;

  // ── Security ──────────────────────────────────────────────────────────
  /** Permissions required to execute this tool */
  permissions: string[];
  /** Risk level */
  risk: ToolRiskLevel;
  /** Possible side effects */
  sideEffects: SideEffect[];
  /** Whether this tool handles sensitive data */
  handlesSensitiveData: boolean;

  // ── Provider ──────────────────────────────────────────────────────────
  /** External provider if applicable */
  provider?: string;
  /** Provider method name */
  providerMethod?: string;

  // ── Execution ─────────────────────────────────────────────────────────
  /** Timeout in ms */
  timeoutMs: number;
  /** Retry policy */
  retryPolicy: ToolRetryPolicy;
  /** Whether this tool is idempotent */
  idempotent: boolean;
  /** Whether this tool is currently available */
  available: boolean;
}

// ─── Tool Execution Result ───────────────────────────────────────────────────

/** Result of executing a tool */
export interface ToolExecutionResult {
  /** Execution ID */
  executionId: string;
  /** Tool ID */
  toolId: string;
  /** Whether execution succeeded */
  success: boolean;
  /** Output data */
  output: unknown;
  /** Error message if failed */
  error?: string;
  /** Evidence produced */
  evidence: ToolEvidence[];
  /** Audit record */
  audit: ToolAuditRecord;
  /** Execution duration in ms */
  durationMs: number;
  /** Credits consumed */
  creditsConsumed: number;
}

// ─── Tool Registry ───────────────────────────────────────────────────────────

/**
 * ToolRegistry — Central registry for all tools available to the agent.
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  /** Register a tool */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  /** Register multiple tools */
  registerAll(tools: ToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /** Get a tool by ID */
  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  /** Get all registered tools */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Check if a tool exists */
  has(id: string): boolean {
    return this.tools.has(id);
  }

  /** Get tools by category */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /** Get tools with a specific side effect */
  getWithSideEffect(effect: SideEffect): ToolDefinition[] {
    return this.getAll().filter((t) => t.sideEffects.includes(effect));
  }

  /** Get tools that require a specific permission */
  getRequiringPermission(permission: string): ToolDefinition[] {
    return this.getAll().filter((t) => t.permissions.includes(permission));
  }

  /** Get tools above a risk level */
  getAboveRiskLevel(risk: ToolRiskLevel): ToolDefinition[] {
    const order: Record<ToolRiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
    return this.getAll().filter((t) => order[t.risk] > order[risk]);
  }

  /** Get all currently available tools */
  getAvailable(): ToolDefinition[] {
    return this.getAll().filter((t) => t.available);
  }
}

// ─── Tool Executor ───────────────────────────────────────────────────────────

/** Function type for tool execution */
export type ToolExecutorFn = (inputs: Record<string, unknown>) => Promise<unknown>;

/**
 * ToolExecutor — Executes tools with full evidence tracking and auditing.
 * Wraps each execution with timing, evidence capture, and audit logging.
 */
export class ToolExecutor {
  private registry: ToolRegistry;
  private executors: Map<string, ToolExecutorFn> = new Map();
  private auditLog: ToolAuditRecord[] = [];

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /** Register an executor function for a tool */
  registerExecutor(toolId: string, executor: ToolExecutorFn): void {
    this.executors.set(toolId, executor);
  }

  /**
   * Execute a tool with full tracking.
   * Produces evidence and audit records for every execution.
   */
  async execute(
    toolId: string,
    inputs: Record<string, unknown>,
    initiatedBy: string,
    executionId?: string,
  ): Promise<ToolExecutionResult> {
    const execId = executionId || randomUUID();
    const tool = this.registry.get(toolId);

    if (!tool) {
      return this.createFailedResult(execId, toolId, 0, 0, `Tool not found: ${toolId}`, initiatedBy);
    }

    if (!tool.available) {
      return this.createFailedResult(execId, toolId, 0, 0, `Tool not available: ${toolId}`, initiatedBy);
    }

    const executor = this.executors.get(toolId);
    if (!executor) {
      return this.createFailedResult(execId, toolId, 0, 0, `No executor registered for tool: ${toolId}`, initiatedBy);
    }

    const startedAt = new Date().toISOString();
    const startTime = Date.now();
    const evidence: ToolEvidence[] = [];

    try {
      // Execute with timeout
      const output = await this.executeWithTimeout(executor, inputs, tool.timeoutMs);
      const durationMs = Date.now() - startTime;
      const endedAt = new Date().toISOString();

      // Create evidence
      evidence.push({
        evidenceId: randomUUID(),
        toolId,
        executionId: execId,
        timestamp: endedAt,
        observation: `Tool ${toolId} executed successfully`,
        confidence: 1.0,
        truthLevel: "OBSERVED",
        source: `tool:${toolId}`,
      });

      // Create audit record
      const audit: ToolAuditRecord = {
        auditId: randomUUID(),
        toolId,
        executionId: execId,
        initiatedBy,
        startedAt,
        endedAt,
        durationMs,
        success: true,
        sideEffectsObserved: tool.sideEffects,
        evidenceIds: evidence.map((e) => e.evidenceId),
        creditsConsumed: tool.sideEffects.includes("consumes_credits") ? 1 : 0,
        inputsRedacted: tool.handlesSensitiveData,
        outputsRedacted: false,
      };

      this.auditLog.push(audit);

      return {
        executionId: execId,
        toolId,
        success: true,
        output,
        evidence,
        audit,
        durationMs,
        creditsConsumed: audit.creditsConsumed,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const endedAt = new Date().toISOString();
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Create failed evidence
      evidence.push({
        evidenceId: randomUUID(),
        toolId,
        executionId: execId,
        timestamp: endedAt,
        observation: `Tool ${toolId} execution failed: ${errorMessage}`,
        confidence: 0,
        truthLevel: "OBSERVED",
        source: `tool:${toolId}`,
      });

      // Create audit record for failure
      const audit: ToolAuditRecord = {
        auditId: randomUUID(),
        toolId,
        executionId: execId,
        initiatedBy,
        startedAt,
        endedAt,
        durationMs,
        success: false,
        error: errorMessage,
        sideEffectsObserved: [],
        evidenceIds: evidence.map((e) => e.evidenceId),
        creditsConsumed: 0,
        inputsRedacted: tool.handlesSensitiveData,
        outputsRedacted: true,
      };

      this.auditLog.push(audit);

      return {
        executionId: execId,
        toolId,
        success: false,
        output: null,
        error: errorMessage,
        evidence,
        audit,
        durationMs,
        creditsConsumed: 0,
      };
    }
  }

  /** Get the audit log */
  getAuditLog(): ToolAuditRecord[] {
    return [...this.auditLog];
  }

  /** Get audit records for a specific execution */
  getAuditByExecution(executionId: string): ToolAuditRecord[] {
    return this.auditLog.filter((a) => a.executionId === executionId);
  }

  /** Clear old audit records (keep last N) */
  pruneAuditLog(keepLast: number): void {
    if (this.auditLog.length > keepLast) {
      this.auditLog = this.auditLog.slice(-keepLast);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────

  private async executeWithTimeout(
    executor: ToolExecutorFn,
    inputs: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    return Promise.race([
      executor(inputs),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private createFailedResult(
    executionId: string,
    toolId: string,
    durationMs: number,
    creditsConsumed: number,
    error: string,
    initiatedBy: string,
  ): ToolExecutionResult {
    const now = new Date().toISOString();
    const audit: ToolAuditRecord = {
      auditId: randomUUID(),
      toolId,
      executionId,
      initiatedBy,
      startedAt: now,
      endedAt: now,
      durationMs,
      success: false,
      error,
      sideEffectsObserved: [],
      evidenceIds: [],
      creditsConsumed,
      inputsRedacted: false,
      outputsRedacted: true,
    };

    this.auditLog.push(audit);

    return {
      executionId,
      toolId,
      success: false,
      output: null,
      error,
      evidence: [],
      audit,
      durationMs,
      creditsConsumed,
    };
  }
}

// ─── KREA Tool Definitions ──────────────────────────────────────────────────

const DEFAULT_TOOL_RETRY: ToolRetryPolicy = {
  maxRetries: 2,
  delayMs: 1000,
  backoff: true,
  maxTotalDelayMs: 30000,
};

/**
 * All tool definitions for AGENTE-KREA.
 */
export const KREA_TOOLS: ToolDefinition[] = [
  {
    id: "zai_chat",
    name: "ZAI Chat Completions",
    description: "Generate text completions using Z-AI SDK chat API",
    purpose: "Provide LLM-based text generation for prompts, copy, ebooks, and subtitles",
    category: "sdk",
    inputSchema: {
      type: "object",
      properties: [
        { name: "messages", type: "array", required: true, description: "Chat messages array with role and content" },
        { name: "model", type: "string", required: false, description: "Model to use", default: "zai-chat" },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "content", type: "string", required: true, description: "Generated text content" },
      ],
      additionalProperties: false,
    },
    permissions: ["api_access"],
    risk: "low",
    sideEffects: ["external_call"],
    handlesSensitiveData: false,
    provider: "z-ai-web-dev-sdk",
    providerMethod: "chat.completions.create",
    timeoutMs: 30000,
    retryPolicy: DEFAULT_TOOL_RETRY,
    idempotent: false,
    available: true,
  },
  {
    id: "zai_image",
    name: "ZAI Image Generation",
    description: "Generate images using Z-AI SDK image API with Flux model",
    purpose: "Provide AI-powered image generation from text prompts",
    category: "sdk",
    inputSchema: {
      type: "object",
      properties: [
        { name: "prompt", type: "string", required: true, description: "Image generation prompt", minLength: 1 },
        { name: "size", type: "string", required: false, description: "Image size", default: "1024x1024", enum: ["512x512", "1024x1024", "1536x1024", "1024x1536"] },
        { name: "model", type: "string", required: false, description: "Model name", default: "flux-krea-v2" },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "base64", type: "string", required: true, description: "Base64-encoded image data" },
      ],
      additionalProperties: false,
    },
    permissions: ["api_access"],
    risk: "low",
    sideEffects: ["external_call", "consumes_credits"],
    handlesSensitiveData: false,
    provider: "z-ai-web-dev-sdk",
    providerMethod: "images.generations.create",
    timeoutMs: 60000,
    retryPolicy: DEFAULT_TOOL_RETRY,
    idempotent: false,
    available: true,
  },
  {
    id: "zai_tts",
    name: "ZAI Text-to-Speech",
    description: "Generate speech audio using Z-AI SDK TTS API",
    purpose: "Convert text to natural-sounding speech audio",
    category: "sdk",
    inputSchema: {
      type: "object",
      properties: [
        { name: "text", type: "string", required: true, description: "Text to convert to speech", minLength: 1 },
        { name: "voice", type: "string", required: false, description: "Voice to use", default: "tongtong", enum: ["tongtong", "xiaoyi", "zhiyan", "zhichu"] },
        { name: "model", type: "string", required: false, description: "TTS model", default: "krea-tts-v1" },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "audioBuffer", type: "object", required: true, description: "Audio data as ArrayBuffer" },
      ],
      additionalProperties: false,
    },
    permissions: ["api_access"],
    risk: "low",
    sideEffects: ["external_call", "consumes_credits"],
    handlesSensitiveData: false,
    provider: "z-ai-web-dev-sdk",
    providerMethod: "audio.tts.create",
    timeoutMs: 60000,
    retryPolicy: DEFAULT_TOOL_RETRY,
    idempotent: false,
    available: true,
  },
  {
    id: "db_read",
    name: "Database Read",
    description: "Read data from SQLite via Prisma ORM",
    purpose: "Query the database for user data, generations, and campaign metrics",
    category: "database",
    inputSchema: {
      type: "object",
      properties: [
        { name: "model", type: "string", required: true, description: "Prisma model name", enum: ["User", "Generation", "CampaignEntry"] },
        { name: "operation", type: "string", required: true, description: "Read operation", enum: ["findUnique", "findMany", "count", "aggregate"] },
        { name: "where", type: "object", required: false, description: "Prisma where clause" },
      ],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "data", type: "object", required: true, description: "Query result" },
      ],
      additionalProperties: true,
    },
    permissions: ["db_read"],
    risk: "none",
    sideEffects: ["none"],
    handlesSensitiveData: true,
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 1, delayMs: 200, backoff: false, maxTotalDelayMs: 1000 },
    idempotent: true,
    available: true,
  },
  {
    id: "db_write",
    name: "Database Write",
    description: "Write data to SQLite via Prisma ORM",
    purpose: "Create and update records for generations, campaign entries, and user data",
    category: "database",
    inputSchema: {
      type: "object",
      properties: [
        { name: "model", type: "string", required: true, description: "Prisma model name", enum: ["User", "Generation", "CampaignEntry"] },
        { name: "operation", type: "string", required: true, description: "Write operation", enum: ["create", "update", "delete"] },
        { name: "data", type: "object", required: true, description: "Data to write" },
        { name: "where", type: "object", required: false, description: "Prisma where clause for update/delete" },
      ],
      additionalProperties: true,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "data", type: "object", required: true, description: "Write result" },
      ],
      additionalProperties: true,
    },
    permissions: ["db_write"],
    risk: "medium",
    sideEffects: ["writes_db"],
    handlesSensitiveData: true,
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 2, delayMs: 500, backoff: true, maxTotalDelayMs: 5000 },
    idempotent: false,
    available: true,
  },
  {
    id: "fs_write",
    name: "Filesystem Write",
    description: "Write generated files to the public/generated/ directory",
    purpose: "Persist generated assets (images, audio) to disk for serving",
    category: "filesystem",
    inputSchema: {
      type: "object",
      properties: [
        { name: "filename", type: "string", required: true, description: "Filename to write" },
        { name: "data", type: "object", required: true, description: "Data to write (Buffer or string)" },
        { name: "encoding", type: "string", required: false, description: "Encoding", default: "binary" },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "path", type: "string", required: true, description: "Full path of written file" },
        { name: "size", type: "number", required: true, description: "File size in bytes" },
      ],
      additionalProperties: false,
    },
    permissions: ["storage_write"],
    risk: "low",
    sideEffects: ["writes_file"],
    handlesSensitiveData: false,
    timeoutMs: 10000,
    retryPolicy: { maxRetries: 1, delayMs: 500, backoff: false, maxTotalDelayMs: 2000 },
    idempotent: true,
    available: true,
  },
  {
    id: "credit_deduct",
    name: "Credit Deduction",
    description: "Atomically deduct credits from a user account",
    purpose: "Consume credits for generation operations with race-condition protection",
    category: "computation",
    inputSchema: {
      type: "object",
      properties: [
        { name: "userId", type: "string", required: true, description: "User ID" },
        { name: "amount", type: "number", required: true, description: "Credits to deduct", minimum: 1 },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "balance", type: "number", required: true, description: "New credit balance" },
      ],
      additionalProperties: false,
    },
    permissions: ["db_write", "sensitive_ops"],
    risk: "high",
    sideEffects: ["writes_db", "modifies_state", "consumes_credits"],
    handlesSensitiveData: true,
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 3, delayMs: 200, backoff: false, maxTotalDelayMs: 2000 },
    idempotent: false,
    available: true,
  },
  {
    id: "credit_refund",
    name: "Credit Refund",
    description: "Refund credits to a user account after a failed generation",
    purpose: "Restore credits when generation fails to prevent unfair charges",
    category: "computation",
    inputSchema: {
      type: "object",
      properties: [
        { name: "userId", type: "string", required: true, description: "User ID" },
        { name: "amount", type: "number", required: true, description: "Credits to refund", minimum: 1 },
      ],
      additionalProperties: false,
    },
    outputSchema: {
      type: "object",
      properties: [
        { name: "balance", type: "number", required: true, description: "New credit balance after refund" },
      ],
      additionalProperties: false,
    },
    permissions: ["db_write", "sensitive_ops"],
    risk: "medium",
    sideEffects: ["writes_db", "modifies_state"],
    handlesSensitiveData: true,
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 3, delayMs: 200, backoff: false, maxTotalDelayMs: 2000 },
    idempotent: false,
    available: true,
  },
];

/**
 * Create and populate the KREA tool registry.
 */
export function createKreaToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  registry.registerAll(KREA_TOOLS);
  return registry;
}
