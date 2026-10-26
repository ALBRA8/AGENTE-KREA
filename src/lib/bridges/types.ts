/**
 * KREA ARNÉS — Bridge Types
 *
 * Un Bridge es la conexión entre KREA (TypeScript) y un runtime externo.
 * Formaliza cómo el arnés se comunica con cualquier proveedor de capacidades.
 *
 * Tipos de Bridge:
 *   - ZaiSdkBridge: llama al z-ai-web-dev-sdk (LLM, image, voice) — Node.js nativo
 *   - PythonBridge: llama scripts Python via subprocess — para infoproductos y albra_seed
 *   - HttpBridge: llama APIs REST externas — para agentes remotos
 *
 * Principio: KREA nunca acopla directamente un proveedor.
 *            Todo proveedor es accedido via un Bridge.
 */

import type { EvidenceTag } from "../agent-adapter";

// ─── Bridge Health ─────────────────────────────────────────────────

export interface BridgeHealth {
  status: "CONNECTED" | "DISCONNECTED" | "DEGRADED";
  latencyMs: number;
  details?: string;
}

// ─── Bridge Interface ──────────────────────────────────────────────

/**
 * Contrato que todo bridge debe implementar.
 * El bridge es la "traducción" entre la interfaz del arnés y el runtime real.
 */
export interface IBridge {
  /** Identificador único del bridge */
  readonly bridgeId: string;

  /** Tipo de bridge */
  readonly bridgeType: "zai-sdk" | "python" | "http" | "mock";

  /** Capacidades que este bridge provee */
  readonly capabilities: string[];

  /** ¿Está conectado? */
  readonly isConnected: boolean;

  /** Inicializar conexión */
  initialize(): Promise<void>;

  /** Desconectar */
  shutdown(): Promise<void>;

  /** Health check */
  healthCheck(): Promise<BridgeHealth>;
}

// ─── Bridge Call Result ────────────────────────────────────────────

export interface BridgeCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  evidence: EvidenceTag;
  latencyMs: number;
  provider: string;
}

// ─── ZAI SDK Bridge Types ──────────────────────────────────────────

export interface ZaiChatParams {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface ZaiImageParams {
  prompt: string;
  size?: string;
  model?: string;
  n7?: number;
}

export interface ZaiImageEditParams {
  image: string;       // URL or base64 of the source image
  prompt: string;     // Edit instruction
  size?: string;
  model?: string;
}

export interface ZaiVoiceParams {
  text: string;
  voice?: string;
  model?: string;
}

export interface ZaiChatResult extends BridgeCallResult {
  data?: { content: string; model?: string; tokensUsed?: { input: number; output: number } };
}

export interface ZaiImageResult extends BridgeCallResult {
  data?: { base64: string; url?: string; size: string };
}

export interface ZaiImageEditResult extends BridgeCallResult {
  data?: { base64: string; url?: string; size: string };
}

export interface ZaiVoiceResult extends BridgeCallResult {
  data?: { audioBase64: string; voice: string };
}

// ─── Python Bridge Types ───────────────────────────────────────────

export interface PythonCallParams {
  /** Script path relative to scripts directory, or absolute */
  script: string;
  /** Arguments to pass to the script */
  args: string[];
  /** Working directory (defaults to scriptsPath) */
  cwd?: string;
  /** Timeout in ms */
  timeout?: number;
  /** Environment variables */
  env?: Record<string, string>;
  /** Parse stdout as JSON? */
  parseJson?: boolean;
}

export interface PythonCallResult extends BridgeCallResult {
  data?: { stdout: string; parsed?: unknown; exitCode: number };
}

// ─── HTTP Bridge Types ─────────────────────────────────────────────

export interface HttpCallParams {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
}

export interface HttpCallResult extends BridgeCallResult {
  data?: { status: number; body: unknown };
}

// ─── Bridge Registry ───────────────────────────────────────────────

export class BridgeRegistry {
  private bridges = new Map<string, IBridge>();

  register(bridge: IBridge): void {
    this.bridges.set(bridge.bridgeId, bridge);
  }

  unregister(id: string): void {
    this.bridges.delete(id);
  }

  get(id: string): IBridge | undefined {
    return this.bridges.get(id);
  }

  list(): { id: string; type: string; capabilities: string[]; connected: boolean }[] {
    return [...this.bridges.values()].map(b => ({
      id: b.bridgeId,
      type: b.bridgeType,
      capabilities: b.capabilities,
      connected: b.isConnected,
    }));
  }

  /** Get all bridges that provide a specific capability */
  getByCapability(capability: string): IBridge[] {
    return [...this.bridges.values()].filter(b => b.capabilities.includes(capability));
  }
}

export const bridgeRegistry = new BridgeRegistry();
