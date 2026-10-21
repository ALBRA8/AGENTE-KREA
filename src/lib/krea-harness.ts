/**
 * KREA ARNÉS — The Harness Orchestrator
 *
 * KREA es un ARNÉS (harness) que se le pone a cualquier agente.
 * El conocimiento queda en KREA. El agente es intercambiable.
 *
 * Analogía: en una empresa, si el cajero se va, llega otro cajero.
 * La infraestructura (caja registradora, procedimientos, registros)
 * permanece. El cajero nuevo solo necesita saber operar la caja.
 *
 * Arquitectura:
 *   KREA (arnés) → AgentAdapter → [AGENTE-GENERAL | HERMES | ...]
 *                     ↑
 *               intercambiable
 *
 * El arnés proporciona:
 *   1. Product Brain (Fit, Decision, Architecture, Specification)
 *   2. Commercial Engine (Blueprint, Packaging, Offer)
 *   3. Product Factory (BookFactory, Orchestrator, ContentEngine)
 *   4. QA Engine (6-layer Product QA, Visual QA)
 *   5. Commercial Readiness + Launch Package
 *   6. Product Lifecycle (Dossier, Versioning, Assets, Handoff)
 *   7. Infoproductos (validation, copy, cover, sales page)
 *
 * Todo esto es CONOCIMIENTO DE KREA. No se va cuando cambia el agente.
 */

import { adapterRegistry, type AgentAdapter } from "./agent-adapter";

// ─── KreaHarness ───────────────────────────────────────────────────

export class KreaHarness {
  private initialized = false;

  /**
   * Inicializar el arnés con un agente.
   * El agente se registra en el AdapterRegistry y se activa.
   */
  async mount(adapter: AgentAdapter): Promise<void> {
    adapterRegistry.register(adapter.adapterName, adapter);
    adapterRegistry.setActive(adapter.adapterName);
    await adapter.initialize();
    this.initialized = true;
  }

  /**
   * Cambiar el agente sin perder el conocimiento.
   * Como cambiar de cajero: la caja registradora sigue igual.
   */
  async swapAgent(newAdapter: AgentAdapter): Promise<{
    previousAgent: string;
    newAgent: string;
    knowledgePreserved: boolean;
  }> {
    const previousName = adapterRegistry.activeName;

    // Desconectar agente anterior (NO perder datos)
    if (previousName) {
      const previous = adapterRegistry.get(previousName);
      if (previous) await previous.shutdown();
    }

    // Registrar y activar nuevo agente
    adapterRegistry.register(newAdapter.adapterName, newAdapter);
    adapterRegistry.setActive(newAdapter.adapterName);
    await newAdapter.initialize();

    return {
      previousAgent: previousName || "none",
      newAgent: newAdapter.adapterName,
      knowledgePreserved: true, // KREA knowledge never leaves
    };
  }

  /**
   * Obtener el agente activo (para uso interno del conocimiento KREA).
   * NUNCA exponer directamente — los módulos KREA usan esto
   * para acceder a capacidades del agente.
   */
  agent(): AgentAdapter {
    return adapterRegistry.getActive();
  }

  /**
   * Estado del arnés.
   */
  status(): {
    initialized: boolean;
    activeAgent: string | null;
    availableAgents: { name: string; active: boolean }[];
    knowledgeModules: string[];
  } {
    return {
      initialized: this.initialized,
      activeAgent: adapterRegistry.activeName,
      availableAgents: adapterRegistry.list().map(a => ({ name: a.name, active: a.active })),
      knowledgeModules: [
        // Product Brain
        "product-fit",
        "product-decision",
        "product-architecture",
        "product-specification",
        "product-economics",
        // Commercial Engine
        "commercial-product",
        "product-blueprint",
        "product-packaging",
        "offer-architecture",
        // Factory
        "book-factory",
        "pdf-factory",
        "factory-orchestrator",
        "product-content-engine",
        // QA
        "product-qa",
        "visual-qa",
        "product-validation-loop",
        // Commercial Readiness
        "commercial-readiness",
        "launch-package",
        "commercial-feedback",
        // Lifecycle
        "product-dossier",
        "product-handoff",
        "product-versioning",
        "asset-manager",
        // Infoproductos
        "infoproductos-pipeline",
        "demand-validation",
        "premium-style",
        "sales-page",
      ],
    };
  }

  /**
   * Health check del arnés completo.
   */
  async healthCheck(): Promise<{
    harness: "UP" | "DEGRADED" | "DOWN";
    agent: "UP" | "DOWN";
    knowledge: "UP";
    details: Record<string, unknown>;
  }> {
    try {
      const agent = adapterRegistry.getActive();
      const agentHealth = await agent.healthCheck();

      return {
        harness: agentHealth.healthy ? "UP" : "DEGRADED",
        agent: agentHealth.healthy ? "UP" : "DOWN",
        knowledge: "UP", // Knowledge is ALWAYS up — it's in KREA
        details: {
          agentIdentity: agent.getIdentity(),
          agentHealth,
          adaptersAvailable: adapterRegistry.list().length,
        },
      };
    } catch {
      return {
        harness: "DEGRADED",
        agent: "DOWN",
        knowledge: "UP",
        details: { error: "No active agent — KREA works in degraded mode" },
      };
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────

export const kreaHarness = new KreaHarness();

/**
 * Helper: obtener el agente activo desde cualquier módulo KREA.
 *
 * Uso:
 *   const agent = getAgent();
 *   const response = await agent.reason("Analyze this product...");
 */
export function getAgent(): AgentAdapter {
  return adapterRegistry.getActive();
}

/**
 * Helper: ejecutar una operación via el agente con fallback graceful.
 * Si el agente no está disponible, retorna un resultado NOT_VERIFIED
 * en vez de crashear.
 */
export async function withAgent<T>(
  operation: (agent: AgentAdapter) => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    const agent = adapterRegistry.getActive();
    if (!agent.isConnected) return fallback();
    return await operation(agent);
  } catch {
    return fallback();
  }
}
