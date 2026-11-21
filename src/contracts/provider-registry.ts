/**
 * Provider Registry — única vía de acceso a proveedores de generación.
 *
 * Las rutas /api/generate/* SIEMPRE obtienen su proveedor aquí, nunca
 * instancian el SDK directamente. Los tests pueden inyectar mocks con
 * setProviderOverride() / clearProviderOverrides().
 *
 * Arquitectura: ROUTE → REGISTRY → IGenerationProvider → ADAPTER → SDK
 */

import {
  IGenerationProvider,
  GenerationType,
} from "./provider.interface";
import {
  ZAITextAdapter,
  ZAIImageAdapter,
  ZAIVoiceAdapter,
} from "./zai.adapter";

const instances = new Map<GenerationType, IGenerationProvider>();
const overrides = new Map<GenerationType, IGenerationProvider>();

/** Devuelve el proveedor para un tipo: override de test > instancia singleton. */
export function getProvider(type: GenerationType): IGenerationProvider {
  const override = overrides.get(type);
  if (override) return override;

  let instance = instances.get(type);
  if (!instance) {
    switch (type) {
      case "text":
        instance = new ZAITextAdapter();
        break;
      case "image":
        instance = new ZAIImageAdapter();
        break;
      case "voice":
        instance = new ZAIVoiceAdapter();
        break;
      default:
        throw new Error(`No provider registered for type: ${type}`);
    }
    instances.set(type, instance);
  }
  return instance;
}

/** Disponibilidad real del proveedor (usa la clave/credenciales del entorno). */
export async function isProviderAvailable(type: GenerationType): Promise<boolean> {
  try {
    return await getProvider(type).isAvailable();
  } catch {
    return false;
  }
}

/* ── Inyección para tests ─────────────────────────────────────────────── */

/** Reemplaza el proveedor de un tipo (uso exclusivo de tests). */
export function setProviderOverride(type: GenerationType, provider: IGenerationProvider): void {
  overrides.set(type, provider);
}

/** Restaura los proveedores reales (uso exclusivo de tests). */
export function clearProviderOverrides(): void {
  overrides.clear();
}
