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
    for (const module of this.modules.values()) {
      byCategory[module.category] = (byCategory[module.category] || 0) + 1;
    }
    return { total: this.modules.size, byCategory };
  }
}

export const knowledgeRegistry = new KnowledgeRegistry();

// ─── KREA Knowledge Modules — Built-in Definitions ─────────────────

/**
 * Register all built-in KREA knowledge modules.
 * Called during harness initialization.
 */
export function registerBuiltinKnowledge(): void {
  const modules: IKnowledgeModule[] = [
    // Product Brain
    { moduleId: "product-fit", name: "Product Fit", version: "2.1", category: "product-brain" as KnowledgeCategory, capabilities: ["analyze-fit", "score-opportunity"], sourceFiles: ["product-fit.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-decision", name: "Product Decision", version: "2.1", category: "product-brain" as KnowledgeCategory, capabilities: ["decide", "evaluate-evidence"], sourceFiles: ["product-decision.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-architecture", name: "Product Architecture", version: "2.1", category: "product-brain" as KnowledgeCategory, capabilities: ["architect", "define-modules"], sourceFiles: ["product-architecture.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-specification", name: "Product Specification", version: "2.1", category: "product-brain" as KnowledgeCategory, capabilities: ["specify", "define-requirements"], sourceFiles: ["product-specification.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-economics", name: "Product Economics", version: "2.1", category: "product-brain" as KnowledgeCategory, capabilities: ["analyze-economics", "price-model"], sourceFiles: ["product-economics.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Commercial Engine
    { moduleId: "commercial-product", name: "Commercial Product Engine", version: "2.1", category: "commercial-engine" as KnowledgeCategory, capabilities: ["create-commercial", "add-pricing"], sourceFiles: ["commercial-product.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-blueprint", name: "Product Blueprint", version: "2.1", category: "commercial-engine" as KnowledgeCategory, capabilities: ["create-blueprint", "define-structure"], sourceFiles: ["product-blueprint.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-packaging", name: "Product Packaging", version: "2.1", category: "commercial-engine" as KnowledgeCategory, capabilities: ["package", "define-bundle"], sourceFiles: ["product-packaging.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "offer-architecture", name: "Offer Architecture", version: "2.1", category: "commercial-engine" as KnowledgeCategory, capabilities: ["create-offer", "define-tiers"], sourceFiles: ["offer-architecture.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Factory
    { moduleId: "book-factory", name: "Book Factory", version: "2.1", category: "product-factory" as KnowledgeCategory, capabilities: ["create-ebook", "10-step-pipeline"], sourceFiles: ["book-factory.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "pdf-factory", name: "PDF Factory", version: "2.1", category: "product-factory" as KnowledgeCategory, capabilities: ["generate-pdf", "render-pages"], sourceFiles: ["pdf-factory.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "factory-orchestrator", name: "Factory Orchestrator", version: "2.1", category: "product-factory" as KnowledgeCategory, capabilities: ["orchestrate", "coordinate-steps"], sourceFiles: ["product-factory-orchestrator.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-content-engine", name: "Content Engine", version: "2.1", category: "product-factory" as KnowledgeCategory, capabilities: ["generate-content", "expand-sections"], sourceFiles: ["product-content-engine.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // QA
    { moduleId: "product-qa", name: "Product QA", version: "2.1", category: "qa-engine" as KnowledgeCategory, capabilities: ["6-layer-qa", "validate-artifact"], sourceFiles: ["product-qa.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "visual-qa", name: "Visual QA", version: "2.1", category: "qa-engine" as KnowledgeCategory, capabilities: ["render-check", "visual-validate"], sourceFiles: ["visual-qa.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Commercial Readiness
    { moduleId: "commercial-readiness", name: "Commercial Readiness", version: "2.1", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["assess-readiness", "9-dimension-check"], sourceFiles: ["commercial-readiness.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "launch-package", name: "Launch Package", version: "2.1", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["prepare-launch", "bundle-assets"], sourceFiles: ["launch-package.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "commercial-feedback", name: "Commercial Feedback", version: "2.1", category: "commercial-readiness" as KnowledgeCategory, capabilities: ["collect-feedback", "analyze-sentiment"], sourceFiles: ["commercial-feedback.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

    // Lifecycle
    { moduleId: "product-dossier", name: "Product Dossier", version: "2.1", category: "product-lifecycle" as KnowledgeCategory, capabilities: ["create-dossier", "compile-summary"], sourceFiles: ["product-dossier.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-handoff", name: "Product Handoff", version: "2.1", category: "product-lifecycle" as KnowledgeCategory, capabilities: ["handoff", "transfer-ownership"], sourceFiles: ["product-handoff.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "product-versioning", name: "Product Versioning", version: "2.1", category: "product-lifecycle" as KnowledgeCategory, capabilities: ["version", "changelog"], sourceFiles: ["product-versioning.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },
    { moduleId: "asset-manager", name: "Asset Manager", version: "2.1", category: "product-lifecycle" as KnowledgeCategory, capabilities: ["manage-assets", "track-files"], sourceFiles: ["asset-manager.ts"], healthCheck: async () => ({ status: "AVAILABLE" }) },

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

  for (const module of modules) {
    knowledgeRegistry.register(module);
  }
}
