/**
 * Product Specification Engine — KREA V2 Product Brain
 *
 * Converts product architecture into executable specifications:
 *   - Constructor-independent specification (AC-016)
 *   - Software specification for Codex/Antigravity (AC-017)
 *   - Handoff contracts for agent delegation (AC-019)
 *
 * Acceptance Criteria satisfied:
 *   AC-016: Constructor-independent specification — describes WHAT, not HOW
 *   AC-017: Software specification ready for Codex/Antigravity consumption
 *   AC-018: Handoff is reproducible — receiver understands intent without guessing
 *   AC-019: Handoff contracts include all context needed for construction
 *   AC-021: Handoff includes evidence, constraints, and acceptance criteria
 */

import { randomUUID } from "crypto";
import { ProductArchitecture, MoscowItem, JobToBeDone, ValidationRequirement, BuildRequirement } from "./product-architecture";
import { ProductEvidence } from "./product-intelligence";
import { ProductDecision, ConstructorSelection } from "./product-decision";
import { Opportunity } from "./product-fit";

// ─── Constructor-Independent Specification (AC-016) ───────────────────────────

/** Feature specification — constructor-independent */
export interface FeatureSpec {
  /** Feature name */
  name: string;
  /** What this feature does (WHAT, not HOW) */
  description: string;
  /** User stories */
  userStories: string[];
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Priority from MoSCoW */
  priority: "MUST" | "SHOULD" | "COULD";
  /** Dependencies on other features */
  dependencies: string[];
  /** Evidence supporting this feature */
  evidenceIds: string[];
}

/** Constructor-independent product specification (AC-016) */
export interface ProductSpecification {
  /** Specification ID */
  specId: string;
  /** Product name */
  productName: string;
  /** Version */
  version: string;
  /** Problem statement */
  problem: string;
  /** Target user */
  targetUser: string;
  /** Jobs To Be Done */
  jtbd: JobToBeDone[];
  /** Desired outcome */
  desiredOutcome: string;
  /** Value proposition */
  valueProposition: string;
  /** Product format */
  format: string;
  /** Features (AC-016 — constructor-independent) */
  features: FeatureSpec[];
  /** UX description (WHAT the experience should be, not HOW to build it) */
  uxDescription: string;
  /** Differentiation */
  differentiation: string;
  /** Monetization model */
  monetization: string;
  /** MVP scope */
  mvpScope: string;
  /** Validation requirements */
  validationRequirements: ValidationRequirement[];
  /** Build requirements */
  buildRequirements: BuildRequirement[];
  /** Success criteria */
  successCriteria: string[];
  /** Risks */
  risks: string[];
  /** Assumptions */
  assumptions: string[];
  /** Unknowns */
  unknowns: string[];
  /** Evidence referenced */
  evidence: ProductEvidence[];
  /** Timestamp */
  specifiedAt: string;
}

// ─── Software Specification (AC-017) ──────────────────────────────────────────

/** Software feature with technical details */
export interface SoftwareFeature {
  /** Feature name */
  name: string;
  /** Description */
  description: string;
  /** User stories in Given/When/Then format */
  userStories: string[];
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Priority */
  priority: "MUST" | "SHOULD" | "COULD";
  /** Technical notes */
  technicalNotes: string;
  /** Dependencies */
  dependencies: string[];
}

/** Software specification ready for Codex/Antigravity (AC-017) */
export interface SoftwareSpecification {
  /** Specification identity */
  identity: {
    id: string;
    name: string;
    version: string;
    type: string;
    format: string;
  };

  /** User definition */
  user: {
    target: string;
    personas: string[];
    authentication: string;
  };

  /** Problem definition */
  problem: {
    statement: string;
    jtbd: JobToBeDone[];
    desiredOutcome: string;
  };

  /** Expected result */
  result: {
    valueProposition: string;
    differentiation: string;
    monetization: string;
    successCriteria: string[];
  };

  /** Features (AC-017) */
  features: SoftwareFeature[];

  /** UX specification */
  ux: {
    description: string;
    flows: string[];
    responsive: boolean;
    accessibility: boolean;
  };

  /** Functional requirements */
  functional_requirements: string[];

  /** Non-functional requirements */
  non_functional_requirements: string[];

  /** Design direction */
  design: {
    style: string;
    colorSystem: string;
    componentLibrary: string;
    layoutPrinciples: string[];
  };

  /** Data model */
  data: {
    entities: string[];
    relationships: string[];
    storageRequirements: string;
  };

  /** Integrations */
  integrations: string[];

  /** Security requirements */
  security: {
    authentication: string;
    authorization: string;
    dataProtection: string;
    compliance: string[];
  };

  /** Permissions model */
  permissions: string[];

  /** Error handling */
  errors: string[];

  /** Acceptance criteria */
  acceptance_criteria: string[];

  /** Dependencies */
  dependencies: string[];

  /** Constraints */
  constraints: string[];

  /** Risks */
  risks: string[];

  /** Unknowns */
  unknowns: string[];

  /** Timestamp */
  specifiedAt: string;
}

// ─── Handoff Contract (AC-018, AC-019, AC-021) ────────────────────────────────

/** Autonomy level for the receiving agent */
export type AutonomyLevel = "full" | "guided" | "supervised" | "approval_required";

/** Approval requirement */
export interface ApprovalRequirement {
  /** What requires approval */
  what: string;
  /** Who must approve */
  approver: "krea" | "human";
  /** When approval is needed */
  trigger: "before_start" | "at_milestone" | "before_deploy" | "on_change";
}

/** Handoff contract (AC-018, AC-019, AC-021) */
export interface HandoffContract {
  /** Unique handoff identifier */
  handoff_id: string;
  /** Source agent (always KREA for product handoffs) */
  source_agent: "krea";
  /** Target agent */
  target_agent: "codex" | "antigravity" | "krea";
  /** What the target agent should accomplish */
  objective: string;
  /** Product being handed off */
  product: {
    name: string;
    version: string;
    format: string;
  };
  /** Input specification (the full spec the target receives) */
  input_specification: SoftwareSpecification | ProductSpecification;
  /** Constraints on the handoff */
  constraints: {
    /** Time constraints */
    timebox?: string;
    /** Budget constraints */
    budget?: string;
    /** Quality constraints */
    quality?: string[];
    /** Scope constraints (what NOT to do) */
    outOfScope: string[];
  };
  /** Required output from the target agent */
  required_output: {
    /** What must be delivered */
    deliverables: string[];
    /** Format of deliverables */
    format: string;
    /** Quality standards */
    qualityStandards: string[];
  };
  /** Acceptance criteria for the handoff result */
  acceptance_criteria: string[];
  /** Evidence supporting the handoff decisions (AC-021) */
  evidence: ProductEvidence[];
  /** Dependencies that must be resolved before handoff */
  dependencies: string[];
  /** Risk assessment for the handoff */
  risk: {
    level: "low" | "medium" | "high";
    factors: string[];
    mitigations: string[];
  };
  /** Autonomy level for the target agent */
  autonomy: AutonomyLevel;
  /** Approval requirements */
  approvals: ApprovalRequirement[];
  /** Handoff status */
  status: "draft" | "sent" | "acknowledged" | "in_progress" | "completed" | "failed";
  /** Timestamp */
  handedOffAt: string;
}

// ─── Product Specification Engine ─────────────────────────────────────────────

/**
 * ProductSpecificationEngine — Converts architecture into executable specifications.
 *
 * AC-016: specifyNeutral — constructor-independent, describes WHAT not HOW
 * AC-017: specifySoftware — Codex/Antigravity-ready with technical details
 * AC-019: generateHandoff — complete contract for agent delegation
 * AC-018/AC-021: Handoff is reproducible with full evidence and context
 */
export class ProductSpecificationEngine {
  /**
   * specifyNeutral — Create a constructor-independent specification.
   *
   * AC-016: This specification describes WHAT the product should do,
   * not HOW it should be built. No technology choices, no implementation
   * details — only problem, features, and acceptance criteria.
   */
  specifyNeutral(
    architecture: ProductArchitecture,
    evidence: ProductEvidence[] = [],
    opportunity?: Opportunity
  ): ProductSpecification {
    const features = this.buildNeutralFeatures(architecture);

    return {
      specId: randomUUID(),
      productName: opportunity?.name || architecture.client,
      version: "1.0.0",
      problem: architecture.problem,
      targetUser: architecture.client,
      jtbd: architecture.jtbd,
      desiredOutcome: architecture.desired_outcome,
      valueProposition: architecture.value_proposition,
      format: architecture.format,
      features,
      uxDescription: architecture.ux_description,
      differentiation: architecture.differentiation,
      monetization: architecture.monetization,
      mvpScope: architecture.mvp_definition.scope,
      validationRequirements: architecture.validation_requirements,
      buildRequirements: architecture.build_requirements,
      successCriteria: architecture.success_criteria,
      risks: architecture.risks,
      assumptions: architecture.assumptions,
      unknowns: architecture.unknowns,
      evidence,
      specifiedAt: new Date().toISOString(),
    };
  }

  /**
   * specifySoftware — Create a software-specific specification.
   *
   * AC-017: This specification is ready for consumption by Codex/Antigravity.
   * It includes technical details, data models, integration points,
   * and deployment considerations while remaining implementation-flexible.
   */
  specifySoftware(
    architecture: ProductArchitecture,
    evidence: ProductEvidence[] = [],
    opportunity?: Opportunity
  ): SoftwareSpecification {
    const productName = opportunity?.name || architecture.client;

    return {
      identity: {
        id: randomUUID(),
        name: productName,
        version: "1.0.0",
        type: this.inferProductType(architecture.format),
        format: architecture.format,
      },

      user: {
        target: architecture.client,
        personas: this.inferPersonas(architecture),
        authentication: this.inferAuthRequirement(architecture.format),
      },

      problem: {
        statement: architecture.problem,
        jtbd: architecture.jtbd,
        desiredOutcome: architecture.desired_outcome,
      },

      result: {
        valueProposition: architecture.value_proposition,
        differentiation: architecture.differentiation,
        monetization: architecture.monetization,
        successCriteria: architecture.success_criteria,
      },

      features: this.buildSoftwareFeatures(architecture),

      ux: {
        description: architecture.ux_description,
        flows: this.inferUserFlows(architecture),
        responsive: true,
        accessibility: true,
      },

      functional_requirements: this.buildFunctionalRequirements(architecture),

      non_functional_requirements: [
        "Performance: Page load < 3 seconds",
        "Availability: 99.9% uptime",
        "Scalability: Support 10x initial user growth",
        "Security: OWASP Top 10 compliance",
        "Observability: Logging, metrics, and tracing",
      ],

      design: {
        style: "Clean, modern, professional — aligned with target audience",
        colorSystem: "Tailwind CSS built-in variables with custom brand palette",
        componentLibrary: "shadcn/ui (New York style) with Lucide icons",
        layoutPrinciples: [
          "Mobile-first responsive design",
          "Consistent spacing and typography",
          "Clear visual hierarchy",
          "Accessible color contrast (WCAG 2.1 AA)",
        ],
      },

      data: {
        entities: this.inferDataEntities(architecture),
        relationships: this.inferDataRelationships(architecture),
        storageRequirements: this.inferStorageRequirements(architecture.format),
      },

      integrations: architecture.dependencies,

      security: {
        authentication: this.inferAuthRequirement(architecture.format),
        authorization: "Role-based access control (RBAC)",
        dataProtection: "Encryption at rest and in transit",
        compliance: ["GDPR", "Data minimization"],
      },

      permissions: this.inferPermissions(architecture),

      errors: [
        "Network errors: Retry with exponential backoff",
        "Validation errors: Clear field-level messages",
        "Auth errors: Redirect to login with session expiry message",
        "Rate limiting: Graceful degradation with user feedback",
        "Unexpected errors: Generic message with error ID for support",
      ],

      acceptance_criteria: architecture.success_criteria,

      dependencies: architecture.dependencies,

      constraints: [
        `Scope: MUST items only for MVP (${architecture.MUST.length} items)`,
        `Timebox: ${architecture.mvp_definition.timebox}`,
        ...architecture.OUT.map((item) => `OUT: ${item.description} — ${item.rationale}`),
      ],

      risks: architecture.risks,
      unknowns: architecture.unknowns,

      specifiedAt: new Date().toISOString(),
    };
  }

  /**
   * generateHandoff — Create a handoff contract for agent delegation.
   *
   * AC-018: Handoff is reproducible — the receiver can understand the full
   * intent without guessing, because all context is included.
   *
   * AC-019: The contract includes objective, specification, constraints,
   * required output, acceptance criteria, and evidence.
   *
   * AC-021: Evidence is included so the receiver understands WHY decisions
   * were made, not just WHAT was decided.
   */
  generateHandoff(
    specification: SoftwareSpecification | ProductSpecification,
    targetAgent: "codex" | "antigravity" | "krea",
    constructor?: ConstructorSelection,
    architecture?: ProductArchitecture,
    evidence: ProductEvidence[] = []
  ): HandoffContract {
    const productName = "productName" in specification
      ? specification.productName
      : specification.identity.name;

    const isSoftware = "identity" in specification;
    const softwareSpec = isSoftware ? specification as SoftwareSpecification : undefined;

    // Determine autonomy level based on target agent and evidence quality
    const autonomy = this.determineAutonomy(targetAgent, evidence);

    // Determine approval requirements
    const approvals = this.determineApprovals(targetAgent, autonomy);

    // Build constraints
    const outOfScope = architecture
      ? architecture.OUT.map((item) => item.description)
      : ["Features not in MUST list", "Multi-language support", "Mobile native apps"];

    return {
      handoff_id: randomUUID(),
      source_agent: "krea",
      target_agent: targetAgent,
      objective: this.buildHandoffObjective(targetAgent, productName, constructor),
      product: {
        name: productName,
        version: "1.0.0",
        format: architecture?.format || "unspecified",
      },
      input_specification: specification,
      constraints: {
        timebox: architecture?.mvp_definition.timebox || "4-6 weeks",
        quality: [
          "All acceptance criteria must pass",
          "No critical or high-severity bugs",
          "Code review completed",
        ],
        outOfScope,
      },
      required_output: {
        deliverables: this.inferDeliverables(targetAgent, architecture),
        format: this.inferOutputFormat(targetAgent),
        qualityStandards: [
          "All acceptance criteria met",
          "Test coverage >= 80%",
          "No regressions in existing functionality",
          "Documentation for all public APIs",
        ],
      },
      acceptance_criteria: architecture?.success_criteria || [
        "Product meets all MUST requirements",
        "All validation tests pass",
        "User acceptance testing completed",
      ],
      evidence,
      dependencies: architecture?.dependencies || [],
      risk: {
        level: this.assessHandoffRisk(targetAgent, evidence),
        factors: architecture?.risks || ["Unknown technical complexity"],
        mitigations: [
          "Phased delivery with milestones",
          "Regular progress check-ins",
          "Rollback plan for each phase",
        ],
      },
      autonomy,
      approvals,
      status: "draft",
      handedOffAt: new Date().toISOString(),
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  /** Build constructor-independent features from architecture (AC-016) */
  private buildNeutralFeatures(architecture: ProductArchitecture): FeatureSpec[] {
    const features: FeatureSpec[] = [];

    for (const item of architecture.MUST) {
      features.push(this.moscowToFeature(item, "MUST"));
    }
    for (const item of architecture.SHOULD) {
      features.push(this.moscowToFeature(item, "SHOULD"));
    }
    for (const item of architecture.COULD) {
      features.push(this.moscowToFeature(item, "COULD"));
    }

    return features;
  }

  /** Convert MoSCoW item to feature specification */
  private moscowToFeature(item: MoscowItem, priority: "MUST" | "SHOULD" | "COULD"): FeatureSpec {
    return {
      name: item.description.substring(0, 80),
      description: item.description,
      userStories: [`As a user, I want ${item.description.toLowerCase()} so that ${item.rationale.toLowerCase()}`],
      acceptanceCriteria: [
        `Feature "${item.description}" is fully functional`,
        `Feature passes all validation tests`,
      ],
      priority,
      dependencies: [],
      evidenceIds: item.evidenceIds,
    };
  }

  /** Build software-specific features (AC-017) */
  private buildSoftwareFeatures(architecture: ProductArchitecture): SoftwareFeature[] {
    const features: SoftwareFeature[] = [];

    const allItems = [
      ...architecture.MUST.map((i) => ({ ...i, priority: "MUST" as const })),
      ...architecture.SHOULD.map((i) => ({ ...i, priority: "SHOULD" as const })),
      ...architecture.COULD.map((i) => ({ ...i, priority: "COULD" as const })),
    ];

    for (const item of allItems) {
      features.push({
        name: item.description.substring(0, 80),
        description: item.description,
        userStories: [`Given a user in the target audience, When they need ${item.description.toLowerCase()}, Then the product provides ${item.rationale.toLowerCase()}`],
        acceptanceCriteria: [
          `Feature works end-to-end`,
          `Error handling is graceful`,
          `Feature is accessible`,
        ],
        priority: item.priority,
        technicalNotes: `Implementation approach determined by constructor. Effort: ${item.effort || "TBD"}.`,
        dependencies: [],
      });
    }

    return features;
  }

  /** Infer product type from format */
  private inferProductType(format: string): string {
    const lower = format.toLowerCase();
    if (["app", "saas", "web app", "platform"].some((f) => lower.includes(f))) return "web_application";
    if (["api", "backend", "service"].some((f) => lower.includes(f))) return "api_service";
    if (["ebook", "guide", "template"].some((f) => lower.includes(f))) return "digital_product";
    if (["course", "curso"].some((f) => lower.includes(f))) return "course";
    return "product";
  }

  /** Infer user personas from architecture */
  private inferPersonas(architecture: ProductArchitecture): string[] {
    return [
      `${architecture.client} — primary user seeking ${architecture.desired_outcome}`,
      `Evaluator — comparing solutions before adopting`,
    ];
  }

  /** Infer authentication requirement */
  private inferAuthRequirement(format: string): string {
    const lower = format.toLowerCase();
    if (["ebook", "guide", "template", "course"].some((f) => lower.includes(f))) {
      return "Email-based or social login for purchase access";
    }
    return "NextAuth.js v4 with email + social providers";
  }

  /** Infer user flows */
  private inferUserFlows(architecture: ProductArchitecture): string[] {
    return [
      "Onboarding: Sign up → Profile setup → First value moment",
      "Core flow: Problem identification → Solution application → Result",
      "Feedback: Result review → Feedback → Iteration",
    ];
  }

  /** Build functional requirements */
  private buildFunctionalRequirements(architecture: ProductArchitecture): string[] {
    const requirements: string[] = [];

    for (const item of architecture.MUST) {
      requirements.push(`MUST: ${item.description}`);
    }
    for (const item of architecture.SHOULD) {
      requirements.push(`SHOULD: ${item.description}`);
    }

    requirements.push("User can create, read, update, and delete their own data");
    requirements.push("System provides error feedback for all invalid operations");

    return requirements;
  }

  /** Infer data entities */
  private inferDataEntities(architecture: ProductArchitecture): string[] {
    return [
      "User (profile, preferences, authentication)",
      "Product/Content (core deliverable)",
      "Session (user activity tracking)",
    ];
  }

  /** Infer data relationships */
  private inferDataRelationships(architecture: ProductArchitecture): string[] {
    return [
      "User → has many → Sessions",
      "User → owns → Product/Content",
    ];
  }

  /** Infer storage requirements */
  private inferStorageRequirements(format: string): string {
    const lower = format.toLowerCase();
    if (["app", "saas", "platform"].some((f) => lower.includes(f))) {
      return "SQLite via Prisma ORM for MVP; migrate to PostgreSQL for scale";
    }
    return "File storage for content delivery; SQLite for user data";
  }

  /** Infer permissions */
  private inferPermissions(architecture: ProductArchitecture): string[] {
    return [
      "User: read/write own data",
      "Admin: read/write all data",
      "Public: read published content only",
    ];
  }

  /** Determine autonomy level for handoff */
  private determineAutonomy(
    targetAgent: "codex" | "antigravity" | "krea",
    evidence: ProductEvidence[]
  ): AutonomyLevel {
    const avgConfidence = evidence.length > 0
      ? evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length
      : 0.3;

    if (avgConfidence >= 0.7) return "guided";
    if (avgConfidence >= 0.5) return "supervised";
    return "approval_required";
  }

  /** Determine approval requirements */
  private determineApprovals(
    targetAgent: "codex" | "antigravity" | "krea",
    autonomy: AutonomyLevel
  ): ApprovalRequirement[] {
    const approvals: ApprovalRequirement[] = [];

    approvals.push({
      what: "Architecture and tech stack decisions",
      approver: "krea",
      trigger: "before_start",
    });

    if (autonomy !== "full") {
      approvals.push({
        what: "Scope changes or additions beyond MUST items",
        approver: "krea",
        trigger: "on_change",
      });
    }

    approvals.push({
      what: "Deployment to production",
      approver: "human",
      trigger: "before_deploy",
    });

    return approvals;
  }

  /** Build handoff objective */
  private buildHandoffObjective(
    targetAgent: "codex" | "antigravity" | "krea",
    productName: string,
    constructor?: ConstructorSelection
  ): string {
    switch (targetAgent) {
      case "codex":
        return `Implement the software for "${productName}" according to the provided specification. Build all MUST items first, then SHOULD items if time permits. Follow the architecture constraints and OUT scope boundaries strictly.`;
      case "antigravity":
        return `Design and implement the UX/UI for "${productName}" according to the provided specification. Create a user experience that delivers the desired outcome for the target audience.`;
      case "krea":
        return `Produce the content for "${productName}" according to the provided specification. Create all MUST content items with evidence-backed material.`;
    }
  }

  /** Infer deliverables for target agent */
  private inferDeliverables(
    targetAgent: "codex" | "antigravity" | "krea",
    architecture?: ProductArchitecture
  ): string[] {
    switch (targetAgent) {
      case "codex":
        return [
          "Working application with all MUST features",
          "API documentation",
          "Test suite with >= 80% coverage",
          "Deployment configuration",
        ];
      case "antigravity":
        return [
          "UI component library",
          "Responsive layouts for all screens",
          "Interactive prototypes",
          "Design system documentation",
        ];
      case "krea":
        return architecture?.MUST.map((m) => m.description) || ["Complete product content"];
    }
  }

  /** Infer output format */
  private inferOutputFormat(targetAgent: "codex" | "antigravity" | "krea"): string {
    switch (targetAgent) {
      case "codex": return "Next.js application with TypeScript, deployable to Vercel";
      case "antigravity": return "Figma design system + React component library";
      case "krea": return "Structured content in product-specific format";
    }
  }

  /** Assess handoff risk level */
  private assessHandoffRisk(
    targetAgent: "codex" | "antigravity" | "krea",
    evidence: ProductEvidence[]
  ): "low" | "medium" | "high" {
    const avgConfidence = evidence.length > 0
      ? evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length
      : 0.3;

    if (avgConfidence >= 0.7) return "low";
    if (avgConfidence >= 0.4) return "medium";
    return "high";
  }
}
