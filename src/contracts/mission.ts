/**
 * Mission Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines WHAT this agent does: scope, inputs, outputs, and delegation.
 * Each item has an implementation status to enable gap analysis
 * and progressive implementation tracking.
 *
 * Derived from agent.mission.json with full TypeScript type safety.
 */

// ─── Implementation Status ──────────────────────────────────────────────────

/**
 * Implementation status for any mission item.
 * Used for gap analysis and progressive compliance tracking.
 */
export type ImplementationStatus =
  | "IMPLEMENTED"   // Fully working in production
  | "PARTIAL"       // Working but incomplete or with known gaps
  | "MISSING"       // Not implemented at all
  | "MOCKED"        // Implemented as a mock/stub for testing
  | "PLACEHOLDER"   // Defined in contract but no code exists
  | "UNKNOWN";      // Status has not been assessed

// ─── Mission Item ────────────────────────────────────────────────────────────

/** Base interface for all mission-scoped items */
export interface MissionItem {
  /** Unique identifier within the mission */
  id: string;
  /** Human-readable description */
  description: string;
  /** Current implementation status */
  status: ImplementationStatus;
  /** ISO timestamp of last status assessment */
  assessedAt?: string;
  /** Notes or evidence about the status */
  notes?: string;
}

// ─── In-Scope Item ───────────────────────────────────────────────────────────

/** An item that is within this agent's responsibility */
export interface InScopeItem extends MissionItem {
  /** Priority within scope (1 = highest) */
  priority: number;
  /** Which capability provides this (links to capability.ts) */
  capabilityId?: string;
}

// ─── Out-Of-Scope Item ──────────────────────────────────────────────────────

/** An item explicitly outside this agent's responsibility */
export interface OutOfScopeItem extends MissionItem {
  /** Reason why this is out of scope */
  reason: string;
  /** Recommended agent or service to handle this */
  delegateTo?: string;
}

// ─── Delegatable Item ────────────────────────────────────────────────────────

/** An item that can be delegated to another agent */
export interface DelegatableItem extends MissionItem {
  /** Target agent ID to delegate to */
  targetAgent: string;
  /** Communication protocol for delegation */
  protocol: "contract" | "mcp" | "api" | "event";
  /** Whether delegation is currently active */
  active: boolean;
}

// ─── Input Specification ─────────────────────────────────────────────────────

/** Accepted input specification */
export interface InputSpec extends MissionItem {
  /** Parameter name */
  param: string;
  /** Data type */
  type: "text" | "enum" | "number" | "boolean" | "object" | "file" | "url";
  /** Whether this input is required */
  required: boolean;
  /** Allowed values for enum type */
  enumValues?: string[];
  /** Default value if not provided */
  defaultValue?: string;
  /** Validation pattern or rule */
  validation?: string;
}

// ─── Output Specification ────────────────────────────────────────────────────

/** Output specification */
export interface OutputSpec extends MissionItem {
  /** Output identifier */
  outputId: string;
  /** Data format */
  format: "url" | "text" | "object" | "file" | "stream" | "base64";
  /** MIME type or content type */
  contentType?: string;
  /** Where outputs are stored */
  storagePath?: string;
}

// ─── Mission Contract ────────────────────────────────────────────────────────

/**
 * Full Mission Contract for an agent.
 * Defines scope, delegation, inputs, and outputs with implementation status.
 */
export interface MissionContract {
  /** Agent identifier (must match IdentityContract.agentId) */
  agentId: string;

  /** Contract version */
  version: string;

  /** Items within scope — what this agent is responsible for */
  inScope: InScopeItem[];

  /** Items explicitly out of scope */
  outOfScope: OutOfScopeItem[];

  /** Items that can be delegated to other agents */
  delegatable: DelegatableItem[];

  /** Accepted input specifications */
  acceptedInputs: InputSpec[];

  /** Output specifications */
  outputs: OutputSpec[];

  /** ISO timestamp of contract creation */
  createdAt: string;

  /** ISO timestamp of last update */
  updatedAt: string;
}

// ─── Mission Analysis ────────────────────────────────────────────────────────

/** Result of analyzing the mission contract for gaps */
export interface MissionAnalysis {
  /** Total items across all categories */
  totalItems: number;
  /** Count by implementation status */
  statusBreakdown: Record<ImplementationStatus, number>;
  /** Percentage of fully implemented items */
  implementationRate: number;
  /** Items that need attention (not IMPLEMENTED) */
  gaps: MissionItem[];
  /** Whether the mission is considered production-ready (>80% implemented) */
  productionReady: boolean;
}

/**
 * Analyze a MissionContract for implementation gaps and readiness.
 */
export function analyzeMission(contract: MissionContract): MissionAnalysis {
  const allItems: MissionItem[] = [
    ...contract.inScope,
    ...contract.outOfScope,
    ...contract.delegatable,
    ...contract.acceptedInputs,
    ...contract.outputs,
  ];

  const statusBreakdown: Record<ImplementationStatus, number> = {
    IMPLEMENTED: 0,
    PARTIAL: 0,
    MISSING: 0,
    MOCKED: 0,
    PLACEHOLDER: 0,
    UNKNOWN: 0,
  };

  for (const item of allItems) {
    statusBreakdown[item.status]++;
  }

  const totalItems = allItems.length;
  const implementationRate = totalItems > 0
    ? (statusBreakdown.IMPLEMENTED / totalItems) * 100
    : 0;

  const gaps = allItems.filter(
    (item) => item.status !== "IMPLEMENTED"
  );

  return {
    totalItems,
    statusBreakdown,
    implementationRate,
    gaps,
    productionReady: implementationRate >= 80,
  };
}

// ─── KREA Mission Instance ──────────────────────────────────────────────────

/**
 * The canonical Mission Contract for AGENTE-KREA.
 * Derived from agent.mission.json with full type safety and implementation status.
 */
export const KREA_MISSION: MissionContract = {
  agentId: "KREA",
  version: "2.0.0",
  inScope: [
    {
      id: "scope-opportunity-detection",
      description: "Detección y evaluación de oportunidades de producto",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "opportunity_detection",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-research",
      description: "Investigación de problemas, audiencias y demanda",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "opportunity_detection",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-fit",
      description: "Product Fit Engine — evaluar si vale la pena construir",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "product_fit_evaluation",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-decision",
      description: "Product Decision Engine — decidir qué construir y quién lo construye",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "product_decision",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-architecture",
      description: "Product Architecture — definir la arquitectura del producto",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "product_architecture",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-specification",
      description: "Product Specification — especificar el producto de forma constructor-neutral",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "product_specification",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-handoff",
      description: "Product Handoff — entregar especificación ejecutable a Codex/Antigravity",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "product_handoff",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-book-factory",
      description: "Book Factory — producir eBooks completos (arquitectura → contenido → diseño → PDF → QA)",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "book_factory",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-art-direction",
      description: "Art Direction, Cover Design, Editorial Design",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "art_direction",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-visual-qa",
      description: "Visual QA — inspeccionar artefactos antes de declararlos listos",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "visual_qa",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-economics",
      description: "Product Economics — evaluar coste, margen, viabilidad económica",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "product_economics",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-product-dossier",
      description: "Master Product Dossier — fuente de verdad persistente del producto",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "product_dossier",
      assessedAt: new Date().toISOString(),
    },
  ],
  outOfScope: [
    {
      id: "oos-software-construction",
      description: "Construcción de software (delegar a Codex/Antigravity)",
      status: "MISSING",
      reason: "Software construction is delegated to specialized builder agents",
      delegateTo: "codex",
    },
    {
      id: "oos-ide",
      description: "IDE o editor de código",
      status: "MISSING",
      reason: "Not a product architecture concern; use dedicated IDE tools",
    },
    {
      id: "oos-universal-programming",
      description: "Agente universal de programación",
      status: "MISSING",
      reason: "KREA is a product architect, not a general-purpose programmer",
    },
    {
      id: "oos-crm",
      description: "CRM y gestión de leads",
      status: "MISSING",
      reason: "Delegated to CRM-ALBRA and AGENTE-LEADS",
      delegateTo: "crm-albra",
    },
    {
      id: "oos-trading",
      description: "Trading e inversión",
      status: "MISSING",
      reason: "Completely outside product architecture domain",
    },
    {
      id: "oos-youtube-production",
      description: "Producción audiovisual completa (YOUTUBE-AUTOMATION)",
      status: "MISSING",
      reason: "Delegated to YOUTUBE-AUTOMATION for full audiovisual production",
      delegateTo: "youtube-automation",
    },
    {
      id: "oos-deployment",
      description: "Deployment e infraestructura",
      status: "MISSING",
      reason: "DevOps concern; outside product architecture scope",
    },
  ],
  delegatable: [
    {
      id: "delegate-software-construction",
      description: "Codex / Antigravity — construcción de apps, SaaS, APIs, infraestructura",
      status: "MISSING",
      targetAgent: "codex",
      protocol: "contract",
      active: true,
      notes: "Handoff contract defined; routes to Codex for software, Antigravity for infra",
    },
    {
      id: "delegate-youtube-production",
      description: "YOUTUBE-AUTOMATION — producción audiovisual",
      status: "MISSING",
      targetAgent: "youtube-automation",
      protocol: "contract",
      active: false,
    },
    {
      id: "delegate-lead-generation",
      description: "AGENTE-LEADS — generación y nurturing de leads",
      status: "MISSING",
      targetAgent: "agente-leads",
      protocol: "contract",
      active: false,
    },
    {
      id: "delegate-trend-analysis",
      description: "CHISMOSO — análisis de tendencias y señales",
      status: "PARTIAL",
      targetAgent: "chismoso",
      protocol: "event",
      active: true,
      notes: "Receives trend signals from CHISMOSO to detect product opportunities",
    },
    {
      id: "delegate-crm-operations",
      description: "CRM-ALBRA — gestión de relaciones comerciales",
      status: "MISSING",
      targetAgent: "crm-albra",
      protocol: "contract",
      active: false,
    },
  ],
  acceptedInputs: [
    {
      id: "input-opportunity-signal",
      param: "opportunity_signal",
      description: "Señal de oportunidad desde CHISMOSO, LEADS, u otra fuente",
      type: "object",
      required: false,
      status: "IMPLEMENTED",
    },
    {
      id: "input-domain",
      param: "domain",
      description: "Dominio del producto (ej. marketing, productividad, educación)",
      type: "text",
      required: true,
      status: "IMPLEMENTED",
    },
    {
      id: "input-problem",
      param: "problem",
      description: "Problema que el producto resuelve",
      type: "text",
      required: true,
      status: "IMPLEMENTED",
    },
    {
      id: "input-audience",
      param: "audience",
      description: "Audiencia objetivo del producto",
      type: "text",
      required: false,
      status: "IMPLEMENTED",
    },
    {
      id: "input-format",
      param: "format",
      description: "Formato del producto (ebook, app, saas, template, guide, hybrid)",
      type: "enum",
      required: false,
      enumValues: ["ebook", "app", "saas", "template", "guide", "hybrid"],
      status: "IMPLEMENTED",
    },
    {
      id: "input-target-constructor",
      param: "target_constructor",
      description: "Agente constructor objetivo para handoff",
      type: "enum",
      required: false,
      enumValues: ["codex", "antigravity", "krea"],
      status: "IMPLEMENTED",
    },
    {
      id: "input-agent-request",
      param: "agent_request",
      description: "Solicitud contractual de otro agente ALBRA",
      type: "object",
      required: false,
      status: "PARTIAL",
      notes: "Contract schema defined; agent-comm integration in progress",
    },
  ],
  outputs: [
    {
      id: "output-dossier",
      outputId: "product_dossier",
      description: "Master Product Dossier — fuente de verdad del producto",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-fit-result",
      outputId: "fit_result",
      description: "Resultado de evaluación Product Fit",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-decision",
      outputId: "product_decision",
      description: "Decisión de producto (construir, delegar, matar)",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-architecture",
      outputId: "product_architecture",
      description: "Arquitectura del producto definida",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-specification",
      outputId: "product_specification",
      description: "Especificación constructor-neutral del producto",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-handoff",
      outputId: "handoff_contract",
      description: "Contrato de handoff para constructor",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-ebook",
      outputId: "ebook_artifact",
      description: "eBook producido por Book Factory",
      format: "file",
      contentType: "application/pdf",
      storagePath: "public/generated/",
      status: "IMPLEMENTED",
    },
    {
      id: "output-qa-report",
      outputId: "qa_report",
      description: "Reporte de Visual QA",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-agent-response",
      outputId: "agent_response",
      description: "Respuesta contractual para otro agente",
      format: "object",
      contentType: "application/json",
      status: "PARTIAL",
      notes: "Schema defined; needs agent-comm integration",
    },
  ],
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
};
