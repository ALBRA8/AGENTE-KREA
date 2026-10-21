/**
 * KREA ARNÉS — Adaptador para AGENTE-GENERAL (albra_seed, Python)
 *
 * Este adaptador conecta KREA con el AGENTE-GENERAL de ALBRA8.
 * AGENTE-GENERAL es el ADN base: Runtime, Memory, Security, Firewall,
 * Audit, Evidence, Provenance, HITL, Workflows, MCP, Handoff, etc.
 *
 * Modo de conexión:
 *   - subprocess: llama al CLI de albra_seed via python subprocess
 *   - api: llama al servidor FastAPI del agente (si está corriendo)
 *
 * Por defecto usa subprocess (máxima portabilidad, sin servidor extra).
 */

import { randomUUID } from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
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
} from "./agent-adapter";

const execFileAsync = promisify(execFile);

// ─── Config ────────────────────────────────────────────────────────

interface GeneralAdapterConfig {
  agentPath: string;
  pythonCmd: string;
  mode: "subprocess" | "api";
  apiUrl?: string;
  timeout: number;
  zaiApiKey?: string;
}

const DEFAULT_CONFIG: GeneralAdapterConfig = {
  agentPath: process.env.AGENTE_GENERAL_PATH || path.join(process.cwd(), "albra_seed"),
  pythonCmd: process.env.PYTHON_CMD || "python3",
  mode: "subprocess",
  timeout: 60000,
};

// ─── GeneralAdapter ────────────────────────────────────────────────

export class GeneralAdapter implements AgentAdapter {
  readonly adapterName = "agente-general";
  private _isConnected = false;
  private config: GeneralAdapterConfig;

  constructor(config?: Partial<GeneralAdapterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  getIdentity(): AgentIdentity {
    return {
      agentId: "albra-general-agent",
      name: "AGENTE-GENERAL",
      version: "1.0.0",
      specialization: null,
      capabilities: [
        "reasoning", "memory", "security", "firewall", "audit",
        "evidence", "provenance", "mcp", "handoff", "workflows",
        "tools", "skills", "plugins", "doctor", "resilience",
        "approvals", "communication", "multimodal",
      ],
      autonomyLevel: "L3_SUGGEST",
      riskProfile: "MEDIUM",
      providers: ["zai", "openai", "mock"],
      memoryDomains: ["default", "product", "commercial", "infoproducto"],
    };
  }

  async initialize(): Promise<void> {
    try {
      await this.callPython("-c", "import albra_seed; print('ok')");
      this._isConnected = true;
    } catch {
      this._isConnected = false;
    }
  }

  async shutdown(): Promise<void> {
    this._isConnected = false;
  }

  // ─── Cognición ────────────────────────────────────────────────

  async reason(prompt: string, options?: ReasonOptions): Promise<AgentResponse> {
    const start = Date.now();
    try {
      if (this.config.mode === "api" && this.config.apiUrl) {
        return await this.reasonViaAPI(prompt, options);
      }
      const args = JSON.stringify({ prompt, ...options });
      const result = await this.callCLI("agent", ["run", "--input", args]);
      return {
        content: result,
        evidence: "INFERRED" as EvidenceTag,
        confidence: 0.7,
        provider: options?.provider || "zai",
        model: options?.model,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        content: "",
        evidence: "NOT_VERIFIED" as EvidenceTag,
        confidence: 0,
        provider: "unavailable",
        latencyMs: Date.now() - start,
        error: `Agent unavailable: ${error}`,
      };
    }
  }

  async reasonStructured<T>(
    prompt: string,
    schema: unknown,
    options?: ReasonOptions,
  ): Promise<AgentResponse & { structured: T }> {
    const response = await this.reason(
      `${prompt}\n\nRespond with valid JSON matching this schema: ${JSON.stringify(schema)}`,
      options,
    );
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as T;
        return { ...response, structured: parsed };
      }
    } catch { /* parse failed */ }
    return { ...response, structured: {} as T };
  }

  // ─── Generación ──────────────────────────────────────────────

  async generateImage(prompt: string, options?: ImageOptions): Promise<AgentResponse & { imageUrl?: string; imageBase64?: string }> {
    const start = Date.now();
    try {
      const result = await this.callCLI("agent", ["run", "--tool", "image_generate", "--input", JSON.stringify({ prompt, ...options })]);
      return { content: result, evidence: "INFERRED", confidence: 0.6, provider: "zai", latencyMs: Date.now() - start };
    } catch (error) {
      return { content: "", evidence: "NOT_VERIFIED", confidence: 0, provider: "unavailable", latencyMs: Date.now() - start, error: `Image unavailable: ${error}` };
    }
  }

  async generateSpeech(text: string, options?: SpeechOptions): Promise<AgentResponse & { audioUrl?: string; audioBase64?: string }> {
    const start = Date.now();
    try {
      const result = await this.callCLI("agent", ["run", "--tool", "tts_generate", "--input", JSON.stringify({ text, ...options })]);
      return { content: result, evidence: "INFERRED", confidence: 0.6, provider: "zai", latencyMs: Date.now() - start };
    } catch (error) {
      return { content: "", evidence: "NOT_VERIFIED", confidence: 0, provider: "unavailable", latencyMs: Date.now() - start, error: `Speech unavailable: ${error}` };
    }
  }

  // ─── Memoria ─────────────────────────────────────────────────

  async memoryWrite(domain: string, content: unknown, metadata?: MemoryMetadata): Promise<{ id: string; evidence: EvidenceTag }> {
    try {
      const id = randomUUID();
      await this.callCLI("memory", ["write", "--domain", domain, "--content", JSON.stringify(content), "--id", id]);
      return { id, evidence: "VERIFIED" };
    } catch {
      return { id: randomUUID(), evidence: "NOT_VERIFIED" };
    }
  }

  async memoryRead(domain: string, query?: string, limit?: number): Promise<MemoryRecord[]> {
    try {
      const result = await this.callCLI("memory", ["read", "--domain", domain, ...(query ? ["--query", query] : []), ...(limit ? ["--limit", String(limit)] : [])]);
      return JSON.parse(result);
    } catch {
      return [];
    }
  }

  // ─── Seguridad ────────────────────────────────────────────────

  async checkPermission(action: string, actor: string, resource?: string): Promise<SecurityResult> {
    try {
      const result = await this.callCLI("agent", ["run", "--tool", "firewall_check", "--input", JSON.stringify({ action, actor, resource })]);
      const parsed = JSON.parse(result);
      return { allowed: parsed.allowed ?? false, reason: parsed.reason, riskLevel: parsed.risk_level };
    } catch {
      return { allowed: false, reason: "Agent unavailable — default deny" };
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
      const { security } = await import("../security");
      return security.validateToken(token);
    } catch {
      return { valid: false };
    }
  }

  // ─── Auditoría ────────────────────────────────────────────────

  async auditLog(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    try {
      await this.callCLI("audit", ["log", "--entry", JSON.stringify({ ...entry, timestamp: new Date().toISOString() })]);
    } catch { /* non-critical */ }
  }

  // ─── Handoff ──────────────────────────────────────────────────

  async sendHandoff(contractId: string, payload: unknown): Promise<HandoffResult> {
    try {
      const result = await this.callCLI("agent", ["run", "--tool", "handoff_send", "--input", JSON.stringify({ contractId, payload })]);
      return { contractId, status: "SENT", externalSend: "INFERRED", payload: JSON.parse(result) };
    } catch {
      return { contractId, status: "READY", externalSend: "NOT_VERIFIED" };
    }
  }

  // ─── Salud ────────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      await this.callCLI("health", []);
      return { healthy: true, agent: "agente-general", components: { runtime: "UP", memory: "UP", security: "UP" }, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, agent: "agente-general", components: { runtime: "DOWN", memory: "DOWN", security: "DOWN" }, latencyMs: Date.now() - start };
    }
  }

  // ─── Internal ────────────────────────────────────────────────

  private async callCLI(command: string, args: string[]): Promise<string> {
    const fullArgs = ["-m", "albra_seed.cli", command, ...args];
    const { stdout } = await execFileAsync(this.config.pythonCmd, fullArgs, {
      cwd: this.config.agentPath,
      timeout: this.config.timeout,
      env: { ...process.env, ...(this.config.zaiApiKey ? { ZAI_API_KEY: this.config.zaiApiKey } : {}) },
    });
    return stdout.trim();
  }

  private async callPython(...args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(this.config.pythonCmd, args, { timeout: this.config.timeout });
    return stdout.trim();
  }

  private async reasonViaAPI(prompt: string, options?: ReasonOptions): Promise<AgentResponse> {
    const start = Date.now();
    const response = await fetch(`${this.config.apiUrl}/api/agent/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...options }),
    });
    const data = await response.json();
    return {
      content: data.content || "",
      evidence: data.evidence || "INFERRED",
      confidence: data.confidence || 0.5,
      provider: data.provider || "api",
      model: data.model,
      tokensUsed: data.tokens_used,
      latencyMs: Date.now() - start,
    };
  }
}
