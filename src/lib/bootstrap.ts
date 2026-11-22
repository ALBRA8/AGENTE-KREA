/**
 * KREA ARNÉS — Bootstrap
 *
 * Pone el chaleco al agente al arrancar la app.
 *
 * Secuencia:
 *   1. Crear GeneralAdapter (con bridges reales)
 *   2. Montar en KreaHarness (registra knowledge + activa agente)
 *   3. Registrar bridges en BridgeRegistry
 *   4. Registrar InfoproductosPlugin en SkillRegistry
 *
 * Después de esto, KREA está lista para operar.
 * Si el agente falla, KREA funciona en modo degradado — el conocimiento no se pierde.
 */

import { kreaHarness } from "./krea-harness";
import { GeneralAdapter } from "./adapters/general-adapter";
import {
  infoproductosPythonBridge,
  agenteGeneralPythonBridge,
} from "./bridges/python-bridge";
import { bridgeRegistry } from "./bridges/types";
import { InfoproductosPlugin } from "./harness/infoproductos-plugin";
import { adapterRegistry } from "./agent-adapter";
import { getKreaAdapter } from "./commercial/krea-agent";

let bootstrapped = false;

/**
 * Inicializa KREA: pone el chaleco al agente.
 * Llamado una vez al arrancar la app.
 * Es idempotente — llamarlo múltiples veces no tiene efecto.
 */
export async function bootstrapKrea(): Promise<{
  status: "READY" | "DEGRADED" | "FAILED";
  agent: string;
  knowledge: number;
  bridges: number;
  skills: number;
}> {
  if (bootstrapped) {
    // Ya está vestido — devolver estado actual
    const status = kreaHarness.status();
    return {
      status: status.initialized ? "READY" : "DEGRADED",
      agent: status.activeAgent || "none",
      knowledge: status.knowledgeModules.length,
      bridges: status.bridges.length,
      skills: status.skills.length,
    };
  }

  try {
    // ─── 1. Registrar bridges Python ──────────────────────────
    // (el proveedor ZAI no necesita bridge: todo pasa por contracts/provider-registry)

    // Inicializar Python bridges (opcionales — no bloquean si fallan)
    try {
      await infoproductosPythonBridge.initialize();
      bridgeRegistry.register(infoproductosPythonBridge);
    } catch {
      console.warn("[Bootstrap] Python infoproductos bridge unavailable — infoproductos will work in degraded mode");
    }

    try {
      await agenteGeneralPythonBridge.initialize();
      bridgeRegistry.register(agenteGeneralPythonBridge);
    } catch {
      console.warn("[Bootstrap] Python agente-general bridge unavailable — using ZAI SDK only");
    }

    // ─── 2. Crear y montar el adaptador ───────────────────────
    const adapter = new GeneralAdapter({
      useZaiSdk: true,
      pythonBridge: infoproductosPythonBridge.isConnected
        ? infoproductosPythonBridge
        : undefined,
    });

    await kreaHarness.mount(adapter);

    // ─── 2b. Registrar AGENTE-KREA como adaptador adicional ────
    // AGENTE-KREA is registered in the adapter registry but does NOT
    // replace the active agent. It's available for commercial-specific
    // operations via adapterRegistry.get("agente-krea").
    try {
      const kreaAgent = getKreaAdapter();
      await kreaAgent.initialize();
      adapterRegistry.register("agente-krea", kreaAgent);
    } catch (error) {
      console.warn("[Bootstrap] AGENTE-KREA registration failed:", error);
    }

    // ─── 3. Registrar skill plugins ───────────────────────────
    const infoproductosPlugin = new InfoproductosPlugin();
    try {
      await kreaHarness.registerSkill(infoproductosPlugin);
    } catch (error) {
      console.warn("[Bootstrap] Infoproductos skill registration failed:", error);
    }

    bootstrapped = true;

    const status = kreaHarness.status();
    console.info(
      `[Bootstrap] ✅ KREA ARNÉS listo — agente: ${status.activeAgent}, ` +
      `conocimiento: ${status.knowledgeModules.length} módulos, ` +
      `bridges: ${status.bridges.length}, skills: ${status.skills.length}`
    );

    return {
      status: "READY",
      agent: status.activeAgent || "none",
      knowledge: status.knowledgeModules.length,
      bridges: status.bridges.length,
      skills: status.skills.length,
    };
  } catch (error) {
    console.error("[Bootstrap] ❌ KREA bootstrap failed:", error);

    // Modo degradado — el conocimiento sigue disponible
    const status = kreaHarness.status();
    return {
      status: status.initialized ? "DEGRADED" : "FAILED",
      agent: status.activeAgent || "none",
      knowledge: status.knowledgeModules.length,
      bridges: status.bridges.length,
      skills: status.skills.length,
    };
  }
}

/**
 * ¿El arnés está vestido?
 */
export function isBootstrapped(): boolean {
  return bootstrapped;
}
