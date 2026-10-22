/**
 * KREA ARNÉS — Adaptador para AGENTE-GENERAL
 *
 * Este adaptador conecta KREA con el AGENTE-GENERAL.
 * Usa bridges formales para comunicarse con cada runtime:
 *
 *   - ZaiSdkBridge → z-ai-web-dev-sdk (LLM, image, voice)
 *   - PythonBridge → scripts Python (infoproductos, albra_seed)
 *
 * Principio: el adaptador NUNCA llama un proveedor directamente.
 *            Todo pasa por un bridge.
 */

import { randomUUID } from "crypto";
import type {
  AgentAdapter,
  AgentIdentity,
  AgentResponse,
  MemoryRecord,
  SecurityResult,
  AuditEntry,
  HandoffResult,
  HealthStatus,
  ReasonOptions,
  ImageOptions,
  SpeechOptions,
  MemoryMetadata,
  EvidenceTag,
} from "../agent-adapter";
import { ZaiSdkBridge } from "../bridges/zai-sdk-bridge";
import { PythonBridge } from "../bridges/python-bridge";
import type { BridgeHealth } from "../bridges/types";

// ─── Config ────────────────────────────────────────────────────────

interface GeneralAdapterConfig {
  /** Use ZAI SDK for cognition (recommended) */
  useZaiSdk: boolean;
  /** Python bridge for scripts (optional) */
  pythonBridge?: PythonBridge;
  /** ZAI API key override */
  zaiApiKey?: string;
}

const DEFAULT_CONFIG: GeneralAdapterConfig = {
  useZaiSdk: true,
};

// ─── GeneralAdapter ────────────────────────────────────────────────

export class GeneralAdapter implements AgentAdapter {
  readonly adapterName = "agente-general";
  private _isConnected = false;
  private config: GeneralAdapterConfig;

  // Bridges
  private zaiBridge: ZaiSdkBridge;
  private pythonBridge?: PythonBridge;

  constructor(config?: Partial<GeneralAdapterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.zaiBridge = new ZaiSdkBridge();
    this.pythonBridge = config?.pythonBridge;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  getIdentity(): AgentIdentity {
    return {
      agentId: "krea-agente-general",
      name: "AGENTE-GENERAL",
      version: "2.1.0",
      specialization: null,
      capabilities: [
        // Cognition (via ZAI SDK)
        "reasoning", "structured-output", "multi-turn", "system-prompts",
        // Generation (via ZAI SDK)
        "image-generation", "voice-generation",
        // Memory (via Python or DB)
        "memory", "skills", "feedback",
        // Security (via security.ts)
        "security", "firewall", "audit",
        // Evidence
        "evidence", "provenance",
        // MCP & Handoff
        "mcp", "handoff", "workflows",
        // Infoproductos (via Python bridge)
        "infoproductos",
        // Health
        "doctor", "resilience",
        // Other
        "approvals", "communication", "multimodal",
      ],
      autonomyLevel: "L3_SUGGEST",
      riskProfile: "MEDIUM",
      providers: ["zai", "python", "mock"],
      memoryDomains: ["default", "product", "commercial", "infoproducto"],
    };
  }

  async initialize(): Promise<void> {
    try {
      // Initialize ZAI SDK bridge (primary)
      if (this.config.useZaiSdk) {
        await this.zaiBridge.initialize();
      }

      // Initialize Python bridge (optional)
      if (this.pythonBridge) {
        await this.pythonBridge.initialize();
      }

      this._isConnected = this.zaiBridge.isConnected || (this.pythonBridge?.isConnected ?? false);
    } catch (error) {
      this._isConnected = false;
      console.warn("[GeneralAdapter] Initialization partial:", error);
      // Still mark as connected if at least ZAI is available
      this._isConnected = this.zaiBridge.isConnected;
    }
  }

  async shutdown(): Promise<void> {
    await this.zaiBridge.shutdown();
    if (this.pythonBridge) {
      await this.pythonBridge.shutdown();
    }
    this._isConnected = false;
  }

  // ─── Cognición (via ZAI SDK Bridge) ──────────────────────────

  async reason(prompt: string, options?: ReasonOptions): Promise<AgentResponse> {
    const start = Date.now();

    // Try ZAI SDK first
    if (this.zaiBridge.isConnected) {
      try {
        const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
        if (options?.systemPrompt) {
          messages.push({ role: "system", content: options.systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const result = await this.zaiBridge.chat({
          messages,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          model: options?.model,
        });

        if (result.success && result.data) {
          return {
            content: result.data.content,
            evidence: result.evidence,
            confidence: 0.9,
            provider: result.provider,
            model: result.data.model,
            tokensUsed: result.data.tokensUsed,
            latencyMs: Date.now() - start,
          };
        }
      } catch {
        // Fall through to fallback
      }
    }

    // Fallback: Python bridge (if available)
    if (this.pythonBridge?.isConnected) {
      try {
        const result = await this.pythonBridge.call({
          script: "cli.py",
          args: ["agent", "run", "--input", JSON.stringify({ prompt, ...options })],
        });
        if (result.success) {
          return {
            content: (result.data as any)?.stdout || "",
            evidence: "INFERRED" as EvidenceTag,
            confidence: 0.7,
            provider: "python",
            latencyMs: Date.now() - start,
          };
        }
      } catch {
        // Fall through to error
      }
    }

    // No provider available
    return {
      content: "",
      evidence: "NOT_VERIFIED" as EvidenceTag,
      confidence: 0,
      provider: "unavailable",
      latencyMs: Date.now() - start,
      error: "No AI provider available — ZAI SDK and Python bridge both disconnected",
    };
  }

  async reasonStructured<T>(
    prompt: string,
    schema: unknown,
    options?: ReasonOptions,
  ): Promise<AgentResponse & { structured: T }> {
    const structuredPrompt = `${prompt}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(schema)}`;
    const response = await this.reason(structuredPrompt, options);

    try {
      // Try to extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as T;
        return { ...response, structured: parsed };
      }
      // Try array
      const arrayMatch = response.content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        const parsed = JSON.parse(arrayMatch[0]) as T;
        return { ...response, structured: parsed };
      }
    } catch {
      // Parse failed
    }

    return { ...response, structured: {} as T };
  }

  // ─── Generación (via ZAI SDK Bridge) ─────────────────────────

  async generateImage(
    prompt: string,
    options?: ImageOptions,
  ): Promise<AgentResponse & { imageUrl?: string; imageBase64?: string }> {
    const start = Date.now();

    if (this.zaiBridge.isConnected) {
      try {
        const result = await this.zaiBridge.generateImage({
          prompt,
          size: options?.size,
          model: options?.model,
        });

        if (result.success && result.data) {
          return {
            content: "Image generated successfully",
            imageUrl: result.data.url,
            imageBase64: result.data.base64,
            evidence: result.evidence,
            confidence: 0.9,
            provider: result.provider,
            latencyMs: Date.now() - start,
          };
        }
      } catch {
        // Fall through
      }
    }

    return {
      content: "",
      evidence: "NOT_VERIFIED" as EvidenceTag,
      confidence: 0,
      provider: "unavailable",
      latencyMs: Date.now() - start,
      error: "Image generation unavailable — ZAI SDK disconnected",
    };
  }

  async generateSpeech(
    text: string,
    options?: SpeechOptions,
  ): Promise<AgentResponse & { audioUrl?: string; audioBase64?: string }> {
    const start = Date.now();

    if (this.zaiBridge.isConnected) {
      try {
        const result = await this.zaiBridge.generateSpeech({
          text,
          voice: options?.voice,
        } as any);

        if (result.success && result.data) {
          return {
            content: "Speech generated successfully",
            audioBase64: result.data.audioBase64,
            evidence: result.evidence,
            confidence: 0.9,
            provider: result.provider,
            latencyMs: Date.now() - start,
          };
        }
      } catch {
        // Fall through
      }
    }

    return {
      content: "",
      evidence: "NOT_VERIFIED" as EvidenceTag,
      confidence: 0,
      provider: "unavailable",
      latencyMs: Date.now() - start,
      error: "Speech generation unavailable — ZAI SDK disconnected",
    };
  }

  // ─── Memoria ─────────────────────────────────────────────────

  async memoryWrite(
    domain: string,
    content: unknown,
    metadata?: MemoryMetadata,
  ): Promise<{ id: string; evidence: EvidenceTag }> {
    // Memory is managed by KREA's DB, not the agent
    // The agent only provides the interface — KREA persists
    const id = randomUUID();
    try {
      const { db } = await import("../db");
      await db.memory.create({
        data: {
          id,
          domain,
          userId: metadata?.userId || "system",
          content: JSON.stringify(content),
          confidence: metadata?.confidence || 0.5,
          evidence: metadata?.evidence || "INFERRED",
          source: metadata?.source || "agent-write",
        } as any,
      });
      return { id, evidence: "VERIFIED" as EvidenceTag };
    } catch {
      // DB unavailable — return optimistic result
      return { id, evidence: "NOT_VERIFIED" as EvidenceTag };
    }
  }

  async memoryRead(
    domain: string,
    query?: string,
    limit?: number,
  ): Promise<MemoryRecord[]> {
    try {
      const { db } = await import("../db");
      const records = await db.memory.findMany({
        where: { domain, ...(query ? { content: { contains: query } } : {}) },
        take: limit || 10,
        orderBy: { createdAt: "desc" },
      });
      return records.map((r: any) => ({
        id: r.id,
        domain: r.domain,
        userId: r.userId,
        content: JSON.parse(r.content || "{}"),
        confidence: r.confidence,
        evidence: r.evidence as EvidenceTag,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch {
      return [];
    }
  }

  // ─── Seguridad ────────────────────────────────────────────────

  async checkPermission(
    action: string,
    actor: string,
    resource?: string,
  ): Promise<SecurityResult> {
    try {
      const { SecurityManager } = await import("../security");
      const security = new SecurityManager();
      const result = await security.validatePermission(actor, action);
      return { allowed: result.granted, reason: result.reason };
    } catch {
      return { allowed: false, reason: "Security module unavailable — default deny" };
    }
  }

  async hashPassword(password: string): Promise<string> {
    const crypto = await import("crypto");
    const salt = crypto.randomBytes(32).toString("hex");
    const key = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return `pbkdf2:sha512:100000:${salt}:${key}`;
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      const crypto = await import("crypto");
      const parts = hash.split(":");
      if (parts[0] !== "pbkdf2" || parts.length !== 5) return false;
      const salt = parts[3];
      const storedKey = parts[4];
      const computedKey = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
      try {
        return crypto.timingSafeEqual(Buffer.from(computedKey), Buffer.from(storedKey));
      } catch {
        return computedKey === storedKey;
      }
    } catch {
      return false;
    }
  }

  async validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      const { SecurityManager } = await import("../security");
      const sec = new SecurityManager();
      return sec.validateToken(token);
    } catch {
      return { valid: false };
    }
  }

  // ─── Auditoría ────────────────────────────────────────────────

  async auditLog(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    try {
      const { db } = await import("../db");
      await db.auditEvent.create({
        data: {
          action: entry.action,
          actor: entry.actor,
          resource: entry.resource,
          result: entry.result,
          evidence: entry.evidence,
          metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
        } as any,
      });
    } catch {
      // Non-critical — audit log failure should not crash
    }
  }

  // ─── Handoff ──────────────────────────────────────────────────

  async sendHandoff(contractId: string, _payload: unknown): Promise<HandoffResult> {
    // Handoff module removed (dead code); return stub result
    return {
      contractId,
      status: "READY",
      externalSend: "NOT_VERIFIED" as EvidenceTag,
    };
  }

  // ─── Salud ────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    const components: Record<string, "UP" | "DOWN" | "DEGRADED"> = {};

    // Check ZAI SDK bridge
    const zaiHealth: BridgeHealth = await this.zaiBridge.healthCheck();
    components["zai-sdk"] = zaiHealth.status === "CONNECTED" ? "UP" : zaiHealth.status === "DEGRADED" ? "DEGRADED" : "DOWN";

    // Check Python bridge
    if (this.pythonBridge) {
      const pyHealth = await this.pythonBridge.healthCheck();
      components["python"] = pyHealth.status === "CONNECTED" ? "UP" : "DOWN";
    }

    // Check security
    try {
      const { SecurityManager } = await import("../security");
      components["security"] = "UP";
    } catch {
      components["security"] = "DOWN";
    }

    // Check DB
    try {
      const { db } = await import("../db");
      await db.$queryRaw`SELECT 1`;
      components["database"] = "UP";
    } catch {
      components["database"] = "DOWN";
    }

    const anyUp = Object.values(components).some(v => v === "UP");
    const allDown = Object.values(components).every(v => v === "DOWN");

    return {
      healthy: anyUp,
      agent: "agente-general",
      components,
      latencyMs: Date.now() - start,
    };
  }

  // ─── Bridge access (for advanced usage) ──────────────────────

  /** Get the ZAI SDK bridge for direct access */
  getZaiBridge(): ZaiSdkBridge {
    return this.zaiBridge;
  }

  /** Get the Python bridge for direct access */
  getPythonBridge(): PythonBridge | undefined {
    return this.pythonBridge;
  }
}
