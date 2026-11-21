/**
 * Product Blueprint — KREA V2.1
 *
 * The contract between Product Brain and Product Factory.
 * Transforms a CommercialProduct + Architecture into a production-ready
 * blueprint that specifies exactly what needs to be built, to what quality,
 * and with what success criteria.
 *
 * This is the handoff document: once a blueprint is created and validated,
 * the Product Factory can execute against it without needing to revisit
 * the Product Brain.
 *
 * CRITICAL RULES:
 * - All requirements must be traceable to commercial product or architecture
 * - MUST requirements must be achievable (no aspirational MUSTs)
 * - Quality requirements must have measurable criteria
 * - Structure derived from architecture chapters/sections
 * - Never add requirements that have no commercial justification
 */

import type { EvidenceTag } from "@/lib/product-fit";
import type { RiskFactor } from "@/lib/product-economics";
import type {
  CommercialProduct,
  CustomerProfile,
  ProductType,
} from "@/lib/commercial-product";
import type {
  ProductArchitecture,
  BookArchitecture,
  ChapterOutline,
} from "@/lib/product-architecture";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BlueprintStructure {
  sections: SectionDef[];
  totalEstimatedWords: number;
  totalEstimatedPages: number;
  formatSpec: string;
}

export interface SectionDef {
  id: string;
  title: string;
  type: "chapter" | "appendix" | "front_matter" | "back_matter" | "bonus";
  order: number;
  estimatedWords: number;
  requirements: string[];
}

export interface ContentRequirement {
  id: string;
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
  status: "PENDING" | "IN_PROGRESS" | "MET" | "NOT_MET";
}

export interface DesignRequirement {
  id: string;
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
}

export interface AssetRequirement {
  id: string;
  type: string;
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
}

export interface CommercialRequirement {
  id: string;
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
}

export interface QualityRequirement {
  id: string;
  description: string;
  criterion: string;
  threshold: string;
}

export interface DeliveryRequirement {
  id: string;
  description: string;
  format: string;
}

export interface SuccessCriterion {
  id: string;
  description: string;
  measurable: boolean;
  metric: string;
  target: string;
}

export interface ProductBlueprint {
  blueprintId: string;
  productId: string;
  version: string;
  type: ProductType;
  customer: CustomerProfile;
  problem: string;
  jobToBeDone: string;
  desiredOutcome: string;
  valueProposition: string;
  format: string;
  structure: BlueprintStructure;
  contentRequirements: ContentRequirement[];
  designRequirements: DesignRequirement[];
  assetRequirements: AssetRequirement[];
  commercialRequirements: CommercialRequirement[];
  qualityRequirements: QualityRequirement[];
  deliveryRequirements: DeliveryRequirement[];
  successCriteria: SuccessCriterion[];
  assumptions: string[];
  risks: RiskFactor[];
  evidence: EvidenceTag;
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WORDS_PER_PAGE = 250; // Standard estimate for formatted documents

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a Product Blueprint from a Commercial Product and Architecture.
 *
 * This is the contract between Product Brain and Product Factory.
 * The blueprint specifies:
 * - Structure: what sections/chapters/components exist
 * - Content requirements: what content must be created
 * - Design requirements: visual/design specifications
 * - Asset requirements: what assets need to be created/sourced
 * - Commercial requirements: what's needed for the commercial offer
 * - Quality requirements: acceptance criteria from specification
 * - Delivery requirements: format and delivery specifications
 * - Success criteria: measurable outcomes
 */
export function createBlueprint(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): ProductBlueprint {
  const blueprintId = generateId("bp");
  const now = new Date();

  // Derive structure from architecture
  const structure = deriveStructure(commercialProduct, architecture);

  // Derive content requirements from commercial product scope
  const contentRequirements = deriveContentRequirements(commercialProduct, architecture);

  // Derive design requirements
  const designRequirements = deriveDesignRequirements(commercialProduct, architecture);

  // Derive asset requirements
  const assetRequirements = deriveAssetRequirements(commercialProduct, architecture);

  // Derive commercial requirements
  const commercialRequirements = deriveCommercialRequirements(commercialProduct);

  // Derive quality requirements from architecture constraints
  const qualityRequirements = deriveQualityRequirements(commercialProduct, architecture);

  // Derive delivery requirements
  const deliveryRequirements = deriveDeliveryRequirements(commercialProduct, architecture);

  // Derive success criteria
  const successCriteria = deriveSuccessCriteria(commercialProduct, architecture);

  return {
    blueprintId,
    productId: commercialProduct.productId,
    version: commercialProduct.productVersion,
    type: commercialProduct.productType,
    customer: commercialProduct.targetCustomer,
    problem: commercialProduct.problem,
    jobToBeDone: commercialProduct.jobToBeDone,
    desiredOutcome: commercialProduct.desiredOutcome,
    valueProposition: commercialProduct.valueProposition,
    format: commercialProduct.format,
    structure,
    contentRequirements,
    designRequirements,
    assetRequirements,
    commercialRequirements,
    qualityRequirements,
    deliveryRequirements,
    successCriteria,
    assumptions: commercialProduct.assumptions,
    risks: commercialProduct.risks,
    evidence: commercialProduct.evidence,
    provenance: `blueprint:${blueprintId}:from:${commercialProduct.provenance}`,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Validate a Product Blueprint.
 *
 * Checks:
 * - All MUST requirements are defined (not empty)
 * - Structure has at least one section
 * - Success criteria are specified
 * - Blueprint is internally consistent
 *
 * Returns { valid: boolean, errors: string[] }
 */
export function validateBlueprint(blueprint: ProductBlueprint): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check structure has sections
  if (blueprint.structure.sections.length === 0) {
    errors.push("Blueprint structure has no sections defined");
  }

  // Check sections have valid ordering
  const sectionOrders = blueprint.structure.sections.map((s) => s.order);
  const hasDuplicateOrders = new Set(sectionOrders).size !== sectionOrders.length;
  if (hasDuplicateOrders) {
    errors.push("Blueprint sections have duplicate order values");
  }

  // Check MUST content requirements are defined
  const mustContentReqs = blueprint.contentRequirements.filter(
    (r) => r.priority === "MUST"
  );
  for (const req of mustContentReqs) {
    if (!req.description || req.description.trim().length === 0) {
      errors.push(`MUST content requirement ${req.id} has no description`);
    }
  }

  // Check MUST design requirements are defined
  const mustDesignReqs = blueprint.designRequirements.filter(
    (r) => r.priority === "MUST"
  );
  for (const req of mustDesignReqs) {
    if (!req.description || req.description.trim().length === 0) {
      errors.push(`MUST design requirement ${req.id} has no description`);
    }
  }

  // Check MUST asset requirements are defined
  const mustAssetReqs = blueprint.assetRequirements.filter(
    (r) => r.priority === "MUST"
  );
  for (const req of mustAssetReqs) {
    if (!req.description || req.description.trim().length === 0) {
      errors.push(`MUST asset requirement ${req.id} has no description`);
    }
  }

  // Check MUST commercial requirements are defined
  const mustCommReqs = blueprint.commercialRequirements.filter(
    (r) => r.priority === "MUST"
  );
  for (const req of mustCommReqs) {
    if (!req.description || req.description.trim().length === 0) {
      errors.push(`MUST commercial requirement ${req.id} has no description`);
    }
  }

  // Check success criteria are specified
  if (blueprint.successCriteria.length === 0) {
    errors.push("No success criteria defined — blueprint cannot be validated");
  }

  // Check success criteria have measurable targets
  for (const criterion of blueprint.successCriteria) {
    if (criterion.measurable && (!criterion.metric || !criterion.target)) {
      errors.push(
        `Success criterion ${criterion.id} is marked measurable but has no metric or target`
      );
    }
  }

  // Check quality requirements have thresholds
  for (const req of blueprint.qualityRequirements) {
    if (!req.threshold || req.threshold.trim().length === 0) {
      errors.push(`Quality requirement ${req.id} has no threshold defined`);
    }
  }

  // Check core fields
  if (!blueprint.problem || blueprint.problem.trim().length === 0) {
    errors.push("Blueprint has no problem statement");
  }
  if (!blueprint.valueProposition || blueprint.valueProposition.trim().length === 0) {
    errors.push("Blueprint has no value proposition");
  }
  if (!blueprint.customer.description || blueprint.customer.description.trim().length === 0) {
    errors.push("Blueprint has no customer description");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ─── Derivation Functions ─────────────────────────────────────────────────────

function deriveStructure(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): BlueprintStructure {
  const sections: SectionDef[] = [];

  // Check if architecture has chapters (BookArchitecture)
  if ("chapters" in architecture && Array.isArray(architecture.chapters)) {
    const bookArch = architecture as BookArchitecture;

    // Front matter
    sections.push({
      id: generateId("sec"),
      title: "Title Page & Copyright",
      type: "front_matter",
      order: 0,
      estimatedWords: 200,
      requirements: ["Product title", "Author/creator attribution", "Copyright notice"],
    });

    sections.push({
      id: generateId("sec"),
      title: "Table of Contents",
      type: "front_matter",
      order: 1,
      estimatedWords: 100,
      requirements: ["Auto-generated from chapter structure"],
    });

    // Chapters from architecture
    for (const chapter of bookArch.chapters as ChapterOutline[]) {
      sections.push({
        id: generateId("sec"),
        title: chapter.title,
        type: "chapter",
        order: chapter.number + 1, // Offset by front matter
        estimatedWords: chapter.estimatedWords,
        requirements: chapter.keyTopics.map(
          (topic) => `Cover topic: ${topic}`
        ),
      });
    }

    // Back matter
    sections.push({
      id: generateId("sec"),
      title: "Conclusion / Next Steps",
      type: "back_matter",
      order: sections.length + 1,
      estimatedWords: 500,
      requirements: ["Summarize key takeaways", "Provide actionable next steps"],
    });

    sections.push({
      id: generateId("sec"),
      title: "About / Resources",
      type: "back_matter",
      order: sections.length + 1,
      estimatedWords: 300,
      requirements: ["Author information", "Additional resources"],
    });
  } else {
    // Non-book products: derive sections from components
    sections.push({
      id: generateId("sec"),
      title: "Introduction & Overview",
      type: "front_matter",
      order: 0,
      estimatedWords: 500,
      requirements: ["Product overview", "Purpose and audience"],
    });

    for (let i = 0; i < architecture.components.length; i++) {
      const component = architecture.components[i];
      sections.push({
        id: generateId("sec"),
        title: component.name,
        type: "chapter",
        order: i + 1,
        estimatedWords: 1000,
        requirements: [
          `Implement ${component.name}: ${component.description}`,
          ...component.dependencies.map((d) => `Depends on: ${d}`),
        ],
      });
    }

    sections.push({
      id: generateId("sec"),
      title: "Documentation & Support",
      type: "back_matter",
      order: sections.length + 1,
      estimatedWords: 500,
      requirements: ["User documentation", "Support information"],
    });
  }

  // Bonus sections from included assets
  if (commercialProduct.includedAssets.length > 0) {
    sections.push({
      id: generateId("sec"),
      title: "Bonus Materials",
      type: "bonus",
      order: sections.length + 1,
      estimatedWords: 200,
      requirements: commercialProduct.includedAssets.map(
        (asset) => `Include: ${asset}`
      ),
    });
  }

  const totalEstimatedWords = sections.reduce(
    (sum, s) => sum + s.estimatedWords,
    0
  );

  return {
    sections,
    totalEstimatedWords,
    totalEstimatedPages: Math.ceil(totalEstimatedWords / WORDS_PER_PAGE),
    formatSpec: commercialProduct.format,
  };
}

function deriveContentRequirements(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): ContentRequirement[] {
  const requirements: ContentRequirement[] = [];

  // Core content requirements from commercial product
  requirements.push({
    id: generateId("creq"),
    description: `Create content addressing: ${commercialProduct.problem}`,
    priority: "MUST",
    status: "PENDING",
  });

  requirements.push({
    id: generateId("creq"),
    description: `Deliver the job-to-be-done: ${commercialProduct.jobToBeDone}`,
    priority: "MUST",
    status: "PENDING",
  });

  // Key benefits as content requirements
  for (const benefit of commercialProduct.keyBenefits) {
    requirements.push({
      id: generateId("creq"),
      description: `Content must demonstrate benefit: ${benefit}`,
      priority: "MUST",
      status: "PENDING",
    });
  }

  // Address each objection
  for (const objection of commercialProduct.objections) {
    requirements.push({
      id: generateId("creq"),
      description: `Address objection: ${objection}`,
      priority: "SHOULD",
      status: "PENDING",
    });
  }

  // Architecture-based content requirements
  for (const component of architecture.components) {
    requirements.push({
      id: generateId("creq"),
      description: `Content for component: ${component.name} — ${component.description}`,
      priority: "SHOULD",
      status: "PENDING",
    });
  }

  return requirements;
}

function deriveDesignRequirements(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): DesignRequirement[] {
  const requirements: DesignRequirement[] = [];

  // Core design requirements
  requirements.push({
    id: generateId("dreq"),
    description: "Professional, clean layout consistent with product positioning",
    priority: "MUST",
  });

  requirements.push({
    id: generateId("dreq"),
    description: `Design supports format: ${commercialProduct.format}`,
    priority: "MUST",
  });

  // Typography and readability
  requirements.push({
    id: generateId("dreq"),
    description: "Readable typography with appropriate hierarchy",
    priority: "MUST",
  });

  // Brand/visual identity
  if (commercialProduct.positioning) {
    requirements.push({
      id: generateId("dreq"),
      description: `Visual design reflects positioning: ${commercialProduct.positioning.substring(0, 100)}`,
      priority: "SHOULD",
    });
  }

  // Art direction from book architecture
  if ("artDirection" in architecture && typeof architecture.artDirection === "string") {
    requirements.push({
      id: generateId("dreq"),
      description: `Art direction: ${architecture.artDirection}`,
      priority: "SHOULD",
    });
  }

  // Cover design for ebooks/guides
  if (
    commercialProduct.productType === "ebook" ||
    commercialProduct.productType === "guide" ||
    commercialProduct.productType === "manual"
  ) {
    requirements.push({
      id: generateId("dreq"),
      description: "Professional cover design that communicates value proposition",
      priority: "MUST",
    });
  }

  return requirements;
}

function deriveAssetRequirements(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): AssetRequirement[] {
  const requirements: AssetRequirement[] = [];

  // Core product asset
  requirements.push({
    id: generateId("areq"),
    type: "primary",
    description: `Main product deliverable in ${commercialProduct.format} format`,
    priority: "MUST",
  });

  // Included assets from commercial product
  for (const asset of commercialProduct.includedAssets) {
    requirements.push({
      id: generateId("areq"),
      type: "included",
      description: asset,
      priority: "MUST",
    });
  }

  // Cover image for content products
  if (
    commercialProduct.productType === "ebook" ||
    commercialProduct.productType === "guide" ||
    commercialProduct.productType === "manual" ||
    commercialProduct.productType === "workbook"
  ) {
    requirements.push({
      id: generateId("areq"),
      type: "cover",
      description: "Product cover image/design",
      priority: "MUST",
    });
  }

  // Proof assets
  for (const proof of commercialProduct.proofRequirements) {
    if (proof.status === "MISSING") {
      requirements.push({
        id: generateId("areq"),
        type: proof.type,
        description: `Proof asset: ${proof.description}`,
        priority: "SHOULD",
      });
    }
  }

  return requirements;
}

function deriveCommercialRequirements(
  commercialProduct: CommercialProduct
): CommercialRequirement[] {
  const requirements: CommercialRequirement[] = [];

  // Core commercial requirements
  requirements.push({
    id: generateId("cmreq"),
    description: `Product priced within $${commercialProduct.priceRange.min}-$${commercialProduct.priceRange.max} range`,
    priority: "MUST",
  });

  requirements.push({
    id: generateId("cmreq"),
    description: `Delivery via: ${commercialProduct.distributionStrategy}`,
    priority: "MUST",
  });

  requirements.push({
    id: generateId("cmreq"),
    description: `Monetization model: ${commercialProduct.monetizationModel}`,
    priority: "MUST",
  });

  // Proof requirements for commercial viability
  const availableProofs = commercialProduct.proofRequirements.filter(
    (p) => p.status === "AVAILABLE"
  );
  if (availableProofs.length === 0) {
    requirements.push({
      id: generateId("cmreq"),
      description: "At least one proof element (testimonial, sample, demo) must be available for launch",
      priority: "MUST",
    });
  }

  // Objection handling
  if (commercialProduct.objections.length > 0) {
    requirements.push({
      id: generateId("cmreq"),
      description: `Sales/marketing content must address ${commercialProduct.objections.length} key objections`,
      priority: "SHOULD",
    });
  }

  return requirements;
}

function deriveQualityRequirements(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): QualityRequirement[] {
  const requirements: QualityRequirement[] = [];

  // Core quality requirements
  requirements.push({
    id: generateId("qreq"),
    description: "Content accuracy and factual correctness",
    criterion: "All claims are accurate and verifiable",
    threshold: "No unverified claims presented as facts",
  });

  requirements.push({
    id: generateId("qreq"),
    description: "Content completeness",
    criterion: "All MUST content requirements are met",
    threshold: "100% of MUST requirements status = MET",
  });

  requirements.push({
    id: generateId("qreq"),
    description: "Professional quality standard",
    criterion: "Content meets professional publishing standards",
    threshold: "No grammar errors, consistent formatting, logical structure",
  });

  // Word count quality (for content products)
  if (architecture.productType === "ebook" || architecture.productType === "guide") {
    requirements.push({
      id: generateId("qreq"),
      description: "Word count meets target",
      criterion: "Total word count within 20% of estimated target",
      threshold: `${Math.round(architecture.estimatedDuration.includes("week") ? 10000 : 5000)} words minimum`,
    });
  }

  // Format quality
  requirements.push({
    id: generateId("qreq"),
    description: "Output format quality",
    criterion: `Deliverable in ${commercialProduct.format} format renders correctly`,
    threshold: "Tested on target platforms with no rendering issues",
  });

  return requirements;
}

function deriveDeliveryRequirements(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): DeliveryRequirement[] {
  const requirements: DeliveryRequirement[] = [];

  // Primary deliverable
  requirements.push({
    id: generateId("dlreq"),
    description: "Primary product deliverable",
    format: commercialProduct.format,
  });

  // Distribution
  requirements.push({
    id: generateId("dlreq"),
    description: commercialProduct.distributionStrategy,
    format: "delivery_channel",
  });

  // Format-specific requirements
  const formats = commercialProduct.format.split("+").map((f) => f.trim());
  for (const format of formats) {
    if (format.toLowerCase().includes("pdf")) {
      requirements.push({
        id: generateId("dlreq"),
        description: "PDF version optimized for screen and print",
        format: "PDF",
      });
    }
    if (format.toLowerCase().includes("epub")) {
      requirements.push({
        id: generateId("dlreq"),
        description: "EPUB version for e-readers",
        format: "EPUB",
      });
    }
    if (format.toLowerCase().includes("zip")) {
      requirements.push({
        id: generateId("dlreq"),
        description: "ZIP archive with organized file structure",
        format: "ZIP",
      });
    }
  }

  return requirements;
}

function deriveSuccessCriteria(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): SuccessCriterion[] {
  const criteria: SuccessCriterion[] = [];

  // Core success criteria
  criteria.push({
    id: generateId("sc"),
    description: "Product delivers on value proposition",
    measurable: true,
    metric: "customer_feedback_score",
    target: "Positive feedback from target customers",
  });

  criteria.push({
    id: generateId("sc"),
    description: "All MUST requirements are met",
    measurable: true,
    metric: "must_requirements_met",
    target: "100%",
  });

  criteria.push({
    id: generateId("sc"),
    description: "Product passes quality assurance",
    measurable: true,
    metric: "qa_pass_rate",
    target: "Pass with no critical issues",
  });

  // Commercial success criteria (conservative)
  criteria.push({
    id: generateId("sc"),
    description: "Product is commercially viable at estimated price",
    measurable: false,
    metric: "break_even_analysis",
    target: "Revenue exceeds production cost within estimated timeline",
  });

  // Differentiation criterion
  criteria.push({
    id: generateId("sc"),
    description: "Product is differentiated from alternatives",
    measurable: false,
    metric: "differentiation_assessment",
    target: commercialProduct.differentiation.substring(0, 100),
  });

  return criteria;
}

// ─── Utility Functions ────────────────────────────────────────────────────────

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 10)}`;
}
