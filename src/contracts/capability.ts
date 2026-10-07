/**
 * Capability Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines WHAT the agent CAN DO, with full metadata about each capability:
 * inputs, outputs, tools, permissions, risk, cost, dependencies, and status.
 *
 * Separate concern types: CAPABILITY, TOOL, SKILL, MEMORY, KNOWLEDGE, FEEDBACK, LEARNING
 * Each capability is independently evaluable and auditable.
 */

import { randomUUID } from "crypto";

// ─── Capability Status ───────────────────────────────────────────────────────

/** Implementation status of a capability */
export type CapabilityStatus =
  | "IMPLEMENTED"   // Fully working in production
  | "PARTIAL"       // Working but with known gaps
  | "MISSING"       | "MOCKED" | "PLACEHOLDER" | "UNKNOWN";

/** Category of capability concern */
export type CapabilityCategory =
  | "CAPABILITY"    // Core functional capability
  | "TOOL"          // Tool integration/wrapping
  | "SKILL"         // Composed multi-step skill
  | "MEMORY"        // Memory/recall capability
  | "KNOWLEDGE"     // Knowledge retrieval/storage
  | "FEEDBACK"      // Feedback/evaluation capability
  | "LEARNING";     // Learning/improvement capability

/** Risk level of a capability */
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

// ─── Input/Output Specs ──────────────────────────────────────────────────────

/** Input specification for a capability */
export interface CapabilityInput {
  /** Parameter name */
  name: string;
  /** Data type */
  type: "string" | "number" | "boolean" | "object" | "array" | "file" | "url";
  /** Whether this input is required */
  required: boolean;
  /** Human-readable description */
  description: string;
  /** Default value */
  default?: unknown;
  /** Validation constraints */
  constraints?: string;
}

/** Output specification for a capability */
export interface CapabilityOutput {
  /** Output name */
  name: string;
  /** Data type */
  type: "string" | "number" | "boolean" | "object" | "array" | "file" | "url" | "stream";
  /** Human-readable description */
  description: string;
  /** Content type for file/url outputs */
  contentType?: string;
}

// ─── Retry Policy ────────────────────────────────────────────────────────────

/** Retry policy for a capability execution */
export interface RetryPolicy {
  /** Maximum number of retries */
  maxRetries: number;
  /** Delay between retries in ms */
  delayMs: number;
  /** Whether to use exponential backoff */
  backoff: boolean;
}

// ─── Capability Definition ───────────────────────────────────────────────────

/**
 * Full definition of a single capability.
 * This is the atomic unit of "what the agent can do".
 */
export interface CapabilityDefinition {
  /** Unique capability identifier (e.g., "image_generation") */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Purpose — why this capability exists */
  purpose: string;
  /** Category of concern */
  category: CapabilityCategory;

  // ── Interface ─────────────────────────────────────────────────────────
  /** Required inputs */
  inputs: CapabilityInput[];
  /** Produced outputs */
  outputs: CapabilityOutput[];

  // ── Dependencies & Resources ──────────────────────────────────────────
  /** Tools required by this capability */
  toolsRequired: string[];
  /** Permissions required */
  permissions: string[];
  /** Other capabilities this depends on */
  dependencies: string[];
  /** External provider needed (e.g., "z-ai-web-dev-sdk") */
  provider?: string;

  // ── Risk & Cost ───────────────────────────────────────────────────────
  /** Risk level of executing this capability */
  risk: RiskLevel;
  /** Estimated cost per execution (in credits or currency) */
  cost: number;

  // ── Status & Metrics ──────────────────────────────────────────────────
  /** Implementation status */
  status: CapabilityStatus;
  /** Observed success rate (0-1) */
  successRate: number;
  /** Last time status was assessed */
  assessedAt?: string;

  // ── Usage Guidance ────────────────────────────────────────────────────
  /** When to use this capability */
  whenToUse: string;
  /** When NOT to use this capability */
  whenNotToUse: string;
  /** Alternative capabilities if this one fails or is unavailable */
  alternatives: string[];

  // ── Configuration ─────────────────────────────────────────────────────
  /** Timeout in ms for a single execution */
  timeoutMs: number;
  /** Retry policy */
  retryPolicy: RetryPolicy;
  /** Whether this capability has side effects (writes, external calls) */
  hasSideEffects: boolean;
  /** Whether this capability is idempotent */
  idempotent: boolean;
}

// ─── Capability Registry ────────────────────────────────────────────────────

/** Query options for the capability registry */
export interface CapabilityQuery {
  /** Filter by category */
  category?: CapabilityCategory;
  /** Filter by status */
  status?: CapabilityStatus;
  /** Filter by risk level (maximum) */
  maxRisk?: RiskLevel;
  /** Filter by provider */
  provider?: string;
  /** Filter by required tool */
  toolRequired?: string;
  /** Only capabilities with success rate above this threshold */
  minSuccessRate?: number;
}

/**
 * CapabilityRegistry — Central registry for all agent capabilities.
 * Supports registration, querying, dependency resolution, and gap analysis.
 */
export class CapabilityRegistry {
  private capabilities: Map<string, CapabilityDefinition> = new Map();
  private registeredAt: string;

  constructor() {
    this.registeredAt = new Date().toISOString();
  }

  /** Register a capability */
  register(capability: CapabilityDefinition): void {
    this.capabilities.set(capability.id, capability);
  }

  /** Register multiple capabilities at once */
  registerAll(capabilities: CapabilityDefinition[]): void {
    for (const cap of capabilities) {
      this.register(cap);
    }
  }

  /** Get a capability by ID */
  get(id: string): CapabilityDefinition | undefined {
    return this.capabilities.get(id);
  }

  /** Get all registered capabilities */
  getAll(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  /** Check if a capability exists */
  has(id: string): boolean {
    return this.capabilities.has(id);
  }

  /** Query capabilities with filters */
  query(query: CapabilityQuery): CapabilityDefinition[] {
    const riskOrder: Record<RiskLevel, number> = {
      none: 0, low: 1, medium: 2, high: 3, critical: 4,
    };

    return this.getAll().filter((cap) => {
      if (query.category && cap.category !== query.category) return false;
      if (query.status && cap.status !== query.status) return false;
      if (query.maxRisk && riskOrder[cap.risk] > riskOrder[query.maxRisk]) return false;
      if (query.provider && cap.provider !== query.provider) return false;
      if (query.toolRequired && !cap.toolsRequired.includes(query.toolRequired)) return false;
      if (query.minSuccessRate !== undefined && cap.successRate < query.minSuccessRate) return false;
      return true;
    });
  }

  /** Get dependencies for a capability (transitive) */
  getDependencies(capabilityId: string, visited: Set<string> = new Set()): CapabilityDefinition[] {
    const cap = this.capabilities.get(capabilityId);
    if (!cap || visited.has(capabilityId)) return [];

    visited.add(capabilityId);
    const deps: CapabilityDefinition[] = [];

    for (const depId of cap.dependencies) {
      const dep = this.capabilities.get(depId);
      if (dep) {
        deps.push(dep);
        deps.push(...this.getDependencies(depId, visited));
      }
    }

    return deps;
  }

  /** Find capabilities that are not fully implemented */
  findGaps(): CapabilityDefinition[] {
    return this.getAll().filter((cap) => cap.status !== "IMPLEMENTED");
  }

  /** Find capabilities that can serve as alternatives for a given capability */
  findAlternatives(capabilityId: string): CapabilityDefinition[] {
    const cap = this.capabilities.get(capabilityId);
    if (!cap) return [];

    return cap.alternatives
      .map((altId) => this.capabilities.get(altId))
      .filter((alt): alt is CapabilityDefinition => alt !== undefined && alt.status === "IMPLEMENTED");
  }

  /** Get registry statistics */
  getStats(): {
    total: number;
    byCategory: Record<CapabilityCategory, number>;
    byStatus: Record<CapabilityStatus, number>;
    byRisk: Record<RiskLevel, number>;
    averageSuccessRate: number;
  } {
    const all = this.getAll();
    const byCategory: Record<CapabilityCategory, number> = {
      CAPABILITY: 0, TOOL: 0, SKILL: 0, MEMORY: 0, KNOWLEDGE: 0, FEEDBACK: 0, LEARNING: 0,
    };
    const byStatus: Record<CapabilityStatus, number> = {
      IMPLEMENTED: 0, PARTIAL: 0, MISSING: 0, MOCKED: 0, PLACEHOLDER: 0, UNKNOWN: 0,
    };
    const byRisk: Record<RiskLevel, number> = {
      none: 0, low: 0, medium: 0, high: 0, critical: 0,
    };

    let totalSuccessRate = 0;
    for (const cap of all) {
      byCategory[cap.category]++;
      byStatus[cap.status]++;
      byRisk[cap.risk]++;
      totalSuccessRate += cap.successRate;
    }

    return {
      total: all.length,
      byCategory,
      byStatus,
      byRisk,
      averageSuccessRate: all.length > 0 ? totalSuccessRate / all.length : 0,
    };
  }

  /** Get the registration timestamp */
  getRegisteredAt(): string {
    return this.registeredAt;
  }
}

// ─── KREA Capabilities ──────────────────────────────────────────────────────

/** Default retry policy for most capabilities */
const DEFAULT_RETRY: RetryPolicy = { maxRetries: 2, delayMs: 1000, backoff: true };

/** Default retry policy for high-risk capabilities */
const CONSERVATIVE_RETRY: RetryPolicy = { maxRetries: 1, delayMs: 2000, backoff: true };

/**
 * All capabilities for AGENTE-KREA, registered with full metadata.
 * Each capability status reflects the actual audit results.
 */
export const KREA_CAPABILITIES: CapabilityDefinition[] = [
  {
    id: "prompt_generation",
    name: "Prompt Generation",
    description: "Generates optimized prompts for AI visual generation (images, video, animation)",
    purpose: "Transform user intent into effective AI prompts that produce high-quality visual output",
    category: "CAPABILITY",
    inputs: [
      { name: "userIntent", type: "string", required: true, description: "Raw user description of what to generate" },
      { name: "style", type: "string", required: false, description: "Visual style preference" },
      { name: "type", type: "string", required: true, description: "Generation type (image, video, animation)", constraints: "enum:image,video,animation,cloning" },
    ],
    outputs: [
      { name: "optimizedPrompt", type: "string", description: "AI-optimized prompt for generation" },
      { name: "negativePrompt", type: "string", description: "Negative prompt to avoid unwanted features" },
    ],
    toolsRequired: ["zai_chat"],
    permissions: ["api_access"],
    dependencies: [],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.95,
    whenToUse: "When user needs an optimized prompt for any AI visual generation",
    whenNotToUse: "When user provides an already-optimized prompt or for non-visual generation",
    alternatives: [],
    timeoutMs: 30000,
    retryPolicy: DEFAULT_RETRY,
    hasSideEffects: false,
    idempotent: true,
  },
  {
    id: "image_generation",
    name: "Image Generation",
    description: "Generates images using AI with multiple size options (512x512 to 1536x1024)",
    purpose: "Produce visual assets from text descriptions using AI image models",
    category: "CAPABILITY",
    inputs: [
      { name: "prompt", type: "string", required: true, description: "Image generation prompt" },
      { name: "size", type: "string", required: false, description: "Image dimensions", default: "1024x1024", constraints: "enum:512x512,1024x1024,1536x1024,1024x1536" },
    ],
    outputs: [
      { name: "imageBase64", type: "string", description: "Generated image as base64", contentType: "image/png" },
      { name: "imageSize", type: "string", description: "Actual dimensions of the generated image" },
    ],
    toolsRequired: ["zai_image"],
    permissions: ["api_access", "storage_write"],
    dependencies: ["prompt_generation"],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 3,
    status: "IMPLEMENTED",
    successRate: 0.92,
    whenToUse: "When user needs an AI-generated image from a text description",
    whenNotToUse: "When user needs video, audio, or text content",
    alternatives: [],
    timeoutMs: 60000,
    retryPolicy: DEFAULT_RETRY,
    hasSideEffects: true,
    idempotent: false,
  },
  {
    id: "voice_generation",
    name: "Voice/TTS Generation",
    description: "Generates speech from text using TTS with 4 available voices",
    purpose: "Convert text content into natural-sounding speech for audio assets",
    category: "CAPABILITY",
    inputs: [
      { name: "text", type: "string", required: true, description: "Text to convert to speech" },
      { name: "voice", type: "string", required: false, description: "Voice to use", default: "tongtong", constraints: "enum:tongtong,xiaoyi,zhiyan,zhichu" },
    ],
    outputs: [
      { name: "audioBuffer", type: "object", description: "Generated audio as ArrayBuffer", contentType: "audio/mpeg" },
      { name: "voice", type: "string", description: "Voice used for generation" },
    ],
    toolsRequired: ["zai_tts"],
    permissions: ["api_access", "storage_write"],
    dependencies: [],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 3,
    status: "IMPLEMENTED",
    successRate: 0.93,
    whenToUse: "When user needs text-to-speech audio generation",
    whenNotToUse: "When user needs image, video, or text content",
    alternatives: [],
    timeoutMs: 60000,
    retryPolicy: DEFAULT_RETRY,
    hasSideEffects: true,
    idempotent: false,
  },
  {
    id: "text_generation",
    name: "Creative Text Generation",
    description: "Generates creative text content: copy, social posts, emails, scripts, subtitles",
    purpose: "Produce written creative assets for marketing and communication",
    category: "CAPABILITY",
    inputs: [
      { name: "prompt", type: "string", required: true, description: "Description of the text to generate" },
      { name: "type", type: "string", required: true, description: "Text type", constraints: "enum:copy,social,email,script,subtitle" },
      { name: "tone", type: "string", required: false, description: "Desired tone of voice" },
    ],
    outputs: [
      { name: "content", type: "string", description: "Generated text content" },
    ],
    toolsRequired: ["zai_chat"],
    permissions: ["api_access"],
    dependencies: [],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.94,
    whenToUse: "When user needs written creative content",
    whenNotToUse: "When user needs visual or audio content",
    alternatives: ["prompt_generation"],
    timeoutMs: 30000,
    retryPolicy: DEFAULT_RETRY,
    hasSideEffects: false,
    idempotent: false,
  },
  {
    id: "ebook_generation",
    name: "eBook Generation",
    description: "Generates complete eBooks in Markdown format from a topic",
    purpose: "Produce long-form written content structured as an eBook",
    category: "SKILL",
    inputs: [
      { name: "topic", type: "string", required: true, description: "eBook topic or subject" },
      { name: "chapters", type: "number", required: false, description: "Number of chapters", default: 5 },
    ],
    outputs: [
      { name: "markdown", type: "string", description: "Complete eBook in Markdown format", contentType: "text/markdown" },
    ],
    toolsRequired: ["zai_chat"],
    permissions: ["api_access"],
    dependencies: ["text_generation"],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 0,
    status: "PARTIAL",
    successRate: 0.85,
    whenToUse: "When user needs a structured long-form eBook",
    whenNotToUse: "For short-form content, use text_generation instead",
    alternatives: ["text_generation"],
    timeoutMs: 120000,
    retryPolicy: CONSERVATIVE_RETRY,
    hasSideEffects: false,
    idempotent: false,
    assessedAt: new Date().toISOString(),
  },
  {
    id: "subtitle_generation",
    name: "Subtitle Generation",
    description: "Generates subtitles/captions for video content",
    purpose: "Create accessible subtitle files for video content",
    category: "CAPABILITY",
    inputs: [
      { name: "text", type: "string", required: true, description: "Transcript or description to create subtitles from" },
      { name: "format", type: "string", required: false, description: "Subtitle format", default: "srt", constraints: "enum:srt,vtt,ass" },
    ],
    outputs: [
      { name: "subtitles", type: "string", description: "Formatted subtitle content" },
    ],
    toolsRequired: ["zai_chat"],
    permissions: ["api_access"],
    dependencies: ["text_generation"],
    provider: "z-ai-web-dev-sdk",
    risk: "low",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.88,
    whenToUse: "When user needs subtitles or captions for video",
    whenNotToUse: "For standalone text content, use text_generation",
    alternatives: ["text_generation"],
    timeoutMs: 30000,
    retryPolicy: DEFAULT_RETRY,
    hasSideEffects: false,
    idempotent: false,
  },
  {
    id: "campaign_metrics",
    name: "Campaign Metrics Tracking",
    description: "Tracks and computes campaign metrics: ROAS, revenue, investment, sales",
    purpose: "Provide data-driven insights on campaign performance",
    category: "CAPABILITY",
    inputs: [
      { name: "campaignData", type: "object", required: true, description: "Daily campaign metrics (revenue, investment, sales)" },
      { name: "date", type: "string", required: true, description: "Date for the metrics (YYYY-MM-DD)" },
    ],
    outputs: [
      { name: "metrics", type: "object", description: "Computed metrics: ROAS, profit, status, totals" },
    ],
    toolsRequired: [],
    permissions: ["db_read", "db_write"],
    dependencies: [],
    risk: "none",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.99,
    whenToUse: "When tracking or analyzing campaign performance data",
    whenNotToUse: "For creative generation tasks",
    alternatives: [],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 1, delayMs: 500, backoff: false },
    hasSideEffects: true,
    idempotent: true,
  },
  {
    id: "credit_system",
    name: "Credit System",
    description: "Manages user credits: deduction, refund, balance checking",
    purpose: "Control resource consumption and prevent abuse",
    category: "CAPABILITY",
    inputs: [
      { name: "userId", type: "string", required: true, description: "User ID" },
      { name: "amount", type: "number", required: true, description: "Credit amount" },
      { name: "operation", type: "string", required: true, description: "Operation type", constraints: "enum:deduct,refund,balance" },
    ],
    outputs: [
      { name: "balance", type: "number", description: "Current credit balance after operation" },
    ],
    toolsRequired: [],
    permissions: ["db_read", "db_write", "sensitive_ops"],
    dependencies: [],
    risk: "medium",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.99,
    whenToUse: "When managing user credits for generation operations",
    whenNotToUse: "For non-credit related operations",
    alternatives: [],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 3, delayMs: 200, backoff: false },
    hasSideEffects: true,
    idempotent: false,
  },
  {
    id: "generation_history",
    name: "Generation History",
    description: "Tracks and retrieves user generation history with full traceability",
    purpose: "Provide audit trail and user access to past generations",
    category: "MEMORY",
    inputs: [
      { name: "userId", type: "string", required: true, description: "User ID" },
      { name: "type", type: "string", required: false, description: "Filter by generation type" },
      { name: "limit", type: "number", required: false, description: "Max records to return", default: 50 },
    ],
    outputs: [
      { name: "records", type: "array", description: "Generation records with full metadata" },
    ],
    toolsRequired: [],
    permissions: ["db_read"],
    dependencies: [],
    risk: "none",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.99,
    whenToUse: "When displaying user history or auditing generations",
    whenNotToUse: "For real-time generation operations",
    alternatives: [],
    timeoutMs: 5000,
    retryPolicy: { maxRetries: 1, delayMs: 500, backoff: false },
    hasSideEffects: false,
    idempotent: true,
  },
  {
    id: "health_check",
    name: "Health Check / Doctor",
    description: "Runs diagnostic checks on all subsystems: DB, API, providers, storage, config",
    purpose: "Monitor agent health and detect issues before they impact users",
    category: "FEEDBACK",
    inputs: [],
    outputs: [
      { name: "report", type: "object", description: "Health check report with status per subsystem" },
    ],
    toolsRequired: ["zai_sdk"],
    permissions: ["db_read", "api_access"],
    dependencies: [],
    risk: "low",
    cost: 0,
    status: "IMPLEMENTED",
    successRate: 0.97,
    whenToUse: "When monitoring agent health or diagnosing issues",
    whenNotToUse: "For user-facing generation operations",
    alternatives: [],
    timeoutMs: 30000,
    retryPolicy: { maxRetries: 0, delayMs: 0, backoff: false },
    hasSideEffects: false,
    idempotent: true,
  },
];

/**
 * Create and populate the KREA capability registry with all capabilities.
 */
export function createKreaRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry();
  registry.registerAll(KREA_CAPABILITIES);
  return registry;
}
