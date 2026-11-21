/**
 * KREA ARNÉS — Knowledge Registry
 *
 * Registro formal de los módulos de conocimiento de KREA.
 * Cada KnowledgeModule es una pieza del arnés que:
 *   - Sabe hacer algo específico (capacidades)
 *   - Puede reportar su salud
 *   - Es independiente del agente activo
 *
 * El conocimiento es INMUTABLE frente al cambio de agente.
 * Si el cajero se va, la caja registradora sigue igual.
 */

// ─── Knowledge Module Interface ────────────────────────────────────

export interface IKnowledgeModule {
  /** Unique identifier (e.g., "product-fit", "commercial-readiness") */
  readonly moduleId: string;

  /** Human-readable name */
  readonly name: string;

  /** Version */
  readonly version: string;

  /** Category grouping */
  readonly category: KnowledgeCategory;

  /** What this module knows */
  readonly capabilities: string[];

  /** Source files (for traceability) */
  readonly sourceFiles: string[];

  /** Health check */
  healthCheck(): Promise<KnowledgeHealth>;
}

export type KnowledgeCategory =
  | "product-brain"
  | "commercial-engine"
  | "product-factory"
  | "qa-engine"
  | "commercial-readiness"
  | "product-lifecycle"
  | "infoproductos"
  | "cognitive"
  | "security"
  | "infrastructure";

export interface KnowledgeHealth {
  status: "AVAILABLE" | "DEGRADED" | "UNAVAILABLE";
  details?: string;
}

// ─── Knowledge Registry ────────────────────────────────────────────

export class KnowledgeRegistry {
  private modules = new Map<string, IKnowledgeModule>();

  /** Register a knowledge module */
  register(module: IKnowledgeModule): void {
    this.modules.set(module.moduleId, module);
  }

  /** Unregister */
  unregister(moduleId: string): void {
    this.modules.delete(moduleId);
  }

  /** Get a module */
  get(moduleId: string): IKnowledgeModule | undefined {
    return this.modules.get(moduleId);
  }

  /** Get all modules in a category */
  getByCategory(category: KnowledgeCategory): IKnowledgeModule[] {
    return [...this.modules.values()].filter(m => m.category === category);
  }

  /** List all module IDs (for harness status) */
  listIds(): string[] {
    return [...this.modules.keys()];
  }

  /** List all modules with metadata */
  list(): {
    id: string;
    name: string;
    version: string;
    category: KnowledgeCategory;
    capabilities: string[];
    sourceFiles: string[];
  }[] {
    return [...this.modules.values()].map(m => ({
      id: m.moduleId,
      name: m.name,
      version: m.version,
      category: m.category,
      capabilities: m.capabilities,
      sourceFiles: m.sourceFiles,
    }));
  }

  /** Health check all modules */
  async healthCheckAll(): Promise<Record<string, KnowledgeHealth>> {
    const results: Record<string, KnowledgeHealth> = {};
    for (const [id, module] of this.modules) {
      results[id] = await module.healthCheck();
    }
    return results;
  }

  /** Count modules by category */
  stats(): { total: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const mod of this.modules.values()) {
      byCategory[mod.category] = (byCategory[mod.category] || 0) + 1;
    }
    return { total: this.modules.size, byCategory };
  }
}

export const knowledgeRegistry = new KnowledgeRegistry();

// ─── KREA Knowledge Modules — Built-in Definitions ─────────────────

/**
 * Register all built-in KREA knowledge modules.
 * Called during harness initialization.
 *
 * NOTA: los módulos del Product Factory (product-fit, product-decision,
 * product-architecture, book-factory, orchestration, packaging, handoff,
 * versioning, cover/editorial/art-direction, …) se archivaron en
 * src/_product-factory/ al cerrar el proyecto — su misión (producción
 * creativa) no los usa. Ver src/_product-factory/README.md.
 */
export function registerBuiltinKnowledge(): void {
  const modules: IKnowledgeModule[] = [
    // Factory (misión: generación de eBooks)
    { moduleId: "pdf-factory", name: "PDF Factory", version: "2.1", category: "product-factory" as KnowledgeCategory, capabilities: ["generate-pdf", "render-pages"], sourceFiles: ["pdf-factory.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "visual-qa", name: "Visual QA", version: "2.1", category: "qa-engine" as KnowledgeCategory, capabilities: ["render-check", "visual-validate"], sourceFiles: ["visual-qa.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Commercial Creative (misión: creatividades comerciales AGENTE-KREA)
    { moduleId: "commercial-creative-engine", name: "Commercial Creative Engine", version: "1.0", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["generate-ad", "generate-landing-section", "generate-mockup", "generate-variant-pack", "generate-launch-package", "meta-ads", "tiktok-ads", "google-ads"], sourceFiles: ["commercial-creative-engine.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "ad-platforms", name: "Ad Platform Specs", version: "1.0", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["meta-formats", "tiktok-formats", "google-formats", "dimension-specs"], sourceFiles: ["commercial-creative-engine.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "landing-sections", name: "Landing Section Templates", version: "1.0", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["hero", "offer", "before-after", "benefits", "comparison", "authority", "testimonials", "how-to-use", "logistics", "faq"], sourceFiles: ["commercial-creative-engine.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "mockup-generator", name: "Mockup Generator", version: "1.0", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["phone", "laptop", "billboard", "box", "bottle", "tshirt", "flat-lay"], sourceFiles: ["commercial-creative-engine.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Infoproductos
    { moduleId: "infoproductos-pipeline", name: "Infoproductos Pipeline", version: "2.1", category: "infoproductos" as KnowledgeCategory, capabilities: ["7-step-pipeline", "ebook", "minicurso", "webinar", "podcast"], sourceFiles: ["infoproductos/engine.ts", "infoproductos/scripts/*.py"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "demand-validation", name: "Demand Validation", version: "2.1", category: "infoproductos" as KnowledgeCategory, capabilities: ["validate-demand", "autocomplete", "openseo"], sourceFiles: ["infoproductos/scripts/validar_demanda.py", "infoproductos/scripts/autocompletado.py"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "premium-style", name: "Premium Style", version: "2.1", category: "infoproductos" as KnowledgeCategory, capabilities: ["apply-style", "review-style"], sourceFiles: ["infoproductos/scripts/estilo_premium.py", "infoproductos/scripts/revisar_estilo.py"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "sales-page", name: "Sales Page Generator", version: "2.1", category: "infoproductos" as KnowledgeCategory, capabilities: ["generate-sales-page", "copy-writing"], sourceFiles: ["infoproductos/scripts/pagina_venta.py"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Cognitive
    { moduleId: "memory", name: "Memory DV", version: "2.1", category: "cognitive" as KnowledgeCategory, capabilities: ["read", "write", "search", "domains"], sourceFiles: ["memory.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "skills", name: "Skill Manager", version: "2.1", category: "cognitive" as KnowledgeCategory, capabilities: ["register", "execute", "discover"], sourceFiles: ["skills.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "feedback", name: "Feedback Engine", version: "2.1", category: "cognitive" as KnowledgeCategory, capabilities: ["collect", "analyze", "route"], sourceFiles: ["feedback.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Security
    { moduleId: "security", name: "Security Engine", version: "2.1", category: "security" as KnowledgeCategory, capabilities: ["pbkdf2", "ssrf-protection", "injection-detection", "rate-limit", "audit"], sourceFiles: ["security.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Infrastructure
    { moduleId: "database", name: "Database Layer", version: "2.1", category: "infrastructure" as KnowledgeCategory, capabilities: ["prisma", "sqlite", "20-models"], sourceFiles: ["db.ts", "prisma/schema.prisma"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "doctor", name: "Doctor V2", version: "2.1", category: "infrastructure" as KnowledgeCategory, capabilities: ["15-health-checks", "diagnostics"], sourceFiles: ["doctor-v2.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
  ];

  for (const mod of modules) {
    knowledgeRegistry.register(mod);
  }
}
