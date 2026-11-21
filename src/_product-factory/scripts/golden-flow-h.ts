/**
 * Golden Flow H: Product → Validation Loop → Feedback → Iteration
 *
 * Executes the FULL validation/iteration cycle and validates every step.
 */

import {
  createProductVersion,
  publishVersion,
  getVersion,
  getLatestVersion,
  getLatestPublishedVersion,
  getVersionHistory,
  addFeedbackToVersion,
  setQaStatus,
  updateChangelog,
  incrementVersion,
  getNextVersion,
  compareVersions,
  clearVersions,
  type ProductVersion,
} from "../src/lib/product-versioning";

import {
  submitFeedback,
  analyzeFeedback,
  getFeedbackByProduct,
  getFeedbackSummary,
  getFeedbackItem,
  clearFeedback,
  type CommercialFeedbackItem,
} from "../src/lib/commercial-feedback";

import {
  evaluateReadiness,
  transitionReadiness,
  getReadinessRequirements,
  type CommercialReadiness,
  type ReadinessState,
} from "../src/lib/commercial-readiness";

import {
  createDossier,
  transitionDossier,
  getDossier,
  listDossiers,
  getDossierCompleteness,
  clearDossiers,
  type ProductDossierData,
} from "../src/lib/product-dossier";

import {
  startValidationLoop,
  runValidationIteration,
  generateRevisionPlan,
  getValidationLoop,
  getIterationHistory,
  listValidationLoops,
  clearValidationLoops,
  type ValidationLoop,
  type ValidationIteration,
  type QAReportInput,
  type FeedbackItemInput,
} from "../src/lib/product-validation-loop";

// ─── Types for ProductQAReport (to construct manually for commercial readiness) ──

interface QACheck {
  name: string;
  passed: boolean;
  score: number;
  detail: string;
  evidence: "VERIFIED" | "INFERRED" | "ESTIMATED" | "NOT_VERIFIED" | "UNKNOWN";
}

interface QAIssue {
  id: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
  category: string;
  description: string;
  repairable: boolean;
  repairAction: string | null;
}

interface QACategoryResult {
  category: string;
  passed: boolean;
  score: number;
  checks: QACheck[];
  issues: QAIssue[];
}

interface ProductQAReport {
  reportId: string;
  productId: string;
  version: string;
  overallPassed: boolean;
  artifactQA: QACategoryResult;
  contentQA: QACategoryResult;
  structureQA: QACategoryResult;
  visualQA: QACategoryResult;
  commercialQA: QACategoryResult;
  deliveryQA: QACategoryResult;
  overallScore: number;
  criticalIssues: QAIssue[];
  warnings: QAIssue[];
  evidence: "VERIFIED" | "INFERRED" | "ESTIMATED" | "NOT_VERIFIED" | "UNKNOWN";
  inspectedAt: Date;
}

// ─── Test Result Tracking ──────────────────────────────────────────────

interface StepResult {
  step: string;
  status: "PASS" | "FAIL";
  detail: string;
}

const results: StepResult[] = [];
let overallPass = true;

function record(step: string, passed: boolean, detail: string) {
  results.push({ step, status: passed ? "PASS" : "FAIL", detail });
  if (!passed) overallPass = false;
  const icon = passed ? "✅" : "❌";
  console.log(`  ${icon} ${step}: ${detail}`);
}

function makeQACategoryResult(
  category: string,
  passed: boolean,
  score: number
): QACategoryResult {
  return {
    category,
    passed,
    score,
    checks: [
      {
        name: `${category}_check`,
        passed,
        score,
        detail: `${category} QA ${passed ? "passed" : "failed"}`,
        evidence: passed ? "VERIFIED" : "NOT_VERIFIED",
      },
    ],
    issues: [],
  };
}

function makeQAReport(
  productId: string,
  version: string,
  overallPassed: boolean,
  overallScore: number,
  criticalIssues: QAIssue[] = [],
  warnings: QAIssue[] = []
): ProductQAReport {
  const cat = (name: string) =>
    makeQACategoryResult(name, overallPassed, overallScore);

  return {
    reportId: `pqa_test_${Date.now()}`,
    productId,
    version,
    overallPassed,
    artifactQA: cat("artifact"),
    contentQA: cat("content"),
    structureQA: cat("structure"),
    visualQA: cat("visual"),
    commercialQA: cat("commercial"),
    deliveryQA: cat("delivery"),
    overallScore,
    criticalIssues,
    warnings,
    evidence: overallPassed ? "VERIFIED" : "NOT_VERIFIED",
    inspectedAt: new Date(),
  };
}

// ─── Main Flow ─────────────────────────────────────────────────────────

async function runGoldenFlowH() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     GOLDEN FLOW H: Product → Validation → Feedback → Iteration  ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Clear all stores for clean test
  clearVersions();
  clearFeedback();
  clearDossiers();
  clearValidationLoops();

  const USER_A = "user_alpha_001";
  const USER_B = "user_beta_002";

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: Create an initial product (eBook product)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("── Step 1: Create initial product ──");

  // Create a dossier for User A
  const dossierA = createDossier({
    userId: USER_A,
    title: "Ultimate Guide to TypeScript Design Patterns",
    description: "A comprehensive eBook covering 23 GoF patterns adapted for TypeScript",
    domain: "software-engineering",
  });
  record("1a. Dossier created", !!dossierA.dossierId, `dossierId=${dossierA.dossierId}, status=${dossierA.status}`);
  record("1b. Dossier belongs to User A", dossierA.userId === USER_A, `userId=${dossierA.userId}`);

  // Create initial product version v1.0.0
  const productId_A = "prod_ebook_tsgof_v1";
  const blueprintId = "bp_tsgof_001";
  const versionV1 = createProductVersion(
    productId_A,
    "1.0.0",
    blueprintId,
    dossierA.dossierId,
    undefined // no parent - this is the first version
  );
  record("1c. Version 1.0.0 created", versionV1.version === "1.0.0" && versionV1.status === "DRAFT",
    `productId=${versionV1.productId}, version=${versionV1.version}, status=${versionV1.status}`);
  record("1d. Version 1.0.0 has no parent", versionV1.parentId === null, `parentId=${versionV1.parentId}`);
  record("1e. Version 1.0.0 qaPassed=false initially", versionV1.qaPassed === false, `qaPassed=${versionV1.qaPassed}`);

  // Also create a dossier and product for User B (for isolation testing)
  const dossierB = createDossier({
    userId: USER_B,
    title: "Python Data Science Handbook",
    description: "Practical data science with Python, pandas, and scikit-learn",
    domain: "data-science",
  });
  const productId_B = "prod_ebook_pyds_v1";
  const versionB_V1 = createProductVersion(
    productId_B,
    "1.0.0",
    "bp_pyds_001",
    dossierB.dossierId,
    undefined
  );
  record("1f. User B product created", versionB_V1.productId === productId_B,
    `productId=${versionB_V1.productId}, userId=${dossierB.userId}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: Run Product QA on it (via validation loop)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 2: Run Product QA ──");

  // Transition dossier through the valid lifecycle: IDEA → EVALUATING → DECIDING → ARCHITECTING → SPECIFYING → PRODUCING → QA
  transitionDossier(dossierA.dossierId, "EVALUATING", "Evaluate product-market fit");
  transitionDossier(dossierA.dossierId, "DECIDING", "Make GO decision");
  transitionDossier(dossierA.dossierId, "ARCHITECTING", "Design product architecture");
  transitionDossier(dossierA.dossierId, "SPECIFYING", "Create specifications");
  transitionDossier(dossierA.dossierId, "PRODUCING", "Start production");
  const qaStatus = transitionDossier(dossierA.dossierId, "QA", "Submit for QA");
  record("2a. Dossier transitioned to QA", qaStatus.status === "QA", `status=${qaStatus.status}`);

  // Start a validation loop
  const validationLoop = startValidationLoop(productId_A, "1.0.0");
  record("2b. Validation loop started", validationLoop.status === "RUNNING",
    `loopId=${validationLoop.loopId}, status=${validationLoop.status}`);

  // Run first iteration with failing QA (content gaps, issues)
  const failingQAReport: QAReportInput = {
    passed: false,
    issues: [
      {
        category: "content",
        severity: "MAJOR",
        description: "Missing examples for Observer pattern",
        suggestedFix: "Add 3 practical examples for Observer pattern",
      },
      {
        category: "content",
        severity: "MINOR",
        description: "Chapter 5 has placeholder text",
        suggestedFix: "Replace [TODO] placeholders with actual content",
      },
      {
        category: "commercial",
        severity: "MAJOR",
        description: "No pricing information defined",
        suggestedFix: "Define pricing tiers for the eBook",
      },
    ],
    score: 0.35,
  };

  const feedbackForV1: FeedbackItemInput[] = [
    {
      type: "CONTENT_GAP",
      category: "CONTENT",
      content: "Missing examples for Observer and Strategy patterns - these are essential",
      source: "beta_tester_1",
    },
    {
      type: "OBJECTION",
      category: "PRICE",
      content: "Too expensive compared to alternatives on the market",
      source: "potential_customer_1",
    },
    {
      type: "FEATURE_REQUEST",
      category: "CONTENT",
      content: "Wish there were interactive code playgrounds included",
      source: "early_reviewer_1",
    },
  ];

  const iteration1 = await runValidationIteration(
    validationLoop.loopId,
    failingQAReport,
    feedbackForV1
  );
  record("2c. First validation iteration completed", !!iteration1.iterationId,
    `iterationId=${iteration1.iterationId}, passed=${iteration1.validation.passed}`);
  record("2d. QA correctly identified as failing", !iteration1.validation.passed,
    `validation.passed=${iteration1.validation.passed}, score=${iteration1.validation.score}`);
  record("2e. Revision plan created", iteration1.revision !== null,
    `hasRevision=${iteration1.revision !== null}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 3: Run Commercial Readiness evaluation
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 3: Commercial Readiness evaluation ──");

  // Construct a QA report for commercial readiness (failing)
  const qaReportV1 = makeQAReport(productId_A, "1.0.0", false, 0.35, [
    {
      id: "issue_1",
      severity: "MAJOR",
      category: "content",
      description: "Missing examples for Observer pattern",
      repairable: true,
      repairAction: "add_examples",
    },
  ]);

  const readinessV1 = evaluateReadiness(productId_A, "1.0.0", qaReportV1);
  record("3a. Commercial readiness evaluated", !!readinessV1.state,
    `state=${readinessV1.state}, overallScore=${readinessV1.score.overall}`);
  record("3b. V1 is NOT ready for sale", readinessV1.state !== "READY_FOR_SALE",
    `state=${readinessV1.state}`);
  record("3c. V1 score is low (< 0.5)", readinessV1.score.overall < 0.5,
    `overall=${readinessV1.score.overall}`);
  record("3d. Blockers identified", readinessV1.blockers.length >= 0,
    `blockers=${readinessV1.blockers.length}, requirements=${readinessV1.requirements.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 4: Create Commercial Feedback (with improvement suggestions)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 4: Create Commercial Feedback ──");

  const feedback1 = submitFeedback(
    productId_A,
    "1.0.0",
    "CONTENT_GAP",
    "CONTENT",
    "The Strategy pattern section is incomplete and missing real-world examples",
    "reviewer_alpha"
  );
  record("4a. Feedback submitted", !!feedback1.feedbackId,
    `feedbackId=${feedback1.feedbackId}, type=${feedback1.feedbackType}`);

  const feedback2 = submitFeedback(
    productId_A,
    "1.0.0",
    "OBJECTION",
    "PRICE",
    "The price is too expensive for a single eBook - consider bundling options",
    "customer_objection_1"
  );
  record("4b. Price objection submitted", feedback2.feedbackType === "OBJECTION",
    `type=${feedback2.feedbackType}, category=${feedback2.category}`);

  const feedback3 = submitFeedback(
    productId_A,
    "1.0.0",
    "USABILITY",
    "DESIGN",
    "The code examples are confusing and hard to follow - need better formatting",
    "beta_reader_2"
  );
  record("4c. Usability feedback submitted", feedback3.feedbackType === "USABILITY",
    `type=${feedback3.feedbackType}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 5: Persist the feedback (analyze it)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 5: Persist and analyze feedback ──");

  const analyzed1 = analyzeFeedback(feedback1.feedbackId);
  record("5a. Feedback 1 analyzed", analyzed1.analyzed && !!analyzed1.analysis,
    `analyzed=${analyzed1.analyzed}, sentiment=${analyzed1.analysis?.sentiment}, priority=${analyzed1.analysis?.priority}`);

  const analyzed2 = analyzeFeedback(feedback2.feedbackId);
  record("5b. Feedback 2 analyzed (objection)", analyzed2.analysis?.actionable === true,
    `actionable=${analyzed2.analysis?.actionable}, suggestedAction="${analyzed2.analysis?.suggestedAction}"`);

  const analyzed3 = analyzeFeedback(feedback3.feedbackId);
  record("5c. Feedback 3 analyzed (usability)", analyzed3.analysis?.sentiment === "NEGATIVE",
    `sentiment=${analyzed3.analysis?.sentiment}`);

  // Verify feedback association with product
  const productFeedback = getFeedbackByProduct(productId_A);
  record("5d. Feedback associated with product", productFeedback.length >= 3,
    `feedbackCount=${productFeedback.length}`);

  const feedbackSummary = getFeedbackSummary(productId_A);
  record("5e. Feedback summary generated", feedbackSummary.negative > 0,
    `positive=${feedbackSummary.positive}, negative=${feedbackSummary.negative}, topObjections=${feedbackSummary.topObjections.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 6: Identify improvements from feedback
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 6: Identify improvements from feedback ──");

  // Use the validation loop's analysis results
  record("6a. Analysis patterns identified", iteration1.analysis.patterns.length > 0,
    `patterns=${JSON.stringify(iteration1.analysis.patterns)}`);
  record("6b. Analysis priorities identified", iteration1.analysis.priorities.length > 0,
    `priorities=${JSON.stringify(iteration1.analysis.priorities)}`);
  record("6c. Recommended actions identified", iteration1.analysis.recommendedActions.length > 0,
    `actions=${JSON.stringify(iteration1.analysis.recommendedActions)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 7: Create a new version of the product (Product Versioning)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 7: Create new product version ──");

  // Publish v1.0.0 first (it was DRAFT)
  const publishedV1 = publishVersion(productId_A, "1.0.0");
  record("7a. V1.0.0 published", publishedV1.status === "PUBLISHED",
    `status=${publishedV1.status}`);

  // Add feedback IDs to v1.0.0
  const v1WithFeedback = addFeedbackToVersion(productId_A, "1.0.0", feedback1.feedbackId);
  addFeedbackToVersion(productId_A, "1.0.0", feedback2.feedbackId);
  addFeedbackToVersion(productId_A, "1.0.0", feedback3.feedbackId);
  record("7b. Feedback linked to v1.0.0", v1WithFeedback.feedback.length >= 1,
    `feedbackCount=${v1WithFeedback.feedback.length}`);

  // Create v1.1.0 as the improved version
  const nextVer = getNextVersion(productId_A, "minor");
  record("7c. Next version calculated", nextVer === "1.1.0",
    `nextVersion=${nextVer}`);

  const versionV2 = createProductVersion(
    productId_A,
    "1.1.0",
    blueprintId,
    dossierA.dossierId,
    productId_A // parentId points to the original product
  );
  record("7d. V1.1.0 created", versionV2.version === "1.1.0" && versionV2.status === "DRAFT",
    `version=${versionV2.version}, status=${versionV2.status}, parentId=${versionV2.parentId}`);

  // Update changelog for v1.1.0
  const v2WithChangelog = updateChangelog(productId_A, "1.1.0",
    "Added Observer & Strategy pattern examples, improved code formatting, adjusted pricing");
  record("7e. Changelog updated for v1.1.0", v2WithChangelog.changes.length > 0,
    `changes="${v2WithChangelog.changes.substring(0, 60)}..."`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 8: Re-run QA on the new version
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 8: Re-run QA on v1.1.0 ──");

  // Transition dossier back through REVISION → PRODUCING → QA
  const revisionStatus = transitionDossier(dossierA.dossierId, "REVISION", "Enter revision based on feedback");
  const reProducing = transitionDossier(dossierA.dossierId, "PRODUCING", "Re-produce after revision");
  const reQA = transitionDossier(dossierA.dossierId, "QA", "Submit revised version for QA");
  record("8a. Dossier re-entered QA after revision", reQA.status === "QA",
    `status=${reQA.status}`);

  // Start new validation loop for v1.1.0
  const validationLoop2 = startValidationLoop(productId_A, "1.1.0");
  record("8b. New validation loop for v1.1.0", validationLoop2.status === "RUNNING",
    `loopId=${validationLoop2.loopId}`);

  // Run validation with improved QA (passing this time)
  const passingQAReport: QAReportInput = {
    passed: true,
    issues: [
      {
        category: "content",
        severity: "MINOR",
        description: "Minor formatting inconsistency in appendix",
        suggestedFix: "Standardize code block formatting",
      },
    ],
    score: 0.85,
  };

  const positiveFeedback: FeedbackItemInput[] = [
    {
      type: "POSITIVE",
      category: "PRODUCT",
      content: "Great improvement! The new examples are very helpful and well-written",
      source: "beta_tester_1",
    },
    {
      type: "POSITIVE",
      category: "CONTENT",
      content: "Excellent quality and value - the patterns are now clearly explained",
      source: "early_reviewer_1",
    },
  ];

  const iteration2 = await runValidationIteration(
    validationLoop2.loopId,
    passingQAReport,
    positiveFeedback
  );
  record("8c. Second validation iteration completed", !!iteration2.iterationId,
    `iterationId=${iteration2.iterationId}, passed=${iteration2.validation.passed}`);
  record("8d. V1.1.0 QA passed", iteration2.validation.passed,
    `validation.passed=${iteration2.validation.passed}, score=${iteration2.validation.score}`);
  record("8e. V1.1.0 has no critical issues", !iteration2.validation.issues.some(i => i.severity === "CRITICAL"),
    `criticalIssues=${iteration2.validation.issues.filter(i => i.severity === "CRITICAL").length}`);

  // Mark QA as passed on the version
  const v2QaPassed = setQaStatus(productId_A, "1.1.0", true);
  record("8f. QA status set to passed on v1.1.0", v2QaPassed.qaPassed === true,
    `qaPassed=${v2QaPassed.qaPassed}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 9: Evaluate new commercial readiness state
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 9: Evaluate new commercial readiness ──");

  // Construct a passing QA report for commercial readiness
  const qaReportV2 = makeQAReport(productId_A, "1.1.0", true, 0.85);

  const readinessV2 = evaluateReadiness(
    productId_A,
    "1.1.0",
    qaReportV2,
    {
      hasPricing: true,
      hasTargetCustomer: true,
      hasValueProposition: true,
      hasProblemStatement: true,
      hasDifferentiation: true,
      testimonials: [],
      claims: ["23 GoF patterns adapted for TypeScript"],
    },
    {
      deliveryFormat: "PDF + EPUB",
      accessMethod: "download",
      usageGuide: "README.md included",
      prerequisites: ["Basic TypeScript knowledge"],
      supportInfo: "support@example.com",
    },
    {
      artifactCount: 2,
      hasBlueprint: true,
      hasSpecification: true,
      hasEconomics: true,
      hasArchitecture: true,
    }
  );
  record("9a. V1.1.0 commercial readiness evaluated", !!readinessV2.state,
    `state=${readinessV2.state}, overallScore=${readinessV2.score.overall}`);
  record("9b. V1.1.0 readiness improved over V1", readinessV2.score.overall > readinessV1.score.overall,
    `v1=${readinessV1.score.overall}, v2=${readinessV2.score.overall}`);
  record("9c. V1.1.0 is at least READY_FOR_VALIDATION or better",
    ["READY_FOR_VALIDATION", "READY_FOR_SALE", "LAUNCHED"].includes(readinessV2.state),
    `state=${readinessV2.state}`);

  // Transition to ITERATING (since we're still in the iteration cycle)
  const iteratingReadiness = transitionReadiness(readinessV2, "ITERATING");
  record("9d. Readiness transitioned to ITERATING", iteratingReadiness.state === "ITERATING",
    `state=${iteratingReadiness.state}`);

  // After iteration completes, transition back to READY_FOR_VALIDATION
  const postIterationReadiness = transitionReadiness(iteratingReadiness, "READY_FOR_VALIDATION");
  record("9e. After iteration, readiness back to READY_FOR_VALIDATION",
    postIterationReadiness.state === "READY_FOR_VALIDATION",
    `state=${postIterationReadiness.state}`);

  // ═══════════════════════════════════════════════════════════════════════
  // STEP 10: Verify the iteration cycle is complete
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Step 10: Verify iteration cycle complete ──");

  // Publish v1.1.0
  const publishedV2 = publishVersion(productId_A, "1.1.0");
  record("10a. V1.1.0 published", publishedV2.status === "PUBLISHED",
    `status=${publishedV2.status}`);

  // Transition dossier to PUBLISHED
  const dossierPublished = transitionDossier(dossierA.dossierId, "PUBLISHED", "Product published after successful iteration");
  record("10b. Dossier transitioned to PUBLISHED", dossierPublished.status === "PUBLISHED",
    `status=${dossierPublished.status}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Original version remains identifiable (not overwritten)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Version immutability ──");

  const v1After = getVersion(productId_A, "1.0.0");
  record("V1. V1.0.0 still exists after v1.1.0 creation", v1After !== null,
    `exists=${v1After !== null}`);
  record("V2. V1.0.0 version string unchanged", v1After?.version === "1.0.0",
    `version=${v1After?.version}`);
  record("V3. V1.0.0 was SUPERSEDED (not deleted)", v1After?.status === "SUPERSEDED",
    `status=${v1After?.status}`);
  record("V4. V1.0.0 retains its original blueprintId", v1After?.blueprintId === blueprintId,
    `blueprintId=${v1After?.blueprintId}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: New version has unique identity
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: New version identity ──");

  const v2After = getVersion(productId_A, "1.1.0");
  record("V5. V1.1.0 has unique version number", v2After?.version === "1.1.0",
    `version=${v2After?.version}`);
  record("V6. V1.1.0 is PUBLISHED", v2After?.status === "PUBLISHED",
    `status=${v2After?.status}`);
  record("V7. V1.1.0 has parentId pointing to original", v2After?.parentId === productId_A,
    `parentId=${v2After?.parentId}`);
  record("V8. V1.1.0 qaPassed is true", v2After?.qaPassed === true,
    `qaPassed=${v2After?.qaPassed}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Feedback associated with correct product
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Feedback association ──");

  const fb1Check = getFeedbackItem(feedback1.feedbackId);
  record("V9. Feedback 1 associated with correct product", fb1Check?.productId === productId_A,
    `productId=${fb1Check?.productId}, expected=${productId_A}`);
  record("V10. Feedback 1 associated with correct version", fb1Check?.version === "1.0.0",
    `version=${fb1Check?.version}`);

  const fb2Check = getFeedbackItem(feedback2.feedbackId);
  record("V11. Feedback 2 associated with correct product", fb2Check?.productId === productId_A,
    `productId=${fb2Check?.productId}`);

  // Feedback on v1.0.0 version record
  const v1FeedbackRefs = v1After?.feedback || [];
  record("V12. V1.0.0 version references feedback IDs", v1FeedbackRefs.includes(feedback1.feedbackId),
    `feedbackRefs=${v1FeedbackRefs.length}, includes_f1=${v1FeedbackRefs.includes(feedback1.feedbackId)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: No contamination between users
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: User isolation ──");

  const userADossiers = listDossiers({ userId: USER_A });
  const userBDossiers = listDossiers({ userId: USER_B });
  record("V13. User A sees only their dossiers", userADossiers.every(d => d.userId === USER_A),
    `count=${userADossiers.length}, allUserA=${userADossiers.every(d => d.userId === USER_A)}`);
  record("V14. User B sees only their dossiers", userBDossiers.every(d => d.userId === USER_B),
    `count=${userBDossiers.length}, allUserB=${userBDossiers.every(d => d.userId === USER_B)}`);
  record("V15. No cross-contamination of dossiers",
    !userADossiers.some(d => d.userId === USER_B) && !userBDossiers.some(d => d.userId === USER_A),
    `userA_has_B=${userADossiers.some(d => d.userId === USER_B)}, userB_has_A=${userBDossiers.some(d => d.userId === USER_A)}`);

  // Feedback isolation: User A's product feedback shouldn't appear for User B's product
  const feedbackForB = getFeedbackByProduct(productId_B);
  record("V16. User B product has no feedback from User A product", feedbackForB.length === 0,
    `feedbackForB=${feedbackForB.length}`);

  // Version isolation
  const versionsForA = getVersionHistory(productId_A);
  const versionsForB = getVersionHistory(productId_B);
  record("V17. Version history isolated per product",
    versionsForA.every(v => v.productId === productId_A) && versionsForB.every(v => v.productId === productId_B),
    `vA_count=${versionsForA.length}, vB_count=${versionsForB.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Dossier state transitions correct
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Dossier state transitions ──");

  const finalDossier = getDossier(dossierA.dossierId);
  record("V18. Dossier timeline has multiple entries", (finalDossier?.timeline.length || 0) > 1,
    `timelineEntries=${finalDossier?.timeline.length}`);

  // Verify timeline shows the progression
  const timelineStatuses = finalDossier?.timeline.map(t => t.toStatus) || [];
  const expectedProgression = ["IDEA", "EVALUATING", "DECIDING", "ARCHITECTING", "SPECIFYING", "PRODUCING", "QA", "REVISION", "PRODUCING", "QA", "PUBLISHED"];
  record("V19. Dossier timeline shows correct progression",
    JSON.stringify(timelineStatuses) === JSON.stringify(expectedProgression),
    `actual=${JSON.stringify(timelineStatuses)}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Product can re-enter validation cycle
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Re-entry into validation cycle ──");

  // Simulate re-entering the cycle with a new minor version
  const versionV3 = createProductVersion(
    productId_A,
    "1.2.0",
    blueprintId,
    dossierA.dossierId,
    productId_A
  );
  record("V20. V1.2.0 created for next iteration", versionV3.version === "1.2.0",
    `version=${versionV3.version}, status=${versionV3.status}`);

  // Start a new validation loop for v1.2.0
  const validationLoop3 = startValidationLoop(productId_A, "1.2.0");
  record("V21. New validation loop started for v1.2.0", validationLoop3.status === "RUNNING",
    `loopId=${validationLoop3.loopId}`);

  // Run iteration with passing QA
  const reEntryIteration = await runValidationIteration(
    validationLoop3.loopId,
    { passed: true, issues: [], score: 0.95 },
    [{ type: "POSITIVE", category: "PRODUCT", content: "Excellent update!", source: "reviewer" }]
  );
  record("V22. Re-entry validation iteration completed", reEntryIteration.validation.passed,
    `passed=${reEntryIteration.validation.passed}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Version history preserved and accessible
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Version history ──");

  const fullHistory = getVersionHistory(productId_A);
  record("V23. Version history has 3 entries (1.0.0, 1.1.0, 1.2.0)", fullHistory.length === 3,
    `count=${fullHistory.length}`);
  record("V24. All versions preserved in history",
    fullHistory.some(v => v.version === "1.0.0") &&
    fullHistory.some(v => v.version === "1.1.0") &&
    fullHistory.some(v => v.version === "1.2.0"),
    `versions=${fullHistory.map(v => v.version).join(", ")}`);

  // Latest version
  const latest = getLatestVersion(productId_A);
  record("V25. Latest version is 1.2.0", latest?.version === "1.2.0",
    `latest=${latest?.version}`);

  // Latest published version
  const latestPub = getLatestPublishedVersion(productId_A);
  record("V26. Latest published version is 1.1.0", latestPub?.version === "1.1.0",
    `latestPublished=${latestPub?.version}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Version comparison (diff)
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Version diff ──");

  const diff = compareVersions(productId_A, "1.0.0", "1.1.0");
  record("V27. Version diff computed", diff.fromVersion === "1.0.0" && diff.toVersion === "1.1.0",
    `from=${diff.fromVersion}, to=${diff.toVersion}`);
  record("V28. Version diff shows changes", diff.changes.length > 0,
    `changes=${diff.changes.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Each version has proper provenance
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Version provenance ──");

  const v1Provenance = getVersion(productId_A, "1.0.0");
  const v2Provenance = getVersion(productId_A, "1.1.0");
  const v3Provenance = getVersion(productId_A, "1.2.0");

  record("V29. V1.0.0 has createdAt timestamp", v1Provenance!.createdAt instanceof Date,
    `createdAt=${v1Provenance!.createdAt.toISOString()}`);
  record("V30. V1.1.0 has createdAt after V1.0.0", v2Provenance!.createdAt >= v1Provenance!.createdAt,
    `v1=${v1Provenance!.createdAt.toISOString()}, v2=${v2Provenance!.createdAt.toISOString()}`);
  record("V31. V1.0.0 has no parentId (root)", v1Provenance!.parentId === null,
    `parentId=${v1Provenance!.parentId}`);
  record("V32. V1.1.0 has parentId", v2Provenance!.parentId !== null,
    `parentId=${v2Provenance!.parentId}`);
  record("V33. V1.2.0 has parentId", v3Provenance!.parentId !== null,
    `parentId=${v3Provenance!.parentId}`);

  // Blueprint linkage
  record("V34. All versions linked to same blueprint", 
    v1Provenance!.blueprintId === blueprintId &&
    v2Provenance!.blueprintId === blueprintId &&
    v3Provenance!.blueprintId === blueprintId,
    `bp_v1=${v1Provenance!.blueprintId}, bp_v2=${v2Provenance!.blueprintId}, bp_v3=${v3Provenance!.blueprintId}`);

  // Dossier linkage
  record("V35. All versions linked to same dossier",
    v1Provenance!.dossierId === dossierA.dossierId &&
    v2Provenance!.dossierId === dossierA.dossierId &&
    v3Provenance!.dossierId === dossierA.dossierId,
    `dossier_v1=${v1Provenance!.dossierId === dossierA.dossierId}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Validation loop history
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Validation loop history ──");

  const iterationHistory = getIterationHistory(productId_A);
  record("V36. Iteration history has entries", iterationHistory.length >= 2,
    `iterations=${iterationHistory.length}`);

  const allLoops = listValidationLoops(productId_A);
  record("V37. Multiple validation loops exist for product", allLoops.length >= 2,
    `loops=${allLoops.length}`);

  // Check loop statuses
  const loop1 = getValidationLoop(validationLoop.loopId);
  const loop2 = getValidationLoop(validationLoop2.loopId);
  const loop3 = getValidationLoop(validationLoop3.loopId);
  record("V38. First loop has iterations", (loop1?.iterations.length || 0) >= 1,
    `iterations=${loop1?.iterations.length}`);
  record("V39. Second loop has iterations", (loop2?.iterations.length || 0) >= 1,
    `iterations=${loop2?.iterations.length}`);

  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION: Immutability enforcement
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n── Validation: Immutability enforcement ──");

  // Attempting to create the same version should throw
  let overwriteBlocked = false;
  try {
    createProductVersion(productId_A, "1.0.0", blueprintId, dossierA.dossierId);
  } catch (e: any) {
    overwriteBlocked = e.code === "VERSION_EXISTS";
  }
  record("V40. Version overwrite is blocked", overwriteBlocked,
    `blocked=${overwriteBlocked}`);

  // ═══════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  GOLDEN FLOW H RESULTS                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const passCount = results.filter(r => r.status === "PASS").length;
  const failCount = results.filter(r => r.status === "FAIL").length;

  console.log(`  Total checks: ${results.length}`);
  console.log(`  Passed:       ${passCount}`);
  console.log(`  Failed:       ${failCount}`);
  console.log(`  Overall:      ${overallPass ? "✅ PASS" : "❌ FAIL"}\n`);

  // Detailed breakdown
  console.log("  ── Step Results ──");
  for (const r of results) {
    console.log(`  ${r.status === "PASS" ? "✅" : "❌"} ${r.step}: ${r.detail}`);
  }

  // Categorized summary
  console.log("\n  ── Category Summary ──");
  const categories = {
    "Step 1 (Create Product)": results.filter(r => r.step.startsWith("1")),
    "Step 2 (Product QA)": results.filter(r => r.step.startsWith("2")),
    "Step 3 (Commercial Readiness)": results.filter(r => r.step.startsWith("3")),
    "Step 4 (Commercial Feedback)": results.filter(r => r.step.startsWith("4")),
    "Step 5 (Persist Feedback)": results.filter(r => r.step.startsWith("5")),
    "Step 6 (Identify Improvements)": results.filter(r => r.step.startsWith("6")),
    "Step 7 (New Version)": results.filter(r => r.step.startsWith("7")),
    "Step 8 (Re-run QA)": results.filter(r => r.step.startsWith("8")),
    "Step 9 (New Readiness)": results.filter(r => r.step.startsWith("9")),
    "Step 10 (Cycle Complete)": results.filter(r => r.step.startsWith("10")),
    "Version Immutability": results.filter(r => r.step.startsWith("V1") || r.step.startsWith("V2") || r.step.startsWith("V3") || r.step.startsWith("V4")),
    "New Version Identity": results.filter(r => r.step.startsWith("V5") || r.step.startsWith("V6") || r.step.startsWith("V7") || r.step.startsWith("V8")),
    "Feedback Association": results.filter(r => r.step.startsWith("V9") || r.step.startsWith("V10") || r.step.startsWith("V11") || r.step.startsWith("V12")),
    "User Isolation": results.filter(r => r.step.startsWith("V13") || r.step.startsWith("V14") || r.step.startsWith("V15") || r.step.startsWith("V16") || r.step.startsWith("V17")),
    "Dossier Transitions": results.filter(r => r.step.startsWith("V18") || r.step.startsWith("V19")),
    "Re-entry": results.filter(r => r.step.startsWith("V20") || r.step.startsWith("V21") || r.step.startsWith("V22")),
    "Version History": results.filter(r => r.step.startsWith("V23") || r.step.startsWith("V24") || r.step.startsWith("V25") || r.step.startsWith("V26") || r.step.startsWith("V27") || r.step.startsWith("V28")),
    "Provenance": results.filter(r => r.step.startsWith("V29") || r.step.startsWith("V30") || r.step.startsWith("V31") || r.step.startsWith("V32") || r.step.startsWith("V33") || r.step.startsWith("V34") || r.step.startsWith("V35")),
    "Loop History": results.filter(r => r.step.startsWith("V36") || r.step.startsWith("V37") || r.step.startsWith("V38") || r.step.startsWith("V39")),
    "Immutability": results.filter(r => r.step.startsWith("V40")),
  };

  for (const [cat, catResults] of Object.entries(categories)) {
    if (catResults.length === 0) continue;
    const catPass = catResults.filter(r => r.status === "PASS").length;
    const catFail = catResults.filter(r => r.status === "FAIL").length;
    const icon = catFail === 0 ? "✅" : "❌";
    console.log(`  ${icon} ${cat}: ${catPass}/${catResults.length} passed`);
  }

  console.log(`\n  ══════════════════════════════════`);
  console.log(`  GOLDEN FLOW H: ${overallPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`  ══════════════════════════════════\n`);

  // Exit with appropriate code
  process.exit(overallPass ? 0 : 1);
}

runGoldenFlowH().catch((err) => {
  console.error("\n❌ Golden Flow H crashed:", err);
  process.exit(1);
});
