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
  agentId: "krea",
  version: "1.0.0",
  inScope: [
    {
      id: "scope-prompt-gen",
      description: "Generación de prompts para IA visual (imágenes, video, animación, clonación)",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "prompt_generation",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-image-gen",
      description: "Generación de imágenes con IA (512x512 a 1536x1024)",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "image_generation",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-voice-gen",
      description: "Generación de voz/TTS (4 voces disponibles)",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "voice_generation",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-text-gen",
      description: "Generación de texto creativo (copy, social, email, guiones, subtítulos)",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "text_generation",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-ebook-gen",
      description: "Generación de eBooks completos en Markdown",
      status: "PARTIAL",
      priority: 3,
      capabilityId: "ebook_generation",
      notes: "Markdown generation works; PDF export needs improvement",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-campaign-metrics",
      description: "Seguimiento de métricas de campaña (ROAS, ingresos, inversión, ventas)",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "campaign_metrics",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-generation-history",
      description: "Historial de generaciones por usuario",
      status: "IMPLEMENTED",
      priority: 2,
      capabilityId: "generation_history",
      assessedAt: new Date().toISOString(),
    },
    {
      id: "scope-credit-system",
      description: "Sistema de créditos con deducción y reembolso",
      status: "IMPLEMENTED",
      priority: 1,
      capabilityId: "credit_system",
      assessedAt: new Date().toISOString(),
    },
  ],
  outOfScope: [
    {
      id: "oos-crm",
      description: "CRM y gestión de leads",
      status: "MISSING",
      reason: "Not a creative production concern; delegated to AGENTE-LEADS",
      delegateTo: "agente-leads",
    },
    {
      id: "oos-trading",
      description: "Trading e inversión",
      status: "MISSING",
      reason: "Completely outside creative domain",
    },
    {
      id: "oos-procurement",
      description: "Procurement y compras",
      status: "MISSING",
      reason: "Business operations, not creative production",
    },
    {
      id: "oos-prospecting",
      description: "Prospecting y búsqueda de clientes",
      status: "MISSING",
      reason: "Sales concern; delegated to AGENTE-LEADS",
      delegateTo: "agente-leads",
    },
    {
      id: "oos-academic",
      description: "Investigación académica",
      status: "MISSING",
      reason: "Delegated to NEX-SCOPE for research and analysis",
      delegateTo: "nex-scope",
    },
    {
      id: "oos-video-edit",
      description: "Edición de video (composición, corte, efectos)",
      status: "MISSING",
      reason: "Delegated to YOUTUBE-AUTOMATION for full audiovisual production",
      delegateTo: "youtube-automation",
    },
    {
      id: "oos-deployment",
      description: "Orquestación de deployment",
      status: "MISSING",
      reason: "DevOps concern, not creative production",
    },
    {
      id: "oos-project-mgmt",
      description: "Gestión de proyectos no-creativos",
      status: "MISSING",
      reason: "Outside creative domain",
    },
    {
      id: "oos-legal",
      description: "Análisis de documentos legales",
      status: "MISSING",
      reason: "Legal domain, delegated to NEX-SCOPE if needed",
      delegateTo: "nex-scope",
    },
  ],
  delegatable: [
    {
      id: "delegate-research",
      description: "Investigación y análisis de contexto",
      status: "PARTIAL",
      targetAgent: "nex-scope",
      protocol: "contract",
      active: true,
      notes: "Contract defined; integration not yet tested end-to-end",
    },
    {
      id: "delegate-youtube",
      description: "Producción audiovisual completa",
      status: "MISSING",
      targetAgent: "youtube-automation",
      protocol: "contract",
      active: false,
    },
    {
      id: "delegate-leads",
      description: "Generación y nurturing de leads",
      status: "MISSING",
      targetAgent: "agente-leads",
      protocol: "contract",
      active: false,
    },
    {
      id: "delegate-trends",
      description: "Análisis de tendencias y señales",
      status: "MISSING",
      targetAgent: "chismoso",
      protocol: "event",
      active: false,
    },
  ],
  acceptedInputs: [
    {
      id: "input-prompt",
      param: "prompt",
      description: "Descripción de lo que generar",
      type: "text",
      required: true,
      status: "IMPLEMENTED",
    },
    {
      id: "input-type",
      param: "type",
      description: "Categoría de generación",
      type: "enum",
      required: true,
      enumValues: ["image", "video", "voice", "text", "ebook", "prompt", "subtitle"],
      status: "IMPLEMENTED",
    },
    {
      id: "input-style",
      param: "style",
      description: "Estilo visual o tono deseado",
      type: "text",
      required: false,
      status: "IMPLEMENTED",
    },
    {
      id: "input-topic",
      param: "topic",
      description: "Tema para eBooks",
      type: "text",
      required: false,
      status: "IMPLEMENTED",
    },
    {
      id: "input-campaign-data",
      param: "campaign_data",
      description: "Métricas diarias (revenue, investment, sales)",
      type: "object",
      required: false,
      status: "IMPLEMENTED",
    },
    {
      id: "input-agent-request",
      param: "agent_request",
      description: "Solicitud contractual de otro agente ALBRA",
      type: "object",
      required: false,
      status: "PARTIAL",
      notes: "Contract schema defined but agent-comm not fully integrated",
    },
  ],
  outputs: [
    {
      id: "output-image",
      outputId: "generated_image",
      description: "PNG en public/generated/",
      format: "url",
      contentType: "image/png",
      storagePath: "public/generated/",
      status: "IMPLEMENTED",
    },
    {
      id: "output-audio",
      outputId: "generated_audio",
      description: "MP3 en public/generated/",
      format: "url",
      contentType: "audio/mpeg",
      storagePath: "public/generated/",
      status: "IMPLEMENTED",
    },
    {
      id: "output-text",
      outputId: "generated_text",
      description: "Contenido de texto o Markdown",
      format: "text",
      contentType: "text/plain",
      status: "IMPLEMENTED",
    },
    {
      id: "output-prompt",
      outputId: "generated_prompt",
      description: "Prompt optimizado para IA",
      format: "text",
      contentType: "text/plain",
      status: "IMPLEMENTED",
    },
    {
      id: "output-metrics",
      outputId: "campaign_metrics",
      description: "Métricas computadas (ROAS, profit, status)",
      format: "object",
      contentType: "application/json",
      status: "IMPLEMENTED",
    },
    {
      id: "output-record",
      outputId: "generation_record",
      description: "Registro en DB con trazabilidad",
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
