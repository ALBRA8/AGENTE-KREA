/**
 * KREA ARNÉS — Agent Adapter Contract
 *
 * El arnés (harness) de KREA no depende de ningún agente específico.
 * Cualquier agente que implemente esta interfaz puede ser conectado.
 *
 * Analogía: el cajero se va, llega otro cajero.
 * La caja registradora (KREA) sigue igual.
 * El cajero nuevo solo necesita saber operar la caja.
 *
 * Agentes conocidos:
 *   - AGENTE-GENERAL (albra_seed, Python)
 *   - HERMES (futuro)
 *   - Cualquier agente con estas capacidades
 *
 * CONTRATO:
 *   - El agente NUNCA debe ser acoplado directamente desde el conocimiento KREA
 *   - Todo acceso al agente pasa por esta interfaz
 *   - Si un método no está disponible, retorna NOT_AVAILABLE (nunca crashea)
 *   - El agente es reemplazable en runtime sin reiniciar KREA
 */

// ─── Evidence Tags (compatibles con KREA existente) ────────────────
export type EvidenceTag = "VERIFIED" | "INFERRED" | "ESTIMATED" | "NOT_VERIFIED" | "UNKNOWN";

// ─── Tipos base del adaptador ──────────────────────────────────────

export interface AgentIdentity {
  agentId: string;
  name: string;
  version: string;
  specialization: string | null;
  capabilities: string[];
  autonomyLevel: string;       // L0..L5
  riskProfile: string;         // LOW, MEDIUM, HIGH, CRITICAL
  providers: string[];
  memoryDomains: string[];
}

export interface AgentResponse {
  content: string;
  structured?: unknown;        // JSON parsed response (when available)
  evidence: EvidenceTag;
  confidence: number;          // 0..1
  provider: string;            // Which provider was used
  model?: string;
  tokensUsed?: { input: number; output: number };
  latencyMs: number;
  error?: string;
}

export interface MemoryRecord {
  id: string;
  domain: string;
  userId: string;
  content: unknown;
  confidence: number;
  evidence: EvidenceTag;
  source: string;
  createdAt: string;
}

export interface SecurityResult {
  allowed: boolean;
  reason?: string;
  riskLevel?: string;
}

export interface AuditEntry {
  action: string;
  actor: string;
  resource?: string;
  result: "ALLOWED" | "DENIED" | "ERROR";
  evidence: EvidenceTag;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface HandoffResult {
  contractId: string;
  status: string;
  externalSend: EvidenceTag;   // VERIFIED if sent, NOT_VERIFIED if no provider
  payload?: unknown;
}

export interface HealthStatus {
  healthy: boolean;
  agent: string;
  components: Record<string, "UP" | "DOWN" | "DEGRADED">;
  latencyMs: number;
}

// ─── AgentAdapter — EL CONTRATO DEL ARNÉS ─────────────────────────
//
// Cualquier agente que quiera conectarse a KREA debe implementar
// esta interfaz. KREA nunca accede al agente directamente.

export interface AgentAdapter {
  // ─── Identidad ────────────────────────────────────────────────
  /** Quién es este agente */
  getIdentity(): AgentIdentity;

  /** Nombre legible del adaptador (ej: "agente-general", "hermes") */
  readonly adapterName: string;

  // ─── Cognición (LLM) ─────────────────────────────────────────
  /** Llamada al LLM del agente para razonamiento */
  reason(prompt: string, options?: ReasonOptions): Promise<AgentResponse>;

  /** Llamada al LLM con respuesta estructurada (JSON + schema) */
  reasonStructured<T>(
    prompt: string,
    schema: unknown,    // Zod schema or JSON schema
    options?: ReasonOptions
  ): Promise<AgentResponse & { structured: T }>;

  // ─── Generación (multimodal) ──────────────────────────────────
  /** Generar imagen via el agente */
  generateImage?(prompt: string, options?: ImageOptions): Promise<AgentResponse & { imageUrl?: string; imageBase64?: string }>;

  /** Texto a voz via el agente */
  generateSpeech?(text: string, options?: SpeechOptions): Promise<AgentResponse & { audioUrl?: string; audioBase64?: string }>;

  // ─── Memoria (persistencia cognitiva) ─────────────────────────
  /** Escribir en la memoria del agente */
  memoryWrite(domain: string, content: unknown, metadata?: MemoryMetadata): Promise<{ id: string; evidence: EvidenceTag }>;

  /** Leer de la memoria del agente */
  memoryRead(domain: string, query?: string, limit?: number): Promise<MemoryRecord[]>;

  // ─── Seguridad ────────────────────────────────────────────────
  /** Verificar permiso de acción */
  checkPermission(action: string, actor: string, resource?: string): Promise<SecurityResult>;

  /** Hashear contraseña (delegado al agente) */
  hashPassword(password: string): Promise<string>;

  /** Verificar contraseña */
  verifyPassword(password: string, hash: string): Promise<boolean>;

  /** Validar token de sesión */
  validateToken(token: string): Promise<{ valid: boolean; userId?: string }>;

  // ─── Auditoría ────────────────────────────────────────────────
  /** Registrar evento de auditoría */
  auditLog(entry: Omit<AuditEntry, "timestamp">): Promise<void>;

  // ─── Handoff ──────────────────────────────────────────────────
  /** Enviar handoff a otro agente/sistema */
  sendHandoff?(contractId: string, payload: unknown): Promise<HandoffResult>;

  // ─── Salud ────────────────────────────────────────────────────
  /** Health check del agente */
  healthCheck(): Promise<HealthStatus>;

  // ─── Ciclo de vida ────────────────────────────────────────────
  /** Inicializar conexión con el agente */
  initialize(): Promise<void>;

  /** Desconectar del agente (limpieza) */
  shutdown(): Promise<void>;

  /** ¿Está conectado? */
  readonly isConnected: boolean;
}

// ─── Options ───────────────────────────────────────────────────────

export interface ReasonOptions {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;           // Force specific provider
  model?: string;
  userId?: string;             // For isolation
  correlationId?: string;      // For tracing
}

export interface ImageOptions {
  size?: string;               // "1024x1024", "1600x1376", etc.
  quality?: "low" | "medium" | "high";
  model?: string;
}

export interface SpeechOptions {
  voice?: string;
  speed?: number;
  format?: string;
}

export interface MemoryMetadata {
  userId?: string;
  contextId?: string;
  source?: string;
  confidence?: number;
  evidence?: EvidenceTag;
  ttl?: number;                // Time to live in seconds
}

// ─── Adapter Registry ─────────────────────────────────────────────
//
// KREA mantiene un registry de adaptadores disponibles.
// Se puede cambiar el agente en runtime.

export class AdapterRegistry {
  private adapters = new Map<string, AgentAdapter>();
  private active: string | null = null;

  /** Registrar un adaptador */
  register(name: string, adapter: AgentAdapter): void {
    this.adapters.set(name, adapter);
    if (!this.active) this.active = name; // First registered becomes active
  }

  /** Desregistrar un adaptador */
  unregister(name: string): void {
    this.adapters.delete(name);
    if (this.active === name) {
      this.active = this.adapters.keys().next().value ?? null;
    }
  }

  /** Cambiar el agente activo (intercambiar cajero) */
  setActive(name: string): AgentAdapter {
    if (!this.adapters.has(name)) {
      throw new Error(`Adapter "${name}" not registered. Available: ${[...this.adapters.keys()].join(", ")}`);
    }
    this.active = name;
    return this.adapters.get(name)!;
  }

  /** Obtener el adaptador activo */
  getActive(): AgentAdapter {
    if (!this.active || !this.adapters.has(this.active)) {
      throw new Error("No active adapter. Register one first.");
    }
    return this.adapters.get(this.active)!;
  }

  /** Obtener un adaptador por nombre */
  get(name: string): AgentAdapter | undefined {
    return this.adapters.get(name);
  }

  /** Listar adaptadores disponibles */
  list(): { name: string; active: boolean; identity: AgentIdentity }[] {
    return [...this.adapters.entries()].map(([name, adapter]) => ({
      name,
      active: name === this.active,
      identity: adapter.getIdentity(),
    }));
  }

  /** Nombre del adaptador activo */
  get activeName(): string | null {
    return this.active;
  }
}

// ─── Singleton del registry ────────────────────────────────────────
export const adapterRegistry = new AdapterRegistry();
