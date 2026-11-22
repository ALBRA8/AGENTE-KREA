/**
 * Provider Interface — Abstracción de proveedores de generación AI
 * 
 * Arquitectura: CORE → INTERFACE → ADAPTER → PROVIDER
 * 
 * Permite:
 * - Cambiar proveedores sin modificar el core
 * - Agregar proveedores adicionales
 * - Detectar fallos y aplicar fallback
 * - Medir calidad y coste
 * - Registrar evidencia
 */

export type GenerationType = "image" | "image-edit" | "text" | "voice" | "prompt";

export interface ProviderResult {
  success: boolean;
  data: unknown;
  providerId: string;
  cost: number;
  latencyMs: number;
  evidence: ProviderEvidence;
  error?: string;
}

export interface ProviderEvidence {
  truthLevel: "VERIFIED" | "OBSERVED" | "ESTIMATED" | "INFERRED" | "MODELED" | "UNKNOWN";
  model?: string;
  timestamp: string;
  requestId?: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: GenerationType;
  priority: number; // Lower = higher priority
  enabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Provider Interface — todo adapter debe implementar esto
 */
export interface IGenerationProvider {
  readonly config: ProviderConfig;
  
  generate(params: Record<string, unknown>): Promise<ProviderResult>;
  
  isAvailable(): Promise<boolean>;
  
  getCapabilities(): string[];
  
  estimateCost(params: Record<string, unknown>): number;
}
