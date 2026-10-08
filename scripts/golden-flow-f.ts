/**
 * Golden Flow F: Product → Blueprint → Decision → Specification
 * KREA V2.1 Validation Script
 *
 * Executes the FULL pipeline:
 * Opportunity → Intelligence(Fit) → Decision → Architecture → Blueprint → Specification → Dossier
 *
 * Validates every step for:
 * - Schema validation (Zod)
 * - State transitions
 * - Evidence tags (VERIFIED, INFERRED, ESTIMATED, NOT_VERIFIED)
 * - Confidence scores [0,1]
 * - Provenance traceability
 * - Relationships between steps
 * - No null/undefined critical fields
 * - No placeholder data presented as real
 */

import { z } from "zod";

// ─── Import KREA modules ─────────────────────────────────────────────────────

import {
  evaluateProductFit,
  quickFitCheck,
  type ProductOpportunityInput,
  type FitScore,
  type EvidenceTag as FitEvidenceTag,
} from "../src/lib/product-fit";

import {
  makeProductDecision,
  isProceedable,
  getNextActions,
  type ProductDecision,
} from "../src/lib/product-decision";

import {
  designProductArchitecture,
  type ProductArchitecture,
  type BookArchitecture,
  type ArchitectureComponent,
} from "../src/lib/product-architecture";

import {
  createProductSpecification,
  type ProductSpecification,
  type AcceptanceCriterion,
  type ChapterSpec,
  type ModuleSpec,
} from "../src/lib/product-specification";

import {
  createBlueprint,
  validateBlueprint,
  type ProductBlueprint,
} from "../src/lib/product-blueprint";

import {
  createDossier,
  transitionDossier,
  attachOpportunity,
  attachFitScore,
  attachDecision,
  attachArchitecture,
  attachSpecification,
  getDossier,
  clearDossiers,
  getDossierCompleteness,
  getDossierSummary,
  type ProductDossierData,
  type DossierStatus,
  DossierError,
} from "../src/lib/product-dossier";

import {
  analyzeProductEconomics,
  quickEconomicsEstimate,
  calculateROI,
  calculateBreakEvenUnits,
  type ProductEconomics,
} from "../src/lib/product-economics";

import {
  createCommercialProduct,
  type CommercialProduct,
} from "../src/lib/commercial-product";

import {
  FitScoreSchema,
  ProductDecisionSchema,
  ProductArchitectureSchema,
  EvidenceTagSchema,
} from "../src/lib/schemas/product-schemas";

// ─── Report Types ────────────────────────────────────────────────────────────

interface StepResult {
  step: string;
  status: "PASS" | "FAIL" | "WARN" | "SKIP";
  durationMs: number;
  details: string;
  evidence?: string;
  errors: string[];
  warnings: string[];
}

interface ValidationReport {
  executionId: string;
  timestamp: string;
  pipeline: string;
  steps: StepResult[];
  finalState: string;
  overallResult: "PASS" | "FAIL";
  evidenceCollected: string[];
  summary: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const executionId = `gf-f_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
const results: StepResult[] = [];
const evidenceCollected: string[] = [];

function makeStep(step: string): { start: number } & Pick<StepResult, "step"> {
  return { step, start: Date.now() };
}

function recordStep(
  stepInfo: ReturnType<typeof makeStep>,
  status: StepResult["status"],
  details: string,
  errors: string[] = [],
  warnings: string[] = [],
  evidence?: string
): StepResult {
  const result: StepResult = {
    step: stepInfo.step,
    status,
    durationMs: Date.now() - stepInfo.start,
    details,
    evidence,
    errors,
    warnings,
  };
  results.push(result);
  if (evidence) evidenceCollected.push(evidence);
  console.log(
    `[${status}] ${stepInfo.step} (${result.durationMs}ms) — ${details}`
  );
  if (errors.length > 0) {
    errors.forEach((e) => console.log(`  ERROR: ${e}`));
  }
  if (warnings.length > 0) {
    warnings.forEach((w) => console.log(`  WARN: ${w}`));
  }
  return result;
}

const VALID_EVIDENCE_TAGS = new Set([
  "VERIFIED",
  "INFERRED",
  "ESTIMATED",
  "NOT_VERIFIED",
  "UNKNOWN",
]);

function validateEvidenceTag(
  tag: string,
  context: string
): string[] {
  const errors: string[] = [];
  if (!VALID_EVIDENCE_TAGS.has(tag)) {
    errors.push(`${context}: Invalid evidence tag "${tag}"`);
  }
  return errors;
}

function validateScoreRange(
  score: number,
  name: string,
  min = 0,
  max = 1
): string[] {
  const errors: string[] = [];
  if (typeof score !== "number" || isNaN(score)) {
    errors.push(`${name}: Not a number (${score})`);
  } else if (score < min || score > max) {
    errors.push(`${name}: Out of range [${min},${max}] — got ${score}`);
  }
  return errors;
}

function validateNoNullCritical(
  obj: Record<string, unknown>,
  criticalFields: string[],
  context: string
): string[] {
  const errors: string[] = [];
  for (const field of criticalFields) {
    if (obj[field] === null || obj[field] === undefined) {
      errors.push(`${context}: Critical field "${field}" is null/undefined`);
    }
  }
  return errors;
}

function validateNoPlaceholder(
  obj: Record<string, unknown>,
  fields: string[],
  context: string
): string[] {
  const warnings: string[] = [];
  const placeholderPatterns = [
    /TODO/i,
    /TBD/i,
    /PLACEHOLDER/i,
    /INSERT_/i,
    /FIXME/i,
    /xxx/i,
  ];
  for (const field of fields) {
    const val = obj[field];
    if (typeof val === "string") {
      for (const pattern of placeholderPatterns) {
        if (pattern.test(val)) {
          warnings.push(
            `${context}: Field "${field}" contains placeholder pattern "${val}"`
          );
        }
      }
    }
  }
  return warnings;
}

// ─── STEP 0: Create ProductOpportunity ──────────────────────────────────────

async function step0_CreateOpportunity(): Promise<{
  opportunity: ProductOpportunityInput;
}> {
  const s = makeStep("0_CreateProductOpportunity");

  const opportunity: ProductOpportunityInput = {
    title: "AI Writing Assistant for Spanish Content Creators",
    description:
      "An AI-powered writing assistant specifically designed for Spanish-speaking content creators, providing grammar correction, style suggestions, tone adaptation, and SEO optimization in Spanish language content.",
    targetAudience:
      "Spanish-speaking content creators, bloggers, marketers, and social media managers who create content in Spanish",
    domain: "software",
    problemStatement:
      "Spanish-speaking content creators lack AI writing tools that understand Spanish language nuances, regional dialects, and culturally appropriate tone. Existing tools are English-centric with poor Spanish support.",
    existingAlternatives: [
      "Grammarly (English-primary, limited Spanish)",
      "LanguageTool (basic Spanish grammar)",
      "ChatGPT (generic, not writing-specific)",
    ],
  };

  // Validate the opportunity input
  const errors: string[] = [];
  if (!opportunity.title || opportunity.title.trim().length < 3)
    errors.push("Title too short");
  if (!opportunity.description || opportunity.description.trim().length < 10)
    errors.push("Description too short");
  if (!opportunity.targetAudience || opportunity.targetAudience.trim().length < 3)
    errors.push("Target audience too short");
  if (
    !["ebook", "software", "saas", "guide", "template", "kit"].includes(
      opportunity.domain
    )
  )
    errors.push(`Invalid domain: ${opportunity.domain}`);
  if (!opportunity.problemStatement || opportunity.problemStatement.trim().length < 5)
    errors.push("Problem statement too short");

  const warnings = validateNoPlaceholder(
    opportunity as unknown as Record<string, unknown>,
    ["title", "description", "problemStatement"],
    "Opportunity"
  );

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Created opportunity: "${opportunity.title}" (domain: ${opportunity.domain})`,
    errors,
    warnings,
    "ESTIMATED"
  );

  return { opportunity };
}

// ─── STEP 1: Evaluate Product Fit ───────────────────────────────────────────

async function step1_EvaluateFit(
  opportunity: ProductOpportunityInput
): Promise<{ fitScore: FitScore; usedHeuristic: boolean }> {
  const s = makeStep("1_EvaluateProductFit");

  let fitScore: FitScore;
  let usedHeuristic = false;
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Try full LLM-based evaluation
    fitScore = await evaluateProductFit(opportunity);
    // If we got a fallback (overall=0), try heuristic
    if (fitScore.overall === 0 && fitScore.evidence === "NOT_VERIFIED") {
      console.log(
        "  LLM evaluation returned fallback, trying heuristic..."
      );
      fitScore = quickFitCheck(opportunity);
      usedHeuristic = true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  LLM error: ${msg}, falling back to heuristic`);
    fitScore = quickFitCheck(opportunity);
    usedHeuristic = true;
    warnings.push(`LLM unavailable, using heuristic: ${msg}`);
  }

  // ─── Validations ─────────────────────────────────────────────────────

  // Schema validation with Zod
  const schemaResult = FitScoreSchema.safeParse(fitScore);
  if (!schemaResult.success) {
    const schemaErrors = schemaResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    errors.push(`FitScore schema validation failed: ${schemaErrors}`);
  }

  // Score range validation
  for (const [name, val] of Object.entries({
    overall: fitScore.overall,
    marketExistence: fitScore.marketExistence,
    audienceClarity: fitScore.audienceClarity,
    problemValidity: fitScore.problemValidity,
    differentiation: fitScore.differentiation,
    feasibility: fitScore.feasibility,
  })) {
    errors.push(...validateScoreRange(val, `FitScore.${name}`));
  }

  // Evidence tag validation
  errors.push(...validateEvidenceTag(fitScore.evidence, "FitScore.evidence"));

  // Recommendation validation
  if (
    !["PROCEED", "EXPLORE", "SKIP", "RESEARCH_MORE"].includes(
      fitScore.recommendation
    )
  ) {
    errors.push(`Invalid recommendation: ${fitScore.recommendation}`);
  }

  // Reasoning validation
  if (!fitScore.reasoning || fitScore.reasoning.trim().length < 10) {
    errors.push("Reasoning is too short or empty");
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      fitScore as unknown as Record<string, unknown>,
      [
        "overall",
        "marketExistence",
        "audienceClarity",
        "problemValidity",
        "differentiation",
        "feasibility",
        "evidence",
        "recommendation",
        "reasoning",
      ],
      "FitScore"
    )
  );

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      fitScore as unknown as Record<string, unknown>,
      ["reasoning"],
      "FitScore"
    )
  );

  const method = usedHeuristic ? "heuristic" : "LLM";
  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `FitScore: overall=${fitScore.overall}, recommendation=${fitScore.recommendation} [${method}], evidence=${fitScore.evidence}`,
    errors,
    warnings,
    fitScore.evidence
  );

  return { fitScore, usedHeuristic };
}

// ─── STEP 2: Make Product Decision ──────────────────────────────────────────

async function step2_MakeDecision(
  fitScore: FitScore
): Promise<ProductDecision> {
  const s = makeStep("2_MakeProductDecision");

  const errors: string[] = [];
  const warnings: string[] = [];

  // Decision is deterministic — no LLM call
  const decision = makeProductDecision(fitScore);

  // ─── Validations ─────────────────────────────────────────────

  // Schema validation
  const schemaResult = ProductDecisionSchema.safeParse(decision);
  if (!schemaResult.success) {
    const schemaErrors = schemaResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    errors.push(`ProductDecision schema validation failed: ${schemaErrors}`);
  }

  // Decision value validation
  if (!["GO", "NO_GO", "CONDITIONAL_GO"].includes(decision.decision)) {
    errors.push(`Invalid decision: ${decision.decision}`);
  }

  // Risk level validation
  if (!["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(decision.riskLevel)) {
    errors.push(`Invalid riskLevel: ${decision.riskLevel}`);
  }

  // Evidence inherits from FitScore
  errors.push(
    ...validateEvidenceTag(decision.evidence, "Decision.evidence")
  );
  if (decision.evidence !== fitScore.evidence) {
    warnings.push(
      `Decision evidence (${decision.evidence}) differs from FitScore evidence (${fitScore.evidence})`
    );
  }

  // FitScore reference — must be the same object
  if (decision.fitScore !== fitScore) {
    errors.push("Decision.fitScore does not reference the input FitScore");
  }

  // Rationale must be non-trivial
  if (!decision.rationale || decision.rationale.trim().length < 10) {
    errors.push("Rationale is too short or empty");
  }

  // Conditions for CONDITIONAL_GO
  if (decision.decision === "CONDITIONAL_GO" && decision.conditions.length === 0) {
    warnings.push("CONDITIONAL_GO decision has no conditions specified");
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      decision as unknown as Record<string, unknown>,
      ["decision", "rationale", "fitScore", "riskLevel", "estimatedEffort", "evidence"],
      "Decision"
    )
  );

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      decision as unknown as Record<string, unknown>,
      ["rationale", "estimatedEffort"],
      "Decision"
    )
  );

  // Verify isProceedable consistency
  const proceedable = isProceedable(decision);
  const expectedProceedable =
    decision.decision === "GO" || decision.decision === "CONDITIONAL_GO";
  if (proceedable !== expectedProceedable) {
    errors.push(
      `isProceedable()=${proceedable} inconsistent with decision=${decision.decision}`
    );
  }

  // Verify getNextActions returns actions
  const nextActions = getNextActions(decision);
  if (nextActions.length === 0) {
    warnings.push("getNextActions() returned no actions");
  }

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Decision: ${decision.decision}, risk=${decision.riskLevel}, effort="${decision.estimatedEffort}", proceedable=${proceedable}, evidence=${decision.evidence}`,
    errors,
    warnings,
    decision.evidence
  );

  return decision;
}

// ─── STEP 3: Design Product Architecture ────────────────────────────────────

async function step3_DesignArchitecture(
  opportunity: ProductOpportunityInput,
  fitScore: FitScore
): Promise<ProductArchitecture> {
  const s = makeStep("3_DesignProductArchitecture");

  const errors: string[] = [];
  const warnings: string[] = [];

  let architecture: ProductArchitecture;

  try {
    architecture = await designProductArchitecture(
      opportunity.domain,
      opportunity.title,
      opportunity.description,
      fitScore,
      `Target audience: ${opportunity.targetAudience}. Problem: ${opportunity.problemStatement}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Architecture design failed: ${msg}`);
    // Create a minimal valid fallback architecture
    architecture = {
      productType: opportunity.domain as ProductArchitecture["productType"],
      architecture: `Fallback: ${opportunity.title}`,
      components: [
        {
          name: "Core",
          type: "module",
          description: "Core component",
          dependencies: [],
        },
      ],
      dependencies: [],
      constraints: [`Fallback due to error: ${msg}`],
      estimatedDuration: "Unknown",
      technologyStack: [],
      evidence: "NOT_VERIFIED",
    };
    warnings.push("Using fallback architecture");
  }

  // ─── Validations ─────────────────────────────────────────────

  // Schema validation
  const schemaResult = ProductArchitectureSchema.safeParse(architecture);
  if (!schemaResult.success) {
    const schemaErrors = schemaResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    errors.push(
      `ProductArchitecture schema validation failed: ${schemaErrors}`
    );
  }

  // Product type validation
  if (
    !["ebook", "software", "saas", "guide", "template", "kit"].includes(
      architecture.productType
    )
  ) {
    errors.push(`Invalid productType: ${architecture.productType}`);
  }

  // Evidence tag
  errors.push(
    ...validateEvidenceTag(architecture.evidence, "Architecture.evidence")
  );

  // Components validation
  if (!Array.isArray(architecture.components)) {
    errors.push("Architecture.components is not an array");
  } else {
    for (let i = 0; i < architecture.components.length; i++) {
      const comp = architecture.components[i];
      if (!comp.name) errors.push(`Component[${i}]: missing name`);
      if (!comp.type) errors.push(`Component[${i}]: missing type`);
      if (!comp.description)
        errors.push(`Component[${i}]: missing description`);
      if (!Array.isArray(comp.dependencies))
        errors.push(`Component[${i}]: dependencies not array`);
    }
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      architecture as unknown as Record<string, unknown>,
      [
        "productType",
        "architecture",
        "components",
        "dependencies",
        "constraints",
        "estimatedDuration",
        "technologyStack",
        "evidence",
      ],
      "Architecture"
    )
  );

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      architecture as unknown as Record<string, unknown>,
      ["architecture", "estimatedDuration"],
      "Architecture"
    )
  );

  // FitScore should be referenced in constraints
  const fitScoreInConstraints = architecture.constraints.some(
    (c) => c.includes("Fit score") || c.includes("fit score")
  );
  if (!fitScoreInConstraints && architecture.evidence !== "NOT_VERIFIED") {
    warnings.push(
      "Architecture constraints do not reference FitScore (breaks provenance chain)"
    );
  }

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Architecture: type=${architecture.productType}, components=${architecture.components.length}, evidence=${architecture.evidence}`,
    errors,
    warnings,
    architecture.evidence
  );

  return architecture;
}

// ─── STEP 4: Analyze Product Economics ──────────────────────────────────────

async function step4_AnalyzeEconomics(
  architecture: ProductArchitecture
): Promise<ProductEconomics> {
  const s = makeStep("4_AnalyzeProductEconomics");

  const errors: string[] = [];
  const warnings: string[] = [];

  let economics: ProductEconomics;
  const productId = `econ_test_${Date.now().toString(36)}`;

  try {
    economics = await analyzeProductEconomics(productId, architecture);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    warnings.push(`LLM economics failed: ${msg}, using heuristic`);
    economics = quickEconomicsEstimate(productId, architecture.productType);
  }

  // ─── Validations ─────────────────────────────────────────────

  // Evidence tags — must NEVER be VERIFIED for market data
  errors.push(
    ...validateEvidenceTag(economics.evidence, "Economics.evidence")
  );
  errors.push(
    ...validateEvidenceTag(
      economics.estimatedCost.evidence,
      "Economics.estimatedCost.evidence"
    )
  );
  errors.push(
    ...validateEvidenceTag(
      economics.estimatedRevenue.evidence,
      "Economics.estimatedRevenue.evidence"
    )
  );

  // Critical rule: market estimates must NEVER be VERIFIED
  if (economics.estimatedCost.evidence === "VERIFIED") {
    errors.push(
      "VIOLATION: estimatedCost.evidence is VERIFIED — cost estimates must be ESTIMATED or INFERRED"
    );
  }
  if (economics.estimatedRevenue.evidence === "VERIFIED") {
    errors.push(
      "VIOLATION: estimatedRevenue.evidence is VERIFIED — revenue estimates must be ESTIMATED or INFERRED"
    );
  }

  // Score range for risk factors
  for (let i = 0; i < economics.riskFactors.length; i++) {
    const rf = economics.riskFactors[i];
    errors.push(
      ...validateScoreRange(rf.probability, `RiskFactor[${i}].probability`)
    );
    errors.push(
      ...validateScoreRange(rf.impact, `RiskFactor[${i}].impact`)
    );
  }

  // Non-negative costs
  if (economics.estimatedCost.total < 0) {
    errors.push("Total cost is negative");
  }
  if (economics.estimatedRevenue.pricePerUnit <= 0) {
    errors.push("Price per unit must be positive");
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      economics as unknown as Record<string, unknown>,
      ["productId", "estimatedCost", "estimatedRevenue", "evidence"],
      "Economics"
    )
  );

  // ROI and break-even calculations
  const roi = calculateROI(economics);
  const breakEven = calculateBreakEvenUnits(economics);
  if (roi !== undefined) {
    warnings.push(`ROI: ${(roi * 100).toFixed(1)}%`);
  }
  if (breakEven !== undefined) {
    warnings.push(`Break-even: ${breakEven} units`);
  }

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Economics: cost=$${economics.estimatedCost.total}, revenue=$${economics.estimatedRevenue.estimatedTotal}, risks=${economics.riskFactors.length}, evidence=${economics.evidence}`,
    errors,
    warnings,
    economics.evidence
  );

  return economics;
}

// ─── STEP 5: Create Commercial Product ──────────────────────────────────────

async function step5_CreateCommercialProduct(
  dossier: ProductDossierData,
  architecture: ProductArchitecture,
  economics: ProductEconomics
): Promise<CommercialProduct> {
  const s = makeStep("5_CreateCommercialProduct");

  const errors: string[] = [];
  const warnings: string[] = [];

  let commercialProduct: CommercialProduct;

  try {
    commercialProduct = await createCommercialProduct(
      dossier,
      architecture,
      economics
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Commercial product creation failed: ${msg}`);
    // Cannot continue without commercial product for blueprint
    recordStep(s, "FAIL", `Failed: ${msg}`, errors, warnings);
    throw new Error(`Step 5 failed: ${msg}`);
  }

  // ─── Validations ─────────────────────────────────────────────

  // Evidence tag
  errors.push(
    ...validateEvidenceTag(
      commercialProduct.evidence,
      "CommercialProduct.evidence"
    )
  );

  // Price range evidence must be ESTIMATED (never VERIFIED for new products)
  if (commercialProduct.priceRange.evidence === "VERIFIED") {
    errors.push(
      "VIOLATION: priceRange.evidence is VERIFIED — must be ESTIMATED for new products"
    );
  }

  // Proof requirements must start as MISSING (honest default)
  const nonMissingProofs = commercialProduct.proofRequirements.filter(
    (p) => p.status !== "MISSING"
  );
  if (nonMissingProofs.length > 0) {
    warnings.push(
      `${nonMissingProofs.length} proof requirements do not start as MISSING — check honesty`
    );
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      commercialProduct as unknown as Record<string, unknown>,
      [
        "productId",
        "productType",
        "targetCustomer",
        "problem",
        "valueProposition",
        "priceRange",
        "evidence",
        "provenance",
      ],
      "CommercialProduct"
    )
  );

  // Provenance traceability
  if (!commercialProduct.provenance || commercialProduct.provenance.trim().length === 0) {
    errors.push("CommercialProduct has no provenance");
  }

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      commercialProduct as unknown as Record<string, unknown>,
      [
        "valueProposition",
        "differentiation",
        "positioning",
        "monetizationModel",
      ],
      "CommercialProduct"
    )
  );

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `CommercialProduct: type=${commercialProduct.productType}, price=$${commercialProduct.priceRange.min}-$${commercialProduct.priceRange.max}, proofs=${commercialProduct.proofRequirements.length} (${commercialProduct.proofRequirements.filter((p) => p.status === "MISSING").length} MISSING), evidence=${commercialProduct.evidence}`,
    errors,
    warnings,
    commercialProduct.evidence
  );

  return commercialProduct;
}

// ─── STEP 6: Create Product Blueprint ───────────────────────────────────────

async function step6_CreateBlueprint(
  commercialProduct: CommercialProduct,
  architecture: ProductArchitecture
): Promise<ProductBlueprint> {
  const s = makeStep("6_CreateProductBlueprint");

  const errors: string[] = [];
  const warnings: string[] = [];

  const blueprint = createBlueprint(commercialProduct, architecture);

  // ─── Validations ─────────────────────────────────────────────

  // Blueprint validation (uses built-in validator)
  const validation = validateBlueprint(blueprint);
  if (!validation.valid) {
    for (const err of validation.errors) {
      errors.push(`Blueprint validation: ${err}`);
    }
  }

  // Evidence tag
  errors.push(
    ...validateEvidenceTag(blueprint.evidence, "Blueprint.evidence")
  );

  // Blueprint references correct product
  if (blueprint.productId !== commercialProduct.productId) {
    errors.push(
      `Blueprint.productId (${blueprint.productId}) !== CommercialProduct.productId (${commercialProduct.productId})`
    );
  }

  // Structure has sections
  if (blueprint.structure.sections.length === 0) {
    errors.push("Blueprint structure has no sections");
  }

  // Success criteria exist
  if (blueprint.successCriteria.length === 0) {
    errors.push("Blueprint has no success criteria");
  }

  // All MUST content requirements have descriptions
  const mustReqs = blueprint.contentRequirements.filter(
    (r) => r.priority === "MUST"
  );
  for (const req of mustReqs) {
    if (!req.description || req.description.trim().length === 0) {
      errors.push(`MUST content requirement ${req.id} has no description`);
    }
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      blueprint as unknown as Record<string, unknown>,
      [
        "blueprintId",
        "productId",
        "version",
        "type",
        "customer",
        "problem",
        "valueProposition",
        "structure",
        "evidence",
        "provenance",
      ],
      "Blueprint"
    )
  );

  // Provenance traceability
  if (!blueprint.provenance || blueprint.provenance.trim().length === 0) {
    errors.push("Blueprint has no provenance");
  } else if (!blueprint.provenance.includes(commercialProduct.provenance)) {
    warnings.push(
      "Blueprint provenance does not reference CommercialProduct provenance (breaks chain)"
    );
  }

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      blueprint as unknown as Record<string, unknown>,
      ["problem", "valueProposition", "format"],
      "Blueprint"
    )
  );

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Blueprint: sections=${blueprint.structure.sections.length}, contentReqs=${blueprint.contentRequirements.length}, MUST=${mustReqs.length}, successCriteria=${blueprint.successCriteria.length}, evidence=${blueprint.evidence}`,
    errors,
    warnings,
    blueprint.evidence
  );

  return blueprint;
}

// ─── STEP 7: Create Product Specification ───────────────────────────────────

async function step7_CreateSpecification(
  architecture: ProductArchitecture
): Promise<ProductSpecification> {
  const s = makeStep("7_CreateProductSpecification");

  const errors: string[] = [];
  const warnings: string[] = [];

  let specification: ProductSpecification;

  try {
    specification = await createProductSpecification(architecture);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Specification creation failed: ${msg}`);
    recordStep(s, "FAIL", `Failed: ${msg}`, errors, warnings);
    throw new Error(`Step 7 failed: ${msg}`);
  }

  // ─── Validations ─────────────────────────────────────────────

  // Evidence tag
  errors.push(
    ...validateEvidenceTag(specification.evidence, "Specification.evidence")
  );

  // Must have acceptance criteria
  if (specification.acceptanceCriteria.length === 0) {
    if (specification.evidence === "NOT_VERIFIED") {
      errors.push(
        "Specification has 0 acceptance criteria with NOT_VERIFIED evidence — LLM parse failed, specification is a fallback"
      );
    } else {
      warnings.push("Specification has no acceptance criteria");
    }
  }

  // Validate acceptance criteria
  for (let i = 0; i < specification.acceptanceCriteria.length; i++) {
    const ac = specification.acceptanceCriteria[i];
    if (!ac.id) errors.push(`AC[${i}]: missing id`);
    if (!ac.description) errors.push(`AC[${i}]: missing description`);
    if (!["MUST", "SHOULD", "NICE_TO_HAVE"].includes(ac.priority))
      errors.push(`AC[${i}]: invalid priority "${ac.priority}"`);
    if (
      !["PENDING", "MET", "PARTIALLY_MET", "NOT_MET"].includes(ac.status)
    )
      errors.push(`AC[${i}]: invalid status "${ac.status}"`);
  }

  // Architecture reference
  if (specification.architecture !== architecture) {
    errors.push(
      "Specification.architecture does not reference the input architecture"
    );
  }

  // Constraints include architecture constraints
  const archConstraintsIncluded = architecture.constraints.every((c) =>
    specification.constraints.includes(c)
  );
  if (!archConstraintsIncluded && architecture.constraints.length > 0) {
    warnings.push(
      "Specification constraints do not include all architecture constraints"
    );
  }

  // No null critical fields
  errors.push(
    ...validateNoNullCritical(
      specification as unknown as Record<string, unknown>,
      ["productId", "version", "architecture", "acceptanceCriteria", "constraints", "evidence"],
      "Specification"
    )
  );

  // No placeholder data
  warnings.push(
    ...validateNoPlaceholder(
      specification as unknown as Record<string, unknown>,
      ["productId", "version"],
      "Specification"
    )
  );

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Specification: productId=${specification.productId}, ACs=${specification.acceptanceCriteria.length}, MUST=${specification.acceptanceCriteria.filter((ac) => ac.priority === "MUST").length}, constraints=${specification.constraints.length}, evidence=${specification.evidence}`,
    errors,
    warnings,
    specification.evidence
  );

  return specification;
}

// ─── STEP 8: Create & Manage Dossier ────────────────────────────────────────

async function step8_CreateDossier(
  opportunity: ProductOpportunityInput,
  fitScore: FitScore,
  decision: ProductDecision,
  architecture: ProductArchitecture,
  specification: ProductSpecification
): Promise<ProductDossierData> {
  const s = makeStep("8_CreateDossier");

  const errors: string[] = [];
  const warnings: string[] = [];

  // Clear any existing dossiers
  clearDossiers();

  // Create dossier
  let dossier = createDossier({
    userId: "golden-flow-f",
    title: opportunity.title,
    description: opportunity.description,
    domain: opportunity.domain,
    opportunity,
  });

  // ─── Validate dossier creation ────────────────────────────────

  if (!dossier.dossierId) errors.push("Missing dossierId");
  if (dossier.status !== "IDEA")
    errors.push(`Expected status IDEA, got ${dossier.status}`);
  if (dossier.userId !== "golden-flow-f")
    errors.push("userId mismatch");
  if (!dossier.timeline || dossier.timeline.length === 0)
    errors.push("No timeline entries");

  // ─── State transitions ────────────────────────────────────────

  const validTransitions: Array<[DossierStatus, DossierStatus, string]> = [
    ["IDEA", "RESEARCHING", "Begin research"],
    ["RESEARCHING", "EVALUATING", "Begin evaluation"],
    ["EVALUATING", "DECIDING", "Begin decision"],
    ["DECIDING", "ARCHITECTING", "Begin architecture"],
    ["ARCHITECTING", "SPECIFYING", "Begin specification"],
  ];

  for (const [from, to, action] of validTransitions) {
    if (dossier.status !== from) {
      errors.push(`Expected status ${from} before transitioning to ${to}, got ${dossier.status}`);
      break;
    }
    try {
      dossier = transitionDossier(dossier.dossierId, to, action);
    } catch (err) {
      errors.push(
        `Transition ${from}→${to} failed: ${err instanceof Error ? err.message : String(err)}`
      );
      break;
    }
  }

  // ─── Attach artifacts ─────────────────────────────────────────

  // Attach fit score
  try {
    dossier = attachFitScore(dossier.dossierId, fitScore);
  } catch (err) {
    errors.push(
      `attachFitScore failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Attach decision
  try {
    dossier = attachDecision(dossier.dossierId, decision);
  } catch (err) {
    errors.push(
      `attachDecision failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Attach architecture
  try {
    dossier = attachArchitecture(dossier.dossierId, architecture);
  } catch (err) {
    errors.push(
      `attachArchitecture failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Attach specification
  try {
    dossier = attachSpecification(dossier.dossierId, specification);
  } catch (err) {
    errors.push(
      `attachSpecification failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // ─── Validate final dossier state ────────────────────────────

  // Check that artifacts are attached
  if (dossier.fitScore === null) errors.push("fitScore not attached");
  if (dossier.decision === null) errors.push("decision not attached");
  if (dossier.architecture === null) errors.push("architecture not attached");
  if (dossier.specification === null)
    errors.push("specification not attached");

  // Check artifacts array
  const expectedArtifactTypes = [
    "fit_score",
    "decision",
    "architecture",
    "specification",
  ];
  const actualArtifactTypes = dossier.artifacts.map((a) => a.type);
  for (const expected of expectedArtifactTypes) {
    if (!actualArtifactTypes.includes(expected)) {
      errors.push(`Missing artifact type: ${expected}`);
    }
  }

  // Check timeline length
  if (dossier.timeline.length < 5) {
    warnings.push(
      `Timeline has only ${dossier.timeline.length} entries (expected at least 5 for full flow)`
    );
  }

  // Check completeness
  const completeness = getDossierCompleteness(dossier);
  if (completeness < 50) {
    warnings.push(`Dossier completeness is only ${completeness}%`);
  }

  // Summary
  const summary = getDossierSummary(dossier);
  warnings.push(
    `Completeness: ${summary.completeness}%, Artifacts: ${summary.artifactCount}`
  );

  // Invalid transition test
  try {
    // Try an invalid transition: SPECIFYING → IDEA (not allowed)
    transitionDossier(dossier.dossierId, "IDEA", "Invalid transition test");
    errors.push("Invalid transition SPECIFYING→IDEA should have thrown");
  } catch (err) {
    if (err instanceof DossierError && err.code === "INVALID_TRANSITION") {
      // Expected
    } else {
      errors.push(
        `Wrong error type for invalid transition: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Dossier: id=${dossier.dossierId}, status=${dossier.status}, artifacts=${dossier.artifacts.length}, timeline=${dossier.timeline.length}, completeness=${completeness}%`,
    errors,
    warnings,
    dossier.fitScore?.evidence || "N/A"
  );

  return dossier;
}

// ─── STEP 9: Cross-Step Relationship Validation ─────────────────────────────

async function step9_CrossValidation(
  opportunity: ProductOpportunityInput,
  fitScore: FitScore,
  decision: ProductDecision,
  architecture: ProductArchitecture,
  blueprint: ProductBlueprint,
  specification: ProductSpecification,
  dossier: ProductDossierData
): Promise<void> {
  const s = makeStep("9_CrossStepRelationships");

  const errors: string[] = [];
  const warnings: string[] = [];

  // Decision references FitScore
  if (decision.fitScore !== fitScore) {
    errors.push("Decision does not reference the original FitScore");
  }

  // Decision evidence consistency
  if (decision.evidence !== fitScore.evidence) {
    warnings.push(
      `Evidence chain: FitScore=${fitScore.evidence} → Decision=${decision.evidence} (changed)`
    );
  }

  // Architecture references FitScore (in constraints)
  const archHasFitRef = architecture.constraints.some(
    (c) => c.includes(`${fitScore.overall}`) || c.includes("Fit score")
  );
  if (!archHasFitRef && architecture.evidence !== "NOT_VERIFIED") {
    warnings.push("Architecture does not reference FitScore in constraints");
  }

  // Specification references Architecture
  if (specification.architecture !== architecture) {
    errors.push("Specification does not reference the original Architecture");
  }

  // Blueprint references CommercialProduct (checked via productId)
  // Already validated in step 6

  // Dossier has all artifacts
  if (dossier.fitScore !== fitScore) {
    // Note: may not be same reference after store round-trip, check values
    if (dossier.fitScore?.overall !== fitScore.overall) {
      errors.push("Dossier FitScore does not match original");
    }
  }

  // Opportunity → FitScore → Decision consistency
  if (fitScore.overall >= 0.7 && decision.decision !== "GO" && decision.decision !== "CONDITIONAL_GO") {
    // This might be valid if individual scores are low, so just warn
    warnings.push(
      `FitScore overall >= 0.7 but decision is ${decision.decision} — check individual scores`
    );
  }

  // Evidence tag monotonicity — evidence should never improve without verification
  const evidenceOrder: Record<string, number> = {
    NOT_VERIFIED: 0,
    ESTIMATED: 1,
    INFERRED: 2,
    VERIFIED: 3,
    UNKNOWN: 0,
  };
  // Architecture evidence should not be stronger than FitScore evidence
  // (unless independently verified, which we can't do here)
  if (
    architecture.evidence === "VERIFIED" &&
    fitScore.evidence !== "VERIFIED"
  ) {
    errors.push(
      "Architecture claims VERIFIED evidence but FitScore is not VERIFIED — evidence inflation"
    );
  }

  // Specification evidence should not be stronger than Architecture evidence
  if (
    specification.evidence === "VERIFIED" &&
    architecture.evidence !== "VERIFIED"
  ) {
    errors.push(
      "Specification claims VERIFIED evidence but Architecture is not VERIFIED — evidence inflation"
    );
  }

  // No data fabrication: verify no field contains obviously fake data
  const fakePatterns = [
    /sample/i,
    /example\.com/i,
    /test test/i,
    /lorem ipsum/i,
    /http:\/\/localhost/i,
  ];
  const fieldsToCheck = [
    { label: "FitScore.reasoning", value: fitScore.reasoning },
    { label: "Decision.rationale", value: decision.rationale },
    { label: "Architecture.description", value: architecture.architecture },
  ];
  for (const { label, value } of fieldsToCheck) {
    for (const pattern of fakePatterns) {
      if (pattern.test(value)) {
        warnings.push(`${label} contains potential fake data pattern: ${value.substring(0, 50)}`);
      }
    }
  }

  recordStep(
    s,
    errors.length === 0 ? "PASS" : "FAIL",
    `Cross-validation: ${errors.length === 0 ? "all relationships valid" : `${errors.length} issues found`}`,
    errors,
    warnings,
    "INFERRED"
  );
}

// ─── MAIN EXECUTION ─────────────────────────────────────────────────────────

async function main() {
  console.log("═".repeat(70));
  console.log(`KREA V2.1 — Golden Flow F Validation`);
  console.log(`Execution ID: ${executionId}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log("═".repeat(70));
  console.log();

  try {
    // Step 0: Create Product Opportunity
    const { opportunity } = await step0_CreateOpportunity();
    console.log();

    // Step 1: Evaluate Product Fit
    const { fitScore } = await step1_EvaluateFit(opportunity);
    console.log();

    // Step 2: Make Product Decision
    const decision = await step2_MakeDecision(fitScore);
    console.log();

    // Step 3: Design Product Architecture
    const architecture = await step3_DesignArchitecture(opportunity, fitScore);
    console.log();

    // Step 4: Analyze Product Economics
    const economics = await step4_AnalyzeEconomics(architecture);
    console.log();

    // We need a dossier for creating commercial product
    // Create an initial dossier to pass to commercial product creation
    clearDossiers();
    const initialDossier = createDossier({
      userId: "golden-flow-f",
      title: opportunity.title,
      description: opportunity.description,
      domain: opportunity.domain,
      opportunity,
    });

    // Step 5: Create Commercial Product
    const commercialProduct = await step5_CreateCommercialProduct(
      initialDossier,
      architecture,
      economics
    );
    console.log();

    // Step 6: Create Product Blueprint
    const blueprint = await step6_CreateBlueprint(
      commercialProduct,
      architecture
    );
    console.log();

    // Step 7: Create Product Specification
    const specification = await step7_CreateSpecification(architecture);
    console.log();

    // Step 8: Create & Manage Dossier
    const dossier = await step8_CreateDossier(
      opportunity,
      fitScore,
      decision,
      architecture,
      specification
    );
    console.log();

    // Step 9: Cross-step relationship validation
    await step9_CrossValidation(
      opportunity,
      fitScore,
      decision,
      architecture,
      blueprint,
      specification,
      dossier
    );
    console.log();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\nPipeline ABORTED: ${msg}`);
    results.push({
      step: "ABORT",
      status: "FAIL",
      durationMs: 0,
      details: `Pipeline aborted: ${msg}`,
      errors: [msg],
      warnings: [],
    });
  }

  // ─── Generate Report ───────────────────────────────────────────────────

  const failCount = results.filter((r) => r.status === "FAIL").length;
  const passCount = results.filter((r) => r.status === "PASS").length;
  const warnCount = results.filter((r) => r.status === "WARN").length;
  const overall: "PASS" | "FAIL" = failCount === 0 ? "PASS" : "FAIL";

  const report: ValidationReport = {
    executionId,
    timestamp: new Date().toISOString(),
    pipeline: "Golden Flow F: Product → Blueprint → Decision → Specification",
    steps: results,
    finalState: results[results.length - 1]?.step || "UNKNOWN",
    overallResult: overall,
    evidenceCollected,
    summary: `${passCount} PASS, ${failCount} FAIL, ${warnCount} WARN across ${results.length} steps`,
  };

  console.log("═".repeat(70));
  console.log(`GOLDEN FLOW F — FINAL REPORT`);
  console.log("═".repeat(70));
  console.log(`Execution ID:  ${executionId}`);
  console.log(`Overall:       ${overall}`);
  console.log(`Summary:       ${report.summary}`);
  console.log(`Final State:   ${report.finalState}`);
  console.log();

  console.log("Step Results:");
  console.log("─".repeat(70));
  for (const step of results) {
    const icon =
      step.status === "PASS"
        ? "✅"
        : step.status === "FAIL"
        ? "❌"
        : step.status === "WARN"
        ? "⚠️"
        : "⏭️";
    console.log(
      `  ${icon} [${step.status}] ${step.step} (${step.durationMs}ms)`
    );
    console.log(`     ${step.details}`);
    if (step.evidence) console.log(`     Evidence: ${step.evidence}`);
    for (const e of step.errors) console.log(`     ERROR: ${e}`);
    for (const w of step.warnings) console.log(`     WARN: ${w}`);
  }

  console.log();
  console.log("Evidence Collected:");
  console.log("─".repeat(70));
  for (const ev of evidenceCollected) {
    console.log(`  - ${ev}`);
  }

  console.log();
  console.log("═".repeat(70));
  console.log(
    `GOLDEN FLOW F: ${overall === "PASS" ? "✅ ALL VALIDATIONS PASSED" : "❌ VALIDATION FAILURES DETECTED"}`
  );
  console.log("═".repeat(70));

  // Exit with error code if failed
  if (overall === "FAIL") {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
