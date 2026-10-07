/**
 * Identity Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines WHO this agent is, its runtime environment, ecosystem membership,
 * and capabilities registry reference. This is the root contract that all
 * other contracts reference for agent identification.
 *
 * Evolvable: New fields can be added without breaking existing consumers.
 * All optional fields use `?` to maintain backward compatibility.
 */

// ─── Agent Status ───────────────────────────────────────────────────────────

/** Lifecycle status of the agent */
export type AgentStatus = "active" | "inactive" | "maintenance" | "degraded" | "initializing";

/** Integration protocol used for inter-agent communication */
export type IntegrationProtocol = "contract" | "mcp" | "api" | "event" | "hybrid";

/** Autonomy level identifier (see autonomy.ts for full definition) */
export type AutonomyLevelId = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

// ─── Runtime Info ───────────────────────────────────────────────────────────

/** Technical runtime environment of the agent */
export interface RuntimeInfo {
  /** Framework used (e.g., "next.js") */
  framework: string;
  /** Framework version */
  version: string;
  /** Programming language */
  language: string;
  /** Database engine */
  database: string;
  /** ORM used */
  orm: string;
  /** Node.js version if applicable */
  nodeVersion?: string;
  /** Deployment environment */
  environment?: "development" | "staging" | "production";
  /** Operating system */
  os?: string;
  /** Available memory in MB */
  memoryMb?: number;
}

// ─── Ecosystem Membership ───────────────────────────────────────────────────

/** Membership in an agent ecosystem */
export interface EcosystemMembership {
  /** Ecosystem name (e.g., "ALBRA") */
  name: string;
  /** Role within the ecosystem */
  role: "leader" | "member" | "specialist" | "observer";
  /** Other agents in the ecosystem this agent can communicate with */
  peers: string[];
  /** Protocol version for inter-agent communication */
  protocolVersion: string;
  /** Date of joining */
  joinedAt: string;
  /** Whether currently active in the ecosystem */
  active: boolean;
}

// ─── Capability Registry Reference ─────────────────────────────────────────

/** Reference to the capabilities this agent exposes */
export interface CapabilityRegistryReference {
  /** Total number of registered capabilities */
  total: number;
  /** Capability categories available */
  categories: string[];
  /** Reference to the capability registry (file path or module path) */
  registryPath: string;
  /** Last time the registry was validated */
  lastValidatedAt: string;
}

// ─── Identity Contract ──────────────────────────────────────────────────────

/**
 * Full Identity Contract for AGENTE-KREA
 *
 * This contract is the single source of truth for "who am I".
 * It must be evolvable: adding new optional fields must not break
 * any consumer that reads this contract.
 */
export interface IdentityContract {
  /** Unique agent identifier within the ecosystem */
  agentId: string;

  /** Human-readable name */
  name: string;

  /** Semantic version (MAJOR.MINOR.PATCH) */
  version: string;

  /** Domain of expertise */
  domain: string;

  /** Mission statement — what this agent exists to do */
  mission: string;

  /** Organization or entity that owns this agent */
  owner: string;

  /** Current lifecycle status */
  status: AgentStatus;

  /** Runtime technical environment */
  runtime: RuntimeInfo;

  /** Capabilities this agent provides (high-level list) */
  capabilities: string[];

  /** External providers this agent depends on */
  providers: string[];

  /** Integration protocol for inter-agent communication */
  integrationProtocol: IntegrationProtocol;

  /** Maximum autonomy level this agent can operate at */
  autonomyLevel: AutonomyLevelId;

  /** Ecosystem memberships */
  ecosystem: EcosystemMembership;

  /** Capability registry reference */
  capabilityRegistry: CapabilityRegistryReference;

  /** ISO timestamp of contract creation */
  createdAt: string;

  /** ISO timestamp of last contract update */
  updatedAt: string;

  // ─── Evolvable extensions (optional) ────────────────────────────────────

  /** Contact or responsible person/team */
  contact?: string;

  /** Documentation URL */
  documentationUrl?: string;

  /** Repository URL */
  repositoryUrl?: string;

  /** Tags for categorization and search */
  tags?: string[];

  /** Custom metadata for extensibility without breaking changes */
  metadata?: Record<string, string | number | boolean>;
}

// ─── Runtime Validation ─────────────────────────────────────────────────────

/** Validation result for an IdentityContract */
export interface IdentityValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate an IdentityContract at runtime.
 * Returns detailed errors and warnings for debugging.
 */
export function validateIdentityContract(data: unknown): IdentityValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data is not an object"], warnings: [] };
  }

  const obj = data as Record<string, unknown>;

  // Required string fields
  const requiredStrings: Array<keyof IdentityContract> = [
    "agentId", "name", "version", "domain", "mission", "owner",
  ];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || (obj[field] as string).length === 0) {
      errors.push(`Missing or empty required string field: ${field}`);
    }
  }

  // Status validation
  const validStatuses: AgentStatus[] = ["active", "inactive", "maintenance", "degraded", "initializing"];
  if (!validStatuses.includes(obj.status as AgentStatus)) {
    errors.push(`Invalid status: ${String(obj.status)}. Must be one of: ${validStatuses.join(", ")}`);
  }

  // Version format
  if (typeof obj.version === "string" && !/^\d+\.\d+\.\d+/.test(obj.version)) {
    warnings.push("Version does not follow semver format (MAJOR.MINOR.PATCH)");
  }

  // Autonomy level validation
  const validLevels: AutonomyLevelId[] = ["L0", "L1", "L2", "L3", "L4", "L5"];
  if (!validLevels.includes(obj.autonomyLevel as AutonomyLevelId)) {
    errors.push(`Invalid autonomyLevel: ${String(obj.autonomyLevel)}. Must be one of: ${validLevels.join(", ")}`);
  }

  // Capabilities array
  if (!Array.isArray(obj.capabilities)) {
    errors.push("capabilities must be an array");
  } else if (obj.capabilities.length === 0) {
    warnings.push("No capabilities registered");
  }

  // Providers array
  if (!Array.isArray(obj.providers)) {
    errors.push("providers must be an array");
  }

  // Runtime object
  if (!obj.runtime || typeof obj.runtime !== "object") {
    errors.push("runtime must be an object");
  } else {
    const rt = obj.runtime as Record<string, unknown>;
    if (typeof rt.framework !== "string") errors.push("runtime.framework must be a string");
    if (typeof rt.language !== "string") errors.push("runtime.language must be a string");
  }

  // Ecosystem object
  if (!obj.ecosystem || typeof obj.ecosystem !== "object") {
    errors.push("ecosystem must be an object");
  } else {
    const eco = obj.ecosystem as Record<string, unknown>;
    if (typeof eco.name !== "string") errors.push("ecosystem.name must be a string");
    if (!Array.isArray(eco.peers)) errors.push("ecosystem.peers must be an array");
  }

  // CapabilityRegistry object
  if (!obj.capabilityRegistry || typeof obj.capabilityRegistry !== "object") {
    errors.push("capabilityRegistry must be an object");
  } else {
    const cr = obj.capabilityRegistry as Record<string, unknown>;
    if (typeof cr.total !== "number" || cr.total < 0) errors.push("capabilityRegistry.total must be a non-negative number");
    if (!Array.isArray(cr.categories)) errors.push("capabilityRegistry.categories must be an array");
    if (typeof cr.registryPath !== "string") errors.push("capabilityRegistry.registryPath must be a string");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ─── KREA Identity Instance ─────────────────────────────────────────────────

/**
 * The canonical Identity Contract for AGENTE-KREA.
 * This is the live, runtime-constructed identity.
 * Derived from agent.identity.json but upgraded with full type safety.
 */
export const KREA_IDENTITY: IdentityContract = {
  agentId: "krea",
  name: "AGENTE-KREA",
  version: "1.0.0",
  domain: "visual_creative_production",
  mission: "Producir assets visuales y creativos mediante generación con IA, incluyendo imágenes, prompts, copy, voz, ebooks y métricas de campaña",
  owner: "ALBRA",
  status: "active",
  runtime: {
    framework: "next.js",
    version: "16.2.10",
    language: "typescript",
    database: "sqlite",
    orm: "prisma",
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
  },
  capabilities: [
    "prompt_generation",
    "image_generation",
    "voice_generation",
    "text_generation",
    "ebook_generation",
    "subtitle_generation",
    "campaign_metrics",
  ],
  providers: ["z-ai-web-dev-sdk"],
  integrationProtocol: "contract",
  autonomyLevel: "L3",
  ecosystem: {
    name: "ALBRA",
    role: "specialist",
    peers: ["nex-scope", "youtube-automation", "agente-leads", "chismoso"],
    protocolVersion: "1.0.0",
    joinedAt: "2025-01-01T00:00:00.000Z",
    active: true,
  },
  capabilityRegistry: {
    total: 7,
    categories: ["generation", "metrics", "storage"],
    registryPath: "@/contracts/capability",
    lastValidatedAt: new Date().toISOString(),
  },
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: new Date().toISOString(),
  tags: ["creative", "visual", "ai-generation", "production"],
  metadata: {
    adnVersion: "1.0",
    contractType: "identity",
  },
};
