/**
 * KREA ARNÉS — The Harness Orchestrator (v2.1)
 *
 * KREA es un ARNÉS (harness) que se le pone a cualquier agente.
 * El conocimiento queda en KREA. El agente es intercambiable.
 *
 * Analogía: en una empresa, si el cajero se va, llega otro cajero.
 * La infraestructura (caja registradora, procedimientos, registros)
 * permanece. El cajero nuevo solo necesita saber operar la caja.
 *
 * Arquitectura:
 *   KREA (arnés)
 *     ├── AgentAdapter → [AGENTE-GENERAL | HERMES | ...]  (intercambiable)
 *     ├── BridgeRegistry → [ZAI-SDK | Python | HTTP]       (conexiones formales)
 *     ├── SkillRegistry → [Infoproductos | ...]            (conocimiento plugin)
 *     └── KnowledgeRegistry → [29+ modules]                (conocimiento core)
 *
 * El arnés proporciona 7 dominios de conocimiento (29+ módulos):
 *   1. Product Brain (Fit, Decision, Architecture, Specification, Economics)
 *   2. Commercial Engine (Blueprint, Packaging, Offer)
 *   3. Product Factory (BookFactory, Orchestrator, ContentEngine)
 *   4. QA Engine (6-layer Product QA, Visual QA)
 *   5. Commercial Readiness + Launch Package + Feedback
 *   6. Product Lifecycle (Dossier, Versioning, Assets, Handoff)
 *   7. Infoproductos (validation, copy, cover, sales page)
 *
 * Todo esto es CONOCIMIENTO DE KREA. No se va cuando cambia el agente.
 */

import { adapterRegistry, type AgentAdapter } from "./agent-adapter";
import { bridgeRegistry, type IBridge } from "./bridges/types";
import { skillRegistry, type ISkillPlugin, type SkillContext } from "./harness/types";
import { knowledgeRegistry, registerBuiltinKnowledge, type IKnowledgeModule, type KnowledgeHealth } from "./harness/knowledge-registry";

// ─── KreaHarness ───────────────────────────────────────────────────

export class KreaHarness {
  private initialized = false;
  private knowledgeRegistered = false;

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Inicializar el arnés con un agente.
   * El agente se registra en el AdapterRegistry y se activa.
   * Los bridges y skills se inicializan con contexto del agente.
   */
  async mount(adapter: AgentAdapter): Promise<void> {
    // 1. Register built-in knowledge (idempotent)
    if (!this.knowledgeRegistered) {
      registerBuiltinKnowledge();
      this.knowledgeRegistered = true;
    }

    // 2. Register and activate agent
    adapterRegistry.register(adapter.adapterName, adapter);
    adapterRegistry.setActive(adapter.adapterName);
    await adapter.initialize();

    // 3. Set skill context so skills can use the agent
    skillRegistry.setContext(this.createSkillContext());

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
    skillsAffected: number;
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

    // Update skill context with new agent
    skillRegistry.setContext(this.createSkillContext());

    return {
      previousAgent: previousName || "none",
      newAgent: newAdapter.adapterName,
      knowledgePreserved: true, // KREA knowledge never leaves
      skillsAffected: skillRegistry.list().length,
    };
  }

  // ─── Agent Access ─────────────────────────────────────────────

  /**
   * Obtener el agente activo (para uso interno del conocimiento KREA).
   * NUNCA exponer directamente — los módulos KREA usan esto
   * para acceder a capacidades del agente.
   */
  agent(): AgentAdapter {
    return adapterRegistry.getActive();
  }

  // ─── Bridge Management ────────────────────────────────────────

  /** Register a bridge */
  registerBridge(bridge: IBridge): void {
    bridgeRegistry.register(bridge);
  }

  /** Get a bridge by ID */
  getBridge(id: string): IBridge | undefined {
    return bridgeRegistry.get(id);
  }

  // ─── Skill Management ─────────────────────────────────────────

  /** Register a skill plugin */
  async registerSkill(skill: ISkillPlugin): Promise<void> {
    if (!this.initialized) {
      throw new Error("Harness not initialized. Call mount() first.");
    }
    await skillRegistry.register(skill);
  }

  /** Execute a skill operation */
  async executeSkill(skillId: string, operation: string, params: unknown) {
    return skillRegistry.execute(skillId, operation, params);
  }

  // ─── Knowledge ────────────────────────────────────────────────

  /** Get the knowledge registry */
  getKnowledge(): typeof knowledgeRegistry {
    return knowledgeRegistry;
  }

  // ─── Status ───────────────────────────────────────────────────

  /**
   * Estado del arnés.
   */
  status(): {
    initialized: boolean;
    activeAgent: string | null;
    availableAgents: { name: string; active: boolean }[];
    knowledgeModules: string[];
    knowledgeStats: { total: number; byCategory: Record<string, number> };
    bridges: { id: string; type: string; connected: boolean }[];
    skills: { id: string; name: string; ready: boolean }[];
    philosophy: string;
  } {
    return {
      initialized: this.initialized,
      activeAgent: adapterRegistry.activeName,
      availableAgents: adapterRegistry.list().map(a => ({ name: a.name, active: a.active })),
      knowledgeModules: knowledgeRegistry.listIds(),
      knowledgeStats: knowledgeRegistry.stats(),
      bridges: bridgeRegistry.list().map(b => ({ id: b.id, type: b.type, connected: b.connected })),
      skills: skillRegistry.list().map(s => ({ id: s.id, name: s.name, ready: s.ready })),
      philosophy: "El agente es intercambiable. El conocimiento queda en KREA.",
    };
  }

  /**
   * Health check del arnés completo.
   */
  async healthCheck(): Promise<{
    harness: "UP" | "DEGRADED" | "DOWN";
    agent: "UP" | "DOWN";
    knowledge: "UP";
    bridges: Record<string, "UP" | "DOWN" | "DEGRADED">;
    skills: Record<string, "READY" | "DEGRADED" | "DOWN">;
    knowledgeHealth: Record<string, KnowledgeHealth>;
    details: Record<string, unknown>;
  }> {
    try {
      const agent = adapterRegistry.getActive();
      const agentHealth = await agent.healthCheck();

      // Bridge health
      const bridgeHealth: Record<string, "UP" | "DOWN" | "DEGRADED"> = {};
      for (const bridge of bridgeRegistry.list()) {
        const b = bridgeRegistry.get(bridge.id);
        if (b) {
          const h = await b.healthCheck();
          bridgeHealth[bridge.id] = h.status === "CONNECTED" ? "UP" : h.status === "DEGRADED" ? "DEGRADED" : "DOWN";
        }
      }

      // Skill health
      const skillHealths = await skillRegistry.healthCheckAll();
      const skillStatus: Record<string, "READY" | "DEGRADED" | "DOWN"> = {};
      for (const [id, h] of Object.entries(skillHealths)) {
        skillStatus[id] = h.status;
      }

      // Knowledge health
      const knowledgeHealth = await knowledgeRegistry.healthCheckAll();

      return {
        harness: agentHealth.healthy ? "UP" : "DEGRADED",
        agent: agentHealth.healthy ? "UP" : "DOWN",
        knowledge: "UP", // Knowledge is ALWAYS up — it's in KREA
        bridges: bridgeHealth,
        skills: skillStatus,
        knowledgeHealth,
        details: {
          agentIdentity: agent.getIdentity(),
          agentHealth,
          adaptersAvailable: adapterRegistry.list().length,
          knowledgeModules: knowledgeRegistry.listIds().length,
        },
      };
    } catch {
      return {
        harness: "DEGRADED",
        agent: "DOWN",
        knowledge: "UP",
        bridges: {},
        skills: {},
        knowledgeHealth: {},
        details: { error: "No active agent — KREA works in degraded mode" },
      };
    }
  }

  // ─── Internal ────────────────────────────────────────────────

  private createSkillContext(): SkillContext {
    return {
      agent: {
        reason: async (prompt: string, options?: unknown) => {
          const agent = adapterRegistry.getActive();
          return agent.reason(prompt, options as any);
        },
        reasonStructured: async <T>(prompt: string, schema: unknown, options?: unknown) => {
          const agent = adapterRegistry.getActive();
          const result = await agent.reasonStructured<T>(prompt, schema, options as any);
          return result.structured;
        },
        generateImage: async (prompt: string, options?: unknown) => {
          const agent = adapterRegistry.getActive();
          if (agent.generateImage) return agent.generateImage(prompt, options as any);
          throw new Error("Agent does not support image generation");
        },
        generateSpeech: async (text: string, options?: unknown) => {
          const agent = adapterRegistry.getActive();
          if (agent.generateSpeech) return agent.generateSpeech(text, options as any);
          throw new Error("Agent does not support speech generation");
        },
      },
      bridges: {
        get: (id: string) => bridgeRegistry.get(id),
      },
      skills: {
        get: (id: string) => skillRegistry.get(id),
      },
    };
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
