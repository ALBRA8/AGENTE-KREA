/**
 * Golden Flow G Validation — KREA V2.1
 *
 * Full pipeline: Product → Factory → Assets → QA → Commercial Readiness
 *
 * Tests every step of the eBook production pipeline with real artifact
 * creation, real QA, and real commercial readiness evaluation.
 */

import fs from "fs/promises";
import path from "path";

// ─── Step Results Tracking ──────────────────────────────────────────────────────

interface StepResult {
  step: number;
  name: string;
  status: "PASS" | "FAIL";
  evidence: string;
  durationMs: number;
}

const results: StepResult[] = [];
let overallPass = true;

function recordResult(step: number, name: string, pass: boolean, evidence: string, durationMs: number) {
  results.push({ step, name, status: pass ? "PASS" : "FAIL", evidence, durationMs });
  if (!pass) overallPass = false;
  console.log(`\n  Step ${step}: ${name} — ${pass ? "✅ PASS" : "❌ FAIL"} (${durationMs}ms)`);
  if (evidence.length > 0) {
    console.log(`    Evidence: ${evidence.substring(0, 200)}${evidence.length > 200 ? "..." : ""}`);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║         KREA V2.1 — Golden Flow G Validation                     ║");
  console.log("║  Product → Factory → Assets → QA → Commercial Readiness          ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // ─── Construct test data ──────────────────────────────────────────────────────

  const productId = `gf_test_${Date.now().toString(36)}`;
  const version = "1.0.0";

  // Build a CommercialProduct manually for testing
  const commercialProduct = {
    productId,
    productVersion: version,
    productName: "The Complete Guide to System Design Thinking",
    productType: "ebook" as const,
    targetCustomer: {
      description: "Mid-level software engineers preparing for system design interviews at top tech companies",
      demographics: ["25-40 years old", "Bachelor's degree or higher in CS/Engineering", "3-10 years of experience"],
      psychographics: ["Career-driven", "Continuous learners", "Value practical frameworks over theory"],
      painPoints: ["Struggle with open-ended system design questions", "Lack structured approach to complex problems", "Existing resources are too theoretical or shallow"],
      currentSolutions: ["Grokking the System Design Interview", "YouTube tutorials", "Blog posts and scattered notes"],
    },
    problem: "Software engineers lack a structured, comprehensive framework for approaching system design interviews, leading to anxiety and underperformance in high-stakes technical interviews at top companies.",
    jobToBeDone: "Provide a step-by-step thinking framework that transforms how engineers approach any system design problem",
    desiredOutcome: "Engineers can confidently approach any system design question with a repeatable, structured methodology",
    valueProposition: "A practical, framework-driven guide that teaches you HOW to think about system design, not just what to memorize",
    differentiation: "Unlike recipe-book style guides, this teaches a transferable thinking framework applicable to ANY system design problem, including novel ones not covered in existing materials",
    format: "PDF",
    includedAssets: ["Quick Reference Cheat Sheet", "Practice Problem Workbook"],
    excludedScope: ["Live coaching sessions", "Code implementation examples", "Video content"],
    priceStrategy: {
      model: "one_time" as const,
      reasoning: "Digital knowledge product with one-time purchase. Price reflects depth and uniqueness of the framework approach.",
      evidence: "ESTIMATED" as const,
    },
    priceRange: {
      min: 19,
      max: 49,
      currency: "USD",
      recommended: 29,
      evidence: "ESTIMATED" as const,
    },
    monetizationModel: "one_time",
    distributionStrategy: "Direct download after purchase",
    positioning: "The only system design guide that teaches you the THINKING FRAMEWORK, not just answers to common questions",
    keyBenefits: [
      "Learn a repeatable 5-step framework for any system design problem",
      "Master trade-off analysis and justification techniques",
      "Practice with 10 real-world problems with detailed walkthroughs",
      "Quick reference cheat sheet for interview-day recall",
    ],
    objections: [
      "I already have Grokking/System Design Primer — why do I need this?",
      "Can a book really help with interview performance?",
      "Is this just another collection of common design problems?",
    ],
    proofRequirements: [
      { type: "sample" as const, description: "Free chapter preview", status: "MISSING" as const },
      { type: "testimonial" as const, description: "Customer success stories", status: "MISSING" as const },
      { type: "data" as const, description: "Interview success rate data", status: "MISSING" as const },
    ],
    commercialReadiness: {
      overall: 0.6,
      productCompleteness: { score: 0.8, evidence: "INFERRED" as const, confidence: 0.7, warnings: [] },
      contentCompleteness: { score: 0.7, evidence: "INFERRED" as const, confidence: 0.6, warnings: [] },
      quality: { score: 0.8, evidence: "INFERRED" as const, confidence: 0.7, warnings: [] },
      packaging: { score: 0.6, evidence: "INFERRED" as const, confidence: 0.5, warnings: [] },
      delivery: { score: 0.7, evidence: "INFERRED" as const, confidence: 0.6, warnings: [] },
      differentiation: { score: 0.8, evidence: "INFERRED" as const, confidence: 0.7, warnings: [] },
      evidence: { score: 0.3, evidence: "NOT_VERIFIED" as const, confidence: 0.2, warnings: ["No proof elements available yet"] },
      commercialClarity: { score: 0.7, evidence: "INFERRED" as const, confidence: 0.6, warnings: [] },
    },
    launchRequirements: ["Complete all chapters", "Generate PDF artifact", "Pass Product QA", "Proof elements available"],
    assumptions: [
      "Target audience is willing to pay for structured frameworks",
      "PDF format is acceptable for the primary deliverable",
      "English language is sufficient for initial launch",
    ],
    risks: [
      { description: "Market saturation with existing system design content", probability: 0.6, impact: 0.5, mitigation: "Differentiate through framework approach, not recipe-style content" },
      { description: "Price resistance in a market with many free resources", probability: 0.4, impact: 0.4, mitigation: "Emphasize unique value of thinking framework over memorization" },
    ],
    evidence: "INFERRED" as const,
    provenance: `golden-flow-g:test:${productId}`,
  };

  // Build a BookArchitecture for the blueprint
  const architecture = {
    productType: "ebook" as const,
    architecture: "Structured eBook with 5 core chapters covering a system design thinking framework, front matter, and back matter with practice problems and reference materials.",
    components: [
      { name: "Thinking Framework", type: "core_content", description: "The 5-step framework for approaching any system design problem", dependencies: [] },
      { name: "Trade-off Analysis", type: "core_content", description: "Techniques for analyzing and justifying design trade-offs", dependencies: ["Thinking Framework"] },
      { name: "Practice Problems", type: "exercises", description: "10 real-world system design problems with walkthroughs", dependencies: ["Thinking Framework", "Trade-off Analysis"] },
      { name: "Quick Reference", type: "reference", description: "One-page cheat sheet for interview-day recall", dependencies: ["Thinking Framework"] },
    ],
    dependencies: ["Thinking Framework", "Trade-off Analysis", "Practice Problems", "Quick Reference"],
    constraints: ["Must be framework-driven, not recipe-driven", "Each chapter must have practical exercises", "Total word count target: 20,000-30,000 words"],
    estimatedDuration: "4-6 weeks",
    technologyStack: ["pdf-lib", "markdown", "z-ai-web-dev-sdk"],
    evidence: "INFERRED" as const,
    chapters: [
      { number: 1, title: "The System Design Thinking Framework", description: "Introduce the 5-step framework that is the core of this guide", estimatedWords: 4000, keyTopics: ["Framework overview", "5 steps explained", "Why thinking matters more than memorizing"] },
      { number: 2, title: "Requirements Analysis & Scoping", description: "How to systematically break down any problem statement", estimatedWords: 3500, keyTopics: ["Functional vs non-functional", "Capacity estimation", "Constraint identification"] },
      { number: 3, title: "Architecture Trade-off Analysis", description: "Framework for making and justifying design decisions", estimatedWords: 4000, keyTopics: ["CAP theorem in practice", "Consistency vs availability", "Latency vs throughput", "Cost optimization"] },
      { number: 4, title: "Deep Dive: Common Building Blocks", description: "Analysis of core components you'll use in any design", estimatedWords: 5000, keyTopics: ["Load balancers", "Caching strategies", "Database selection", "Message queues"] },
      { number: 5, title: "Practice Problems & Walkthroughs", description: "10 real-world problems solved using the framework", estimatedWords: 6000, keyTopics: ["URL shortener", "Chat system", "News feed", "Rate limiter"] },
    ],
    totalWordCount: 22500,
    artDirection: "Clean, professional layout with clear section hierarchy. Monospace fonts for technical content. Diagrams use consistent visual language.",
    format: "pdf" as const,
  };

  // ─── STEP 1: Create ProductBlueprint ──────────────────────────────────────────

  console.log("\n━━━ STEP 1: Create ProductBlueprint ━━━");

  let stepStart = Date.now();
  let blueprint: any;
  try {
    const { createBlueprint, validateBlueprint } = await import("../src/lib/product-blueprint");

    blueprint = createBlueprint(commercialProduct, architecture);

    // Validate the blueprint
    const validation = validateBlueprint(blueprint);

    const evidence = `blueprintId=${blueprint.blueprintId}, sections=${blueprint.structure.sections.length}, ` +
      `contentReqs=${blueprint.contentRequirements.length}, designReqs=${blueprint.designRequirements.length}, ` +
      `qualityReqs=${blueprint.qualityRequirements.length}, valid=${validation.valid}` +
      (validation.errors.length > 0 ? `, errors=${validation.errors.join("; ")}` : "");

    const pass = validation.valid &&
      blueprint.blueprintId != null &&
      blueprint.structure.sections.length > 0 &&
      blueprint.problem != null &&
      blueprint.valueProposition != null;

    recordResult(1, "Create ProductBlueprint", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(1, "Create ProductBlueprint", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 2: Product Packaging Engine ─────────────────────────────────────────

  console.log("\n━━━ STEP 2: Product Packaging Engine ━━━");

  let packaging: any;
  stepStart = Date.now();
  try {
    const { createProductPackaging } = await import("../src/lib/product-packaging");

    packaging = createProductPackaging(commercialProduct);

    const evidence = `packagingId=${packaging.packagingId}, coreProduct.included=${packaging.coreProduct.included.length}, ` +
      `bonuses=${packaging.bonuses.length}, versions=${packaging.versions.length}, ` +
      `delivery.method="${packaging.delivery.method}", usage.timeToValue="${packaging.usage.timeToValue}"`;

    const pass = packaging.packagingId != null &&
      packaging.coreProduct != null &&
      packaging.coreProduct.included.length > 0 &&
      packaging.versions.length > 0 &&
      packaging.delivery.method != null &&
      packaging.usage.timeToValue != null;

    recordResult(2, "Product Packaging Engine", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(2, "Product Packaging Engine", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 3: Offer Architecture Engine ────────────────────────────────────────

  console.log("\n━━━ STEP 3: Offer Architecture Engine ━━━");

  let offerArchitecture: any;
  stepStart = Date.now();
  try {
    const { createOfferArchitecture } = await import("../src/lib/offer-architecture");

    offerArchitecture = createOfferArchitecture(commercialProduct, packaging);

    const evidence = `offerId=${offerArchitecture.offerId}, ` +
      `integrity.passes=${offerArchitecture.integrityCheck.passesIntegrity}, ` +
      `integrity.issues=${offerArchitecture.integrityCheck.issues.length}, ` +
      `problem="${offerArchitecture.problem.content.substring(0, 60)}...", ` +
      `evidence=${offerArchitecture.evidence}`;

    const pass = offerArchitecture.offerId != null &&
      offerArchitecture.problem != null &&
      offerArchitecture.promise != null &&
      offerArchitecture.integrityCheck != null;

    recordResult(3, "Offer Architecture Engine", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(3, "Offer Architecture Engine", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 4 & 5: Select Book Factory and Execute ──────────────────────────────

  console.log("\n━━━ STEP 4&5: Book Factory — Create and Execute Pipeline ━━━");

  let bookProject: any;
  let pdfPath: string | null = null;
  stepStart = Date.now();
  try {
    const { createBookProject, runPipeline } = await import("../src/lib/book-factory");

    // Create a book project with pre-defined chapters
    const project = createBookProject({
      userId: "golden-flow-test",
      dossierId: "dossier_gf_test",
      title: commercialProduct.productName,
      subtitle: "A Framework-Driven Approach to System Design Interviews",
      author: "KREA Test Author",
      targetAudience: commercialProduct.targetCustomer.description,
      chapters: architecture.chapters.map((ch, i) => ({
        index: ch.number,
        title: ch.title,
        synopsis: ch.description,
        targetWords: ch.estimatedWords,
      })),
    });

    // Run the full pipeline
    bookProject = await runPipeline(project.projectId, (event) => {
      console.log(`    [Step ${event.step}] ${event.stepName}: ${event.status} — ${event.detail.substring(0, 80)}`);
    });

    pdfPath = bookProject.artifacts.pdfPath || null;
    const coverPath = bookProject.artifacts.coverImagePath || null;

    // Verify the PDF was actually created on disk
    let pdfExists = false;
    let pdfSize = 0;
    let pageCount = 0;
    if (pdfPath) {
      try {
        const stat = await fs.stat(pdfPath);
        pdfExists = stat.isFile();
        pdfSize = stat.size;

        // Use pdf-factory's inspectPdf to verify
        const { inspectPdf } = await import("../src/lib/pdf-factory");
        const inspection = await inspectPdf(pdfPath);
        pageCount = inspection.pageCount;
      } catch {
        pdfExists = false;
      }
    }

    const evidence = `projectId=${bookProject.projectId}, status=${bookProject.status}, ` +
      `pdfPath=${pdfPath || "NONE"}, pdfExists=${pdfExists}, pdfSize=${pdfSize} bytes, ` +
      `pageCount=${pageCount}, coverPath=${coverPath || "NONE"}, ` +
      `chapters=${bookProject.chapters.length}, errors=${bookProject.errors.length}`;

    // CRITICAL: Factory must produce a REAL artifact (PDF file on disk)
    const pass = bookProject.status === "COMPLETED" &&
      pdfPath != null &&
      pdfExists &&
      pdfSize > 0 &&
      pageCount > 0 &&
      bookProject.chapters.length > 0 &&
      bookProject.errors.length === 0;

    recordResult(4, "Book Factory — Create and Execute Pipeline", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(4, "Book Factory — Create and Execute Pipeline", false, `Error: ${err.message}\n${err.stack?.substring(0, 500)}`, Date.now() - stepStart);
  }

  // ─── STEP 6: Product Content Engine ───────────────────────────────────────────

  console.log("\n━━━ STEP 6: Product Content Engine ━━━");

  let assembledContent: any;
  stepStart = Date.now();
  try {
    const { getContentTemplate, assembleContent, getContentTypeInfo } = await import("../src/lib/product-content-engine");

    // Get template for ebook type
    const template = getContentTemplate("ebook");
    template.title = commercialProduct.productName;
    template.metadata.purpose = commercialProduct.jobToBeDone;
    template.metadata.targetAudience = commercialProduct.targetCustomer.description;

    // If book project has content, fill the template sections with generated content
    if (bookProject && bookProject.chapters) {
      let sectionIdx = 0;
      for (const section of template.sections) {
        if (section.type === "chapter" && sectionIdx < bookProject.chapters.length) {
          const chapter = bookProject.chapters[sectionIdx];
          if (chapter.content) {
            section.content = chapter.content;
          }
          sectionIdx++;
        }
      }
    }

    // Assemble the content
    assembledContent = assembleContent(template);

    const evidence = `type=${assembledContent.type}, totalWords=${assembledContent.totalWords}, ` +
      `sections=${assembledContent.sections.length}, completenessScore=${assembledContent.completenessScore.toFixed(3)}, ` +
      `evidence=${assembledContent.evidence}`;

    const pass = assembledContent.type === "ebook" &&
      assembledContent.sections.length > 0 &&
      assembledContent.evidence != null;

    recordResult(6, "Product Content Engine", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(6, "Product Content Engine", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 7: Asset Manager — Register and Verify Artifacts ────────────────────

  console.log("\n━━━ STEP 7: Asset Manager — Register and Verify ━━━");

  let registeredAsset: any;
  stepStart = Date.now();
  try {
    const { registerAsset, verifyAssetIntegrity, listAssets, getAssetCountByType } = await import("../src/lib/asset-manager");

    if (pdfPath) {
      // Register the PDF as a real asset
      registeredAsset = await registerAsset(
        productId,
        version,
        "pdf",
        path.basename(pdfPath),
        "application/pdf",
        pdfPath,
        "book-factory",
        "pdf-lib"
      );

      // Verify integrity
      const integrityOk = await verifyAssetIntegrity(registeredAsset.assetId);

      // List all assets
      const allAssets = listAssets(productId, version);
      const assetCounts = getAssetCountByType(productId, version);

      const evidence = `assetId=${registeredAsset.assetId}, type=${registeredAsset.type}, ` +
        `size=${registeredAsset.size} bytes, checksum=${registeredAsset.checksum.substring(0, 16)}..., ` +
        `evidence=${registeredAsset.evidence}, integrityOk=${integrityOk}, ` +
        `totalAssets=${allAssets.length}, counts=${JSON.stringify(assetCounts)}`;

      // CRITICAL: Asset must be registered with VERIFIED evidence and integrity must check out
      const pass = registeredAsset.assetId != null &&
        registeredAsset.size > 0 &&
        registeredAsset.checksum != null &&
        registeredAsset.checksum.length > 0 &&
        registeredAsset.evidence === "VERIFIED" &&
        integrityOk === true &&
        allAssets.length > 0;

      recordResult(7, "Asset Manager — Register and Verify", pass, evidence, Date.now() - stepStart);
    } else {
      recordResult(7, "Asset Manager — Register and Verify", false, "No PDF path from Book Factory", Date.now() - stepStart);
    }
  } catch (err: any) {
    recordResult(7, "Asset Manager — Register and Verify", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 8: Product Versioning — Create Initial Version ──────────────────────

  console.log("\n━━━ STEP 8: Product Versioning ━━━");

  let productVersion: any;
  stepStart = Date.now();
  try {
    const { createProductVersion, getVersion, addAssetToVersion, setExecutionId } = await import("../src/lib/product-versioning");

    // Create initial version
    productVersion = createProductVersion(
      productId,
      version,
      blueprint?.blueprintId || "bp_unknown",
      "dossier_gf_test"
    );

    // Add the asset to the version
    if (registeredAsset) {
      addAssetToVersion(productId, version, registeredAsset.assetId);
    }

    // Set execution ID
    if (bookProject) {
      setExecutionId(productId, version, bookProject.projectId);
    }

    // Verify version exists
    const retrieved = getVersion(productId, version);

    const evidence = `productId=${productVersion.productId}, version=${productVersion.version}, ` +
      `status=${productVersion.status}, blueprintId=${productVersion.blueprintId}, ` +
      `assets=${productVersion.assets.length}, executionId=${productVersion.executionId || "none"}, ` +
      `retrieved=${retrieved != null}`;

    const pass = productVersion.productId === productId &&
      productVersion.version === version &&
      productVersion.status === "DRAFT" &&
      productVersion.blueprintId != null &&
      retrieved != null;

    recordResult(8, "Product Versioning — Create Initial Version", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(8, "Product Versioning — Create Initial Version", false, `Error: ${err.message}`, Date.now() - stepStart);
  }

  // ─── STEP 9: Product QA — All Layers ──────────────────────────────────────────

  console.log("\n━━━ STEP 9: Product QA — All Layers ━━━");

  let qaReport: any;
  stepStart = Date.now();
  try {
    const { runProductQA } = await import("../src/lib/product-qa");

    // Build the artifacts reference for QA
    const artifacts = [];
    if (pdfPath) {
      artifacts.push({ path: pdfPath, type: "pdf", label: "Main eBook PDF" });
    }

    // Build blueprint for QA
    const qaBlueprint = blueprint ? {
      sections: blueprint.structure.sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        required: true,
        minWordCount: s.estimatedWords > 0 ? Math.round(s.estimatedWords * 0.5) : undefined,
        order: s.order,
      })),
      expectedPageRange: { min: 5, max: 100 },
      expectedFormat: "PDF",
    } : undefined;

    // Build commercial product for QA
    const qaCommercialProduct = {
      hasPricing: true,
      hasTargetCustomer: true,
      hasValueProposition: true,
      hasProblemStatement: true,
      hasDifferentiation: true,
      testimonials: [],
      claims: commercialProduct.keyBenefits,
    };

    // Build packaging for QA
    const qaPackaging = packaging ? {
      deliveryFormat: packaging.delivery.method,
      accessMethod: packaging.delivery.access,
      usageGuide: packaging.usage.steps.join("; "),
      prerequisites: packaging.delivery.requirements,
      supportInfo: null,
    } : undefined;

    // Build content for QA
    const qaContent = assembledContent ? {
      sections: assembledContent.sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        content: s.content,
      })),
    } : undefined;

    // Run full product QA
    qaReport = await runProductQA(
      productId,
      version,
      artifacts,
      qaBlueprint,
      qaCommercialProduct,
      qaPackaging,
      qaContent
    );

    const evidence = `reportId=${qaReport.reportId}, overallPassed=${qaReport.overallPassed}, ` +
      `overallScore=${qaReport.overallScore.toFixed(3)}, ` +
      `artifactQA.passed=${qaReport.artifactQA.passed} score=${qaReport.artifactQA.score.toFixed(2)}, ` +
      `contentQA.passed=${qaReport.contentQA.passed} score=${qaReport.contentQA.score.toFixed(2)}, ` +
      `structureQA.passed=${qaReport.structureQA.passed} score=${qaReport.structureQA.score.toFixed(2)}, ` +
      `visualQA.passed=${qaReport.visualQA.passed} score=${qaReport.visualQA.score.toFixed(2)}, ` +
      `commercialQA.passed=${qaReport.commercialQA.passed} score=${qaReport.commercialQA.score.toFixed(2)}, ` +
      `deliveryQA.passed=${qaReport.deliveryQA.passed} score=${qaReport.deliveryQA.score.toFixed(2)}, ` +
      `criticalIssues=${qaReport.criticalIssues.length}, warnings=${qaReport.warnings.length}, ` +
      `evidence=${qaReport.evidence}`;

    // QA must produce real results (not just "status: success")
    const pass = qaReport.reportId != null &&
      qaReport.artifactQA != null &&
      qaReport.contentQA != null &&
      qaReport.structureQA != null &&
      qaReport.visualQA != null &&
      qaReport.commercialQA != null &&
      qaReport.deliveryQA != null &&
      qaReport.artifactQA.checks.length > 0 &&
      typeof qaReport.overallScore === "number" &&
      qaReport.evidence != null;

    recordResult(9, "Product QA — All Layers", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(9, "Product QA — All Layers", false, `Error: ${err.message}\n${err.stack?.substring(0, 500)}`, Date.now() - stepStart);
  }

  // ─── STEP 10: Commercial Readiness Evaluation ─────────────────────────────────

  console.log("\n━━━ STEP 10: Commercial Readiness Evaluation ━━━");

  let readiness: any;
  stepStart = Date.now();
  try {
    const { evaluateReadiness } = await import("../src/lib/commercial-readiness");

    // Build commercial product for readiness
    const readinessCommercialProduct = {
      hasPricing: true,
      hasTargetCustomer: true,
      hasValueProposition: true,
      hasProblemStatement: true,
      hasDifferentiation: true,
      testimonials: [],
      claims: commercialProduct.keyBenefits,
    };

    // Build packaging for readiness
    const readinessPackaging = packaging ? {
      deliveryFormat: packaging.delivery.method,
      accessMethod: packaging.delivery.access,
      usageGuide: packaging.usage.steps.join("; "),
      prerequisites: packaging.delivery.requirements,
      supportInfo: null,
    } : undefined;

    // Build assets info
    const productAssets = {
      artifactCount: registeredAsset ? 1 : 0,
      hasBlueprint: blueprint != null,
      hasSpecification: true,
      hasEconomics: false,
      hasArchitecture: true,
    };

    readiness = evaluateReadiness(
      productId,
      version,
      qaReport,
      readinessCommercialProduct,
      readinessPackaging,
      productAssets
    );

    const getScore = (d: any) => typeof d === 'number' ? d : (d?.score ?? 0);
    const evidence = `state=${readiness.state}, overallScore=${readiness.score.overall.toFixed(3)}, ` +
      `productCompleteness=${getScore(readiness.score.productCompleteness).toFixed(2)}, ` +
      `contentCompleteness=${getScore(readiness.score.contentCompleteness).toFixed(2)}, ` +
      `quality=${getScore(readiness.score.quality).toFixed(2)}, ` +
      `packaging=${getScore(readiness.score.packaging).toFixed(2)}, ` +
      `delivery=${getScore(readiness.score.delivery).toFixed(2)}, ` +
      `differentiation=${getScore(readiness.score.differentiation).toFixed(2)}, ` +
      `evidenceScore=${getScore(readiness.score.evidence).toFixed(2)}, ` +
      `commercialClarity=${getScore(readiness.score.commercialClarity).toFixed(2)}, ` +
      `requirements=${readiness.requirements.length}, blockers=${readiness.blockers.length}`;

    // Must produce real readiness evaluation with actual scores
    const pass = readiness.productId === productId &&
      readiness.state != null &&
      typeof readiness.score.overall === "number" &&
      readiness.score.productCompleteness != null &&
      readiness.score.contentCompleteness != null &&
      readiness.score.quality != null &&
      readiness.score.packaging != null &&
      readiness.score.delivery != null &&
      readiness.score.differentiation != null &&
      readiness.score.evidence != null &&
      readiness.score.commercialClarity != null &&
      readiness.requirements != null;

    recordResult(10, "Commercial Readiness Evaluation", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(10, "Commercial Readiness Evaluation", false, `Error: ${err.message}\n${err.stack?.substring(0, 500)}`, Date.now() - stepStart);
  }

  // ─── STEP 11: Generate Launch Package ─────────────────────────────────────────

  console.log("\n━━━ STEP 11: Generate Launch Package ━━━");

  let launchPackage: any;
  stepStart = Date.now();
  try {
    const { generateLaunchPackage, validateLaunchPackage } = await import("../src/lib/launch-package");

    // Build product definition for launch package
    const productDef = {
      name: commercialProduct.productName,
      type: commercialProduct.productType,
      description: commercialProduct.valueProposition,
      version: version,
      targetCustomer: commercialProduct.targetCustomer.description,
      painPoints: commercialProduct.targetCustomer.painPoints,
      valueProposition: commercialProduct.valueProposition,
      differentiation: commercialProduct.differentiation,
      price: {
        amount: commercialProduct.priceRange.recommended,
        currency: commercialProduct.priceRange.currency,
        model: commercialProduct.monetizationModel,
      },
    };

    // Build offer architecture for launch package
    const launchOfferArch = offerArchitecture ? {
      problem: offerArchitecture.problem.content,
      promise: offerArchitecture.promise.content,
      mechanism: offerArchitecture.mechanism.content,
      benefits: commercialProduct.keyBenefits,
      bonuses: packaging?.bonuses?.map((b: any) => b.name) || [],
      included: packaging?.coreProduct?.included || [],
    } : undefined;

    // Build assets for launch package
    const launchAssets = registeredAsset ? {
      files: [{
        filename: registeredAsset.filename,
        type: registeredAsset.type,
        size: registeredAsset.size,
      }],
    } : undefined;

    // Build packaging for launch package
    const launchPackaging = packaging ? {
      deliveryFormat: packaging.delivery.method,
      accessMethod: packaging.delivery.access,
      usageGuide: packaging.usage.steps.join("; "),
      prerequisites: packaging.delivery.requirements,
      supportInfo: null,
    } : undefined;

    // Generate launch package
    launchPackage = generateLaunchPackage(
      productDef,
      launchPackaging,
      launchOfferArch,
      launchAssets,
      qaReport,
      readiness
    );

    // Validate launch package
    const validation = validateLaunchPackage(launchPackage);

    const evidence = `packageId=${launchPackage.packageId}, productId=${launchPackage.productId}, ` +
      `product.name="${launchPackage.product.name}", ` +
      `offer.problem="${launchPackage.offer.problem.substring(0, 50)}...", ` +
      `benefits=${launchPackage.benefits.length}, faq=${launchPackage.faq.length}, ` +
      `objections=${launchPackage.objections.length}, ` +
      `proofReqs=${launchPackage.proofRequirements.length}, ` +
      `disclaimers=${launchPackage.disclaimers.length}, ` +
      `integrity.passes=${launchPackage.integrityCheck.passes}, ` +
      `integrity.issues=${launchPackage.integrityCheck.issues.length}, ` +
      `validation.valid=${validation.valid}, ` +
      `validation.issues=${validation.issues.length}, ` +
      `assets=${launchPackage.assets.length}, ` +
      `evidence=${launchPackage.evidence}`;

    // Launch package must contain all required components
    const pass = launchPackage.packageId != null &&
      launchPackage.product.name === commercialProduct.productName &&
      launchPackage.offer != null &&
      launchPackage.offer.problem != null &&
      launchPackage.offer.promise != null &&
      launchPackage.faq.length > 0 &&
      launchPackage.objections.length > 0 &&
      launchPackage.proofRequirements.length > 0 &&
      launchPackage.disclaimers.length > 0 &&
      launchPackage.integrityCheck != null &&
      launchPackage.assets.length > 0 &&
      launchPackage.cta != null &&
      launchPackage.evidence != null;

    recordResult(11, "Generate Launch Package", pass, evidence, Date.now() - stepStart);
  } catch (err: any) {
    recordResult(11, "Generate Launch Package", false, `Error: ${err.message}\n${err.stack?.substring(0, 500)}`, Date.now() - stepStart);
  }

  // ─── FINAL REPORT ─────────────────────────────────────────────────────────────

  console.log("\n\n╔══════════════════════════════════════════════════════════════════╗");
  console.log("║              GOLDEN FLOW G — FINAL REPORT                        ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝\n");

  // Summary table
  console.log("┌─────┬────────────────────────────────────────────┬──────┬───────────┐");
  console.log("│ Step │ Name                                       │ Pass │ Duration  │");
  console.log("├─────┼────────────────────────────────────────────┼──────┼───────────┤");
  for (const r of results) {
    const namePadded = r.name.padEnd(42).substring(0, 42);
    const statusPadded = r.status.padEnd(4);
    const durPadded = `${r.durationMs}ms`.padStart(9);
    console.log(`│  ${r.step.toString().padStart(2)} │ ${namePadded} │ ${statusPadded} │ ${durPadded} │`);
  }
  console.log("└─────┴────────────────────────────────────────────┴──────┴───────────┘\n");

  // Artifact details
  console.log("━━━ Artifact Evidence ━━━");
  if (pdfPath) {
    try {
      const stat = await fs.stat(pdfPath);
      console.log(`  PDF Path:     ${pdfPath}`);
      console.log(`  PDF Size:     ${stat.size} bytes`);
      console.log(`  PDF Type:     application/pdf`);
      console.log(`  PDF Exists:   true`);
    } catch {
      console.log(`  PDF Path:     ${pdfPath} (NOT FOUND)`);
    }
  } else {
    console.log("  No PDF artifact created");
  }
  if (registeredAsset) {
    console.log(`  Asset ID:     ${registeredAsset.assetId}`);
    console.log(`  Checksum:     ${registeredAsset.checksum.substring(0, 32)}...`);
    console.log(`  Asset Ev:     ${registeredAsset.evidence}`);
  }
  console.log("");

  // QA Details
  console.log("━━━ QA Results ━━━");
  if (qaReport) {
    console.log(`  Overall Passed:  ${qaReport.overallPassed}`);
    console.log(`  Overall Score:   ${qaReport.overallScore.toFixed(3)}`);
    console.log(`  Artifact QA:     ${qaReport.artifactQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.artifactQA.score.toFixed(2)})`);
    console.log(`  Content QA:      ${qaReport.contentQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.contentQA.score.toFixed(2)})`);
    console.log(`  Structure QA:    ${qaReport.structureQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.structureQA.score.toFixed(2)})`);
    console.log(`  Visual QA:       ${qaReport.visualQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.visualQA.score.toFixed(2)})`);
    console.log(`  Commercial QA:   ${qaReport.commercialQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.commercialQA.score.toFixed(2)})`);
    console.log(`  Delivery QA:     ${qaReport.deliveryQA.passed ? "PASS" : "FAIL"} (score: ${qaReport.deliveryQA.score.toFixed(2)})`);
    console.log(`  Critical Issues: ${qaReport.criticalIssues.length}`);
    console.log(`  Warnings:        ${qaReport.warnings.length}`);
    console.log(`  Evidence:        ${qaReport.evidence}`);
  }
  console.log("");

  // Commercial Readiness Details
  console.log("━━━ Commercial Readiness ━━━");
  if (readiness) {
    console.log(`  State:              ${readiness.state}`);
    console.log(`  Overall Score:      ${readiness.score.overall.toFixed(3)}`);
    console.log(`  Product Completeness: ${readiness.score.productCompleteness.score.toFixed(2)}`);
    console.log(`  Content Completeness: ${readiness.score.contentCompleteness.score.toFixed(2)}`);
    console.log(`  Quality:              ${readiness.score.quality.score.toFixed(2)}`);
    console.log(`  Packaging:            ${readiness.score.packaging.score.toFixed(2)}`);
    const getScore = (d: any) => typeof d === 'number' ? d : (d?.score ?? 0);
    console.log(`  Delivery:             ${getScore(readiness.score.delivery).toFixed(2)}`);
    console.log(`  Differentiation:      ${getScore(readiness.score.differentiation).toFixed(2)}`);
    console.log(`  Evidence:             ${getScore(readiness.score.evidence).toFixed(2)}`);
    console.log(`  Commercial Clarity:   ${getScore(readiness.score.commercialClarity).toFixed(2)}`);
    console.log(`  Requirements:         ${readiness.requirements.length}`);
    console.log(`  Blockers:             ${readiness.blockers.length}`);
  }
  console.log("");

  // Launch Package Details
  console.log("━━━ Launch Package Contents ━━━");
  if (launchPackage) {
    console.log(`  Package ID:         ${launchPackage.packageId}`);
    console.log(`  Product Name:       ${launchPackage.product.name}`);
    console.log(`  Product Type:       ${launchPackage.product.type}`);
    console.log(`  Offer Problem:      ${launchPackage.offer.problem.substring(0, 60)}...`);
    console.log(`  Offer Promise:      ${launchPackage.offer.promise.substring(0, 60)}...`);
    console.log(`  Benefits:           ${launchPackage.benefits.length}`);
    console.log(`  FAQ Items:          ${launchPackage.faq.length}`);
    console.log(`  Objections:         ${launchPackage.objections.length}`);
    console.log(`  Proof Reqs:         ${launchPackage.proofRequirements.length}`);
    console.log(`  Disclaimers:        ${launchPackage.disclaimers.length}`);
    console.log(`  Assets:             ${launchPackage.assets.length}`);
    console.log(`  Integrity Passes:   ${launchPackage.integrityCheck.passes}`);
    console.log(`  Integrity Issues:   ${launchPackage.integrityCheck.issues.length}`);
    console.log(`  CTA:                ${launchPackage.cta}`);
    console.log(`  Evidence:           ${launchPackage.evidence}`);
  }
  console.log("");

  // Overall result
  const passCount = results.filter((r) => r.status === "PASS").length;
  const failCount = results.filter((r) => r.status === "FAIL").length;

  console.log("━━━ Overall Result ━━━");
  console.log(`  Steps Passed: ${passCount}/${results.length}`);
  console.log(`  Steps Failed: ${failCount}/${results.length}`);
  console.log(`  Overall:      ${overallPass ? "✅ GOLDEN FLOW G — PASS" : "❌ GOLDEN FLOW G — FAIL"}`);
  console.log("");

  // Exit code — don't exit immediately, allow console to flush
  setTimeout(() => process.exit(overallPass ? 0 : 1), 100);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
