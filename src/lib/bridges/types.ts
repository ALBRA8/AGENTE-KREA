/**
 * KREA ARNÉS — Bridge Types
 *
 * Un Bridge es la conexión entre KREA (TypeScript) y un runtime externo.
 * Formaliza cómo el arnés se comunica con cualquier proveedor de capacidades.
 *
 * Tipos de Bridge:
 *   - PythonBridge: llama scripts Python via subprocess — para infoproductos
 *   (la generación ZAI no usa bridge: pasa por contracts/provider-registry)
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
  readonly bridgeType: "python" | "mock";

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
