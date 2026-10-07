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

export type GenerationType = "image" | "text" | "voice" | "prompt";

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

/**
 * Provider Manager — selecciona, ejecuta, y hace fallback
 */
export class ProviderManager {
  private providers: Map<GenerationType, IGenerationProvider[]> = new Map();

  register(provider: IGenerationProvider): void {
    const type = provider.config.type;
    const existing = this.providers.get(type) || [];
    existing.push(provider);
    existing.sort((a, b) => a.config.priority - b.config.priority);
    this.providers.set(type, existing);
  }

  async execute(type: GenerationType, params: Record<string, unknown>): Promise<ProviderResult> {
    const providers = this.providers.get(type) || [];
    
    for (const provider of providers) {
      if (!provider.config.enabled) continue;
      
      try {
        const available = await provider.isAvailable();
        if (!available) continue;
        
        const start = Date.now();
        const result = await provider.generate(params);
        result.latencyMs = Date.now() - start;
        
        if (result.success) return result;
      } catch (e) {
        // Try next provider (fallback)
        continue;
      }
    }

    return {
      success: false,
      data: null,
      providerId: "none",
      cost: 0,
      latencyMs: 0,
      evidence: { truthLevel: "UNKNOWN", timestamp: new Date().toISOString() },
      error: `No available provider for type: ${type}`,
    };
  }

  getProviders(type: GenerationType): IGenerationProvider[] {
    return this.providers.get(type) || [];
  }
}
