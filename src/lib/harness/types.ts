/**
 * KREA ARNÉS — Skill Plugin Interface
 *
 * Un SkillPlugin es un módulo de conocimiento que se registra en el arnés.
 * Difiere de un AgentAdapter: el Skill es CONOCIMIENTO, el Adapter es CAPACIDAD.
 *
 * Analogía:
 *   - SkillPlugin = la receta del plato (conocimiento del chef)
 *   - AgentAdapter = las manos que cocinan (cajero/agente)
 *
 * Si el cajero se va, la receta (SkillPlugin) queda en la cocina (KREA).
 */

import type { EvidenceTag } from "../agent-adapter";

// ─── Skill Plugin Interface ────────────────────────────────────────

export interface ISkillPlugin {
  /** Unique identifier */
  readonly skillId: string;

  /** Human-readable name */
  readonly name: string;

  /** Version */
  readonly version: string;

  /** Category of knowledge */
  readonly category: SkillCategory;

  /** What this skill knows how to do */
  readonly capabilities: string[];

  /** Dependencies on other skills (by skillId) */
  readonly dependencies?: string[];

  // ─── Lifecycle ────────────────────────────────────────────────

  /** Initialize the skill (load resources, validate deps) */
  initialize(context: SkillContext): Promise<void>;

  /** Shutdown the skill */
  shutdown(): Promise<void>;

  /** Is the skill ready? */
  readonly isReady: boolean;

  // ─── Health ───────────────────────────────────────────────────

  /** Health check */
  healthCheck(): Promise<SkillHealth>;

  // ─── Execution ────────────────────────────────────────────────

  /** Execute a skill operation */
  execute(operation: string, params: unknown): Promise<SkillResult>;

  /** List available operations */
  listOperations(): string[];
}

// ─── Skill Types ───────────────────────────────────────────────────

export type SkillCategory =
  | "product-brain"        // Product Fit, Decision, Architecture, Specification
  | "commercial-engine"    // Blueprint, Packaging, Offer
  | "product-factory"      // BookFactory, Orchestrator, ContentEngine
  | "qa-engine"            // ProductQA, VisualQA
  | "commercial-readiness" // CommercialReadiness, LaunchPackage
  | "product-lifecycle"    // Dossier, Versioning, Assets, Handoff
  | "infoproductos"        // Spanish-language infoproduct pipeline
  | "cognitive"            // Memory, Skills, Feedback
  | "security"             // Security, Audit, Firewall
  | "infrastructure";      // DB, Doctor, Observability

export interface SkillContext {
  /** Access to the active agent (via harness) */
  agent: {
    reason(prompt: string, options?: unknown): Promise<unknown>;
    reasonStructured<T>(prompt: string, schema: unknown, options?: unknown): Promise<T>;
    generateImage?(prompt: string, options?: unknown): Promise<unknown>;
    generateSpeech?(text: string, options?: unknown): Promise<unknown>;
  };
  /** Access to bridges */
  bridges: {
    get(bridgeId: string): unknown;
  };
  /** Access to other skills (by skillId) */
  skills: {
    get(skillId: string): ISkillPlugin | undefined;
  };
}

export interface SkillHealth {
  status: "READY" | "DEGRADED" | "DOWN";
  details?: string;
  latencyMs: number;
}

export interface SkillResult {
  success: boolean;
  data?: unknown;
  error?: string;
  evidence: EvidenceTag;
  latencyMs: number;
}

// ─── Skill Registry ────────────────────────────────────────────────

export class SkillRegistry {
  private skills = new Map<string, ISkillPlugin>();
  private context: SkillContext | null = null;

  /** Set the shared context (agent, bridges, skills) */
  setContext(context: SkillContext): void {
    this.context = context;
  }

  /** Register a skill plugin */
  async register(skill: ISkillPlugin): Promise<void> {
    if (!this.context) {
      throw new Error("SkillRegistry: context not set. Call setContext() first.");
    }

    // Validate dependencies
    if (skill.dependencies) {
      for (const depId of skill.dependencies) {
        if (!this.skills.has(depId)) {
          console.warn(`[SkillRegistry] Skill "${skill.skillId}" depends on "${depId}" which is not registered. Skill may not work correctly.`);
        }
      }
    }

    // Initialize
    await skill.initialize(this.context);
    this.skills.set(skill.skillId, skill);
    console.info(`[SkillRegistry] Registered skill: ${skill.skillId} v${skill.version} [${skill.category}]`);
  }

  /** Unregister a skill */
  async unregister(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (skill) {
      await skill.shutdown();
      this.skills.delete(skillId);
    }
  }

  /** Get a skill by ID */
  get(skillId: string): ISkillPlugin | undefined {
    return this.skills.get(skillId);
  }

  /** Get all skills in a category */
  getByCategory(category: SkillCategory): ISkillPlugin[] {
    return [...this.skills.values()].filter(s => s.category === category);
  }

  /** List all registered skills */
  list(): {
    id: string;
    name: string;
    version: string;
    category: SkillCategory;
    ready: boolean;
    capabilities: string[];
  }[] {
    return [...this.skills.values()].map(s => ({
      id: s.skillId,
      name: s.name,
      version: s.version,
      category: s.category,
      ready: s.isReady,
      capabilities: s.capabilities,
    }));
  }

  /** Execute an operation on a skill */
  async execute(skillId: string, operation: string, params: unknown): Promise<SkillResult> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      return {
        success: false,
        error: `Skill "${skillId}" not registered`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: 0,
      };
    }
    return skill.execute(operation, params);
  }

  /** Health check all skills */
  async healthCheckAll(): Promise<Record<string, SkillHealth>> {
    const results: Record<string, SkillHealth> = {};
    for (const [id, skill] of this.skills) {
      results[id] = await skill.healthCheck();
    }
    return results;
  }
}

export const skillRegistry = new SkillRegistry();
