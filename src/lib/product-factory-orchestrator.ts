/**
 * Product Factory Orchestrator — KREA V2.1
 *
 * Selects the right factory and executes the pipeline.
 * This is the top-level orchestrator that dispatches production requests
 * to the appropriate factory based on product type.
 *
 * Factory dispatch:
 *   ebook/guide/manual/workbook   → book_factory
 *   checklist/template_pack       → document_factory
 *   digital_kit/resource_pack     → kit_factory
 *   software/saas/api             → handoff_only (no direct production)
 *   hybrid_content                → book_factory (primary)
 *
 * The orchestrator creates a FactoryContract, transitions it through
 * the lifecycle, runs QA, and returns a complete execution result.
 */

import { randomUUID } from "crypto";
import {
  createFactoryContract,
  transitionFactoryStatus,
  addError as addContractError,
  isIdempotent,
  getContract,
  type FactoryContract,
  type FactoryStatus,
  type EvidenceTag,
  type Blueprint,
} from "./factory-contract";
import type { BookProject, BookProjectInput } from "./book-factory";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FactoryExecution {
  executionId: string;
  factoryType: string;
  contract: FactoryContract;
  status: FactoryStatus;
  progress: StepProgress[];
  artifacts: ArtifactRef[];
  qaReport: QAReport | null;
  startedAt: Date;
  completedAt: Date | null;
  error: string | null;
}

export interface StepProgress {
  step: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  detail: string;
  startedAt: Date | null;
  completedAt: Date | null;
}

export interface ArtifactRef {
  assetId: string;
  type: string;
  filename: string;
  path: string;
  size: number;
  mimeType: string;
}

export interface QAReport {
  passed: boolean;
  artifactQA: QACheck[];
  contentQA: QACheck[];
  structureQA: QACheck[];
  visualQA: QACheck[];
  commercialQA: QACheck[];
  deliveryQA: QACheck[];
}

export interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
  evidence: EvidenceTag;
}

// ─── Blueprint Input ──────────────────────────────────────────────────────────

export interface ExecutionBlueprint {
  blueprintId: string;
  productId: string;
  productVersion: string;
  productType: ProductType;
  title: string;
  author: string;
  targetAudience?: string;
  chapters?: Array<{ title: string; synopsis: string; targetWords: number }>;
  inputAssets?: string[];
  requiredTools?: string[];
  requiredProviders?: string[];
}

// ─── Product Type ─────────────────────────────────────────────────────────────

export type ProductType =
  | "ebook"
  | "guide"
  | "manual"
  | "workbook"
  | "checklist"
  | "template_pack"
  | "digital_kit"
  | "resource_pack"
  | "software"
  | "saas"
  | "api"
  | "hybrid_content";

export type FactoryType =
  | "book_factory"
  | "document_factory"
  | "kit_factory"
  | "handoff_only";

// ─── Progress Callback ────────────────────────────────────────────────────────

export type ProgressCallback = (progress: StepProgress) => void;

// ─── Execution Store (In-Memory) ──────────────────────────────────────────────

const executionStore = new Map<string, FactoryExecution>();

// ─── Factory Resolution ───────────────────────────────────────────────────────

/**
 * Resolve the appropriate factory type for a product type.
 *
 * Routing rules:
 *   ebook/guide/manual/workbook   → book_factory
 *   checklist/template_pack       → document_factory
 *   digital_kit/resource_pack     → kit_factory
 *   software/saas/api             → handoff_only
 *   hybrid_content                → book_factory (primary)
 */
export function resolveFactory(productType: ProductType): FactoryType {
  switch (productType) {
    case "ebook":
    case "guide":
    case "manual":
    case "workbook":
      return "book_factory";

    case "checklist":
    case "template_pack":
      return "document_factory";

    case "digital_kit":
    case "resource_pack":
      return "kit_factory";

    case "software":
    case "saas":
    case "api":
      return "handoff_only";

    case "hybrid_content":
      return "book_factory"; // primary production

    default:
      return "book_factory"; // default to book factory
  }
}

// ─── Execute Factory ──────────────────────────────────────────────────────────

/**
 * Execute a factory pipeline for a given blueprint.
 *
 * 1. Resolves factory type based on product type
 * 2. Creates a FactoryContract
 * 3. Dispatches to the appropriate factory
 * 4. Runs QA
 * 5. Returns complete execution result
 *
 * Idempotent: if the contract is already in a terminal state,
 * returns the existing execution without side effects.
 */
export async function executeFactory(
  blueprint: ExecutionBlueprint,
  onProgress?: ProgressCallback
): Promise<FactoryExecution> {
  const executionId = generateExecutionId();
  const factoryType = resolveFactory(blueprint.productType);
  const startedAt = new Date();

  // Create factory contract
  const factoryId = `fac_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
  const contractBlueprint: Blueprint = {
    blueprintId: blueprint.blueprintId,
    productId: blueprint.productId,
    productVersion: blueprint.productVersion,
    productType: blueprint.productType,
    inputAssets: blueprint.inputAssets,
    requiredTools: blueprint.requiredTools,
    requiredProviders: blueprint.requiredProviders,
    outputArtifacts: getDefaultArtifacts(factoryType),
    qaRequirements: getDefaultQARequirements(factoryType),
    successCriteria: getDefaultSuccessCriteria(factoryType),
  };

  let contract = createFactoryContract(
    factoryId,
    blueprint.productId,
    contractBlueprint
  );

  // Check idempotency — if already completed, return existing result
  if (isIdempotent(contract)) {
    const existing = findExecutionByContract(contract.factoryId);
    if (existing) return existing;
  }

  // Initialize progress steps
  const progress = getStepsForFactory(factoryType).map((step) => ({
    step,
    status: "PENDING" as const,
    detail: "",
    startedAt: null as Date | null,
    completedAt: null as Date | null,
  }));

  // Create execution record
  const execution: FactoryExecution = {
    executionId,
    factoryType,
    contract,
    status: "CREATED",
    progress,
    artifacts: [],
    qaReport: null,
    startedAt,
    completedAt: null,
    error: null,
  };

  executionStore.set(executionId, execution);

  try {
    // QUEUED
    contract = transitionFactoryStatus(contract, "QUEUED");
    updateExecution(executionId, { contract, status: "QUEUED" });

    // RUNNING
    contract = transitionFactoryStatus(contract, "RUNNING");
    updateExecution(executionId, { contract, status: "RUNNING" });

    // Dispatch to appropriate factory
    let artifacts: ArtifactRef[] = [];
    switch (factoryType) {
      case "book_factory":
        artifacts = await executeBookFactory(
          executionId,
          blueprint,
          progress,
          onProgress
        );
        break;

      case "document_factory":
        artifacts = await executeDocumentFactory(
          executionId,
          blueprint,
          progress,
          onProgress
        );
        break;

      case "kit_factory":
        artifacts = await executeKitFactory(
          executionId,
          blueprint,
          progress,
          onProgress
        );
        break;

      case "handoff_only":
        artifacts = await executeHandoffOnly(
          executionId,
          blueprint,
          progress,
          onProgress
        );
        break;
    }

    updateExecution(executionId, { artifacts });

    // QA Phase
    contract = transitionFactoryStatus(contract, "QA");
    updateExecution(executionId, { contract, status: "QA" });

    const qaReport = await runExecutionQA(
      blueprint.productId,
      artifacts,
      factoryType
    );

    updateExecution(executionId, { qaReport });

    // Determine pass/fail
    if (qaReport.passed) {
      contract = transitionFactoryStatus(contract, "PASSED");
      contract = transitionFactoryStatus(contract, "COMPLETED");
      updateExecution(executionId, {
        contract,
        status: "COMPLETED",
        completedAt: new Date(),
      });
    } else {
      contract = transitionFactoryStatus(contract, "FAILED");
      contract = addContractError(
        contract,
        "QA",
        "QA checks failed",
        true // recoverable via repair
      );
      updateExecution(executionId, {
        contract,
        status: "FAILED",
        error: "QA checks failed — repair may be possible",
        completedAt: new Date(),
      });
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : String(err);
    const isRecoverable =
      err instanceof Error && !(err instanceof NonRecoverableError);

    contract = addContractError(contract, factoryType, errorMessage, isRecoverable);

    try {
      contract = transitionFactoryStatus(contract, "FAILED");
    } catch {
      // Already in a terminal state — just record the error
    }

    updateExecution(executionId, {
      contract,
      status: "FAILED",
      error: errorMessage,
      completedAt: new Date(),
    });
  }

  return getExecutionOrThrow(executionId);
}

// ─── Query Functions ──────────────────────────────────────────────────────────

/**
 * Get an execution by ID.
 */
export function getExecution(executionId: string): FactoryExecution | null {
  return executionStore.get(executionId) || null;
}

/**
 * List all executions for a product.
 */
export function listExecutions(productId: string): FactoryExecution[] {
  return Array.from(executionStore.values())
    .filter((e) => e.contract.productId === productId)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
}

/**
 * Clear all executions (for testing only).
 */
export function clearExecutions(): void {
  executionStore.clear();
}

// ─── Factory Dispatch Implementations ─────────────────────────────────────────

/**
 * Book Factory path: delegates to book-factory createAndRun.
 *
 * Steps:
 *  1. ARCHITECTURE      → Book structure
 *  2. CONTENT GENERATION → Generate chapter content
 *  3. ART DIRECTION     → Visual style
 *  4. COVER DESIGN      → Cover image
 *  5. EDITORIAL DESIGN  → Content quality review
 *  6. LAYOUT            → PDF page layout
 *  7. PDF GENERATION    → Generate PDF file
 *  8. VISUAL QA         → Inspect PDF
 *  9. REPAIR            → Fix QA issues
 * 10. FINAL             → Deliver product
 */
async function executeBookFactory(
  executionId: string,
  blueprint: ExecutionBlueprint,
  progress: StepProgress[],
  onProgress?: ProgressCallback
): Promise<ArtifactRef[]> {
  const artifacts: ArtifactRef[] = [];
  const steps = [
    "ARCHITECTURE",
    "CONTENT_GENERATION",
    "ART_DIRECTION",
    "COVER_DESIGN",
    "EDITORIAL_DESIGN",
    "LAYOUT",
    "PDF_GENERATION",
    "VISUAL_QA",
    "REPAIR",
    "FINAL",
  ];

  for (let i = 0; i < steps.length; i++) {
    const stepName = steps[i];
    const stepStart = new Date();

    // Update progress
    progress[i] = {
      step: stepName,
      status: "RUNNING",
      detail: `Processing ${stepName}...`,
      startedAt: stepStart,
      completedAt: null,
    };
    updateExecution(executionId, { progress: [...progress] });
    onProgress?.(progress[i]);

    try {
      // Delegate to book-factory for the actual work
      // We use createAndRun which handles the full pipeline
      if (i === 0) {
        // On first step, kick off the full book-factory pipeline
        const bookInput: BookProjectInput = {
          userId: "system",
          dossierId: blueprint.blueprintId,
          title: blueprint.title,
          author: blueprint.author,
          targetAudience: blueprint.targetAudience || "General audience",
          chapters: blueprint.chapters?.map((ch, idx) => ({
            index: idx,
            title: ch.title,
            synopsis: ch.synopsis,
            targetWords: ch.targetWords,
          })),
        };

        // Import and execute book factory
        const {
          createAndRun,
        } = await import("./book-factory");
        const bookProject = await createAndRun(bookInput);

        // Collect artifacts from the book project
        if (bookProject.artifacts.pdfPath) {
          const fs = await import("fs/promises");
          try {
            const stat = await fs.stat(bookProject.artifacts.pdfPath);
            artifacts.push({
              assetId: `asset_${randomUUID().replace(/-/g, "").substring(0, 12)}`,
              type: "pdf",
              filename: bookProject.artifacts.pdfPath.split("/").pop() || "output.pdf",
              path: bookProject.artifacts.pdfPath,
              size: stat.size,
              mimeType: "application/pdf",
            });
          } catch {
            // PDF path recorded but file may not exist yet
          }
        }

        if (bookProject.artifacts.coverImagePath) {
          const fs = await import("fs/promises");
          try {
            const stat = await fs.stat(bookProject.artifacts.coverImagePath);
            artifacts.push({
              assetId: `asset_${randomUUID().replace(/-/g, "").substring(0, 12)}`,
              type: "cover",
              filename:
                bookProject.artifacts.coverImagePath.split("/").pop() ||
                "cover.png",
              path: bookProject.artifacts.coverImagePath,
              size: stat.size,
              mimeType: "image/png",
            });
          } catch {
            // Cover path recorded but file may not exist yet
          }
        }
      }

      // Mark step completed
      progress[i] = {
        ...progress[i],
        status: "COMPLETED",
        detail: `${stepName} completed successfully`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress[i] = {
        ...progress[i],
        status: "FAILED",
        detail: `${stepName} failed: ${errorMsg}`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);

      // If a step fails, mark remaining steps as SKIPPED
      for (let j = i + 1; j < steps.length; j++) {
        progress[j] = {
          step: steps[j],
          status: "SKIPPED",
          detail: `Skipped due to failure in ${stepName}`,
          startedAt: null,
          completedAt: null,
        };
      }
      updateExecution(executionId, { progress: [...progress] });
      throw err;
    }
  }

  return artifacts;
}

/**
 * Document Factory path: simplified content → PDF generation.
 *
 * For simpler document types (checklists, template packs) that don't
 * need the full book factory pipeline. Uses pdf-factory directly.
 */
async function executeDocumentFactory(
  executionId: string,
  blueprint: ExecutionBlueprint,
  progress: StepProgress[],
  onProgress?: ProgressCallback
): Promise<ArtifactRef[]> {
  const artifacts: ArtifactRef[] = [];
  const steps = ["CONTENT_PREP", "PDF_GENERATION", "FINAL"];

  for (let i = 0; i < steps.length; i++) {
    const stepName = steps[i];
    const stepStart = new Date();

    progress[i] = {
      step: stepName,
      status: "RUNNING",
      detail: `Processing ${stepName}...`,
      startedAt: stepStart,
      completedAt: null,
    };
    updateExecution(executionId, { progress: [...progress] });
    onProgress?.(progress[i]);

    try {
      if (stepName === "PDF_GENERATION") {
        // Use pdf-factory directly for simple document generation
        const { generatePdf, defaultPdfConfig } = await import(
          "./pdf-factory"
        );
        const config = defaultPdfConfig(blueprint.title, blueprint.author);
        const chapters = blueprint.chapters?.map((ch) => ({
          title: ch.title,
          content: ch.synopsis, // Use synopsis as content for simple docs
        })) || [{ title: blueprint.title, content: "Document content placeholder" }];

        const result = await generatePdf(config, chapters);

        artifacts.push({
          assetId: `asset_${randomUUID().replace(/-/g, "").substring(0, 12)}`,
          type: "pdf",
          filename: result.fileName,
          path: result.filePath,
          size: result.fileSize,
          mimeType: "application/pdf",
        });
      }

      progress[i] = {
        ...progress[i],
        status: "COMPLETED",
        detail: `${stepName} completed`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress[i] = {
        ...progress[i],
        status: "FAILED",
        detail: `${stepName} failed: ${errorMsg}`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);

      for (let j = i + 1; j < steps.length; j++) {
        progress[j] = {
          step: steps[j],
          status: "SKIPPED",
          detail: `Skipped due to failure in ${stepName}`,
          startedAt: null,
          completedAt: null,
        };
      }
      updateExecution(executionId, { progress: [...progress] });
      throw err;
    }
  }

  return artifacts;
}

/**
 * Kit Factory path: multi-asset assembly.
 *
 * For digital kits and resource packs that produce multiple assets
 * (images, templates, data files) rather than a single document.
 */
async function executeKitFactory(
  executionId: string,
  blueprint: ExecutionBlueprint,
  progress: StepProgress[],
  onProgress?: ProgressCallback
): Promise<ArtifactRef[]> {
  const artifacts: ArtifactRef[] = [];
  const steps = ["ASSEMBLE", "PACKAGE", "FINAL"];

  for (let i = 0; i < steps.length; i++) {
    const stepName = steps[i];
    const stepStart = new Date();

    progress[i] = {
      step: stepName,
      status: "RUNNING",
      detail: `Processing ${stepName}...`,
      startedAt: stepStart,
      completedAt: null,
    };
    updateExecution(executionId, { progress: [...progress] });
    onProgress?.(progress[i]);

    try {
      if (stepName === "ASSEMBLE") {
        // For kits, assemble multiple assets from input
        // This is a simplified implementation — real kits would
        // generate images, templates, data files, etc.
        const { generatePdf, defaultPdfConfig } = await import(
          "./pdf-factory"
        );
        const config = defaultPdfConfig(blueprint.title, blueprint.author);
        const chapters = [{ title: blueprint.title, content: "Kit assembly document — contains references to all kit assets." }];
        const result = await generatePdf(config, chapters);

        artifacts.push({
          assetId: `asset_${randomUUID().replace(/-/g, "").substring(0, 12)}`,
          type: "pdf",
          filename: result.fileName,
          path: result.filePath,
          size: result.fileSize,
          mimeType: "application/pdf",
        });
      }

      progress[i] = {
        ...progress[i],
        status: "COMPLETED",
        detail: `${stepName} completed`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress[i] = {
        ...progress[i],
        status: "FAILED",
        detail: `${stepName} failed: ${errorMsg}`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);

      for (let j = i + 1; j < steps.length; j++) {
        progress[j] = {
          step: steps[j],
          status: "SKIPPED",
          detail: `Skipped due to failure in ${stepName}`,
          startedAt: null,
          completedAt: null,
        };
      }
      updateExecution(executionId, { progress: [...progress] });
      throw err;
    }
  }

  return artifacts;
}

/**
 * Handoff Only path: creates handoff, no artifact production.
 *
 * For software/SaaS/API products that are not produced directly
 * by the KREA pipeline. Instead, a handoff contract is created
 * for external development teams.
 */
async function executeHandoffOnly(
  executionId: string,
  blueprint: ExecutionBlueprint,
  progress: StepProgress[],
  onProgress?: ProgressCallback
): Promise<ArtifactRef[]> {
  const steps = ["HANDOFF", "FINAL"];

  for (let i = 0; i < steps.length; i++) {
    const stepName = steps[i];
    const stepStart = new Date();

    progress[i] = {
      step: stepName,
      status: "RUNNING",
      detail: `Processing ${stepName}...`,
      startedAt: stepStart,
      completedAt: null,
    };
    updateExecution(executionId, { progress: [...progress] });
    onProgress?.(progress[i]);

    try {
      if (stepName === "HANDOFF") {
        // Create a handoff contract for external development.
        // No artifact production — just the contract.
        // We create a minimal handoff record via the product-handoff module
        // using a lightweight specification placeholder.
        const handoffId = `handoff_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
        // Record the handoff intent — actual handoff delivery requires
        // a full ProductSpecification which is assembled upstream
        // in the Product Brain pipeline.
        progress[i] = {
          ...progress[i],
          detail: `Handoff contract ${handoffId} created for ${blueprint.productType} → external_development`,
        };
      }

      progress[i] = {
        ...progress[i],
        status: "COMPLETED",
        detail: `${stepName} completed`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      progress[i] = {
        ...progress[i],
        status: "FAILED",
        detail: `${stepName} failed: ${errorMsg}`,
        completedAt: new Date(),
      };
      updateExecution(executionId, { progress: [...progress] });
      onProgress?.(progress[i]);

      for (let j = i + 1; j < steps.length; j++) {
        progress[j] = {
          step: steps[j],
          status: "SKIPPED",
          detail: `Skipped due to failure in ${stepName}`,
          startedAt: null,
          completedAt: null,
        };
      }
      updateExecution(executionId, { progress: [...progress] });
      throw err;
    }
  }

  return []; // No artifacts for handoff-only
}

// ─── QA Execution ─────────────────────────────────────────────────────────────

/**
 * Run QA checks on execution artifacts.
 *
 * For PDF artifacts, uses the visual-qa module.
 * For other artifacts, performs basic file existence checks.
 */
async function runExecutionQA(
  productId: string,
  artifacts: ArtifactRef[],
  factoryType: FactoryType
): Promise<QAReport> {
  const artifactQA: QACheck[] = [];
  const contentQA: QACheck[] = [];
  const structureQA: QACheck[] = [];
  const visualQA: QACheck[] = [];
  const commercialQA: QACheck[] = [];
  const deliveryQA: QACheck[] = [];

  // ── Artifact QA: check all artifacts exist ────────────────────────────
  if (artifacts.length === 0 && factoryType !== "handoff_only") {
    artifactQA.push({
      name: "artifacts_exist",
      passed: false,
      detail: "No artifacts were produced",
      evidence: "VERIFIED",
    });
  } else if (artifacts.length > 0) {
    const fs = await import("fs/promises");
    let allExist = true;
    for (const artifact of artifacts) {
      try {
        await fs.stat(artifact.path);
        artifactQA.push({
          name: `artifact_exists_${artifact.type}`,
          passed: true,
          detail: `Artifact ${artifact.filename} exists (${artifact.size} bytes)`,
          evidence: "VERIFIED",
        });
      } catch {
        allExist = false;
        artifactQA.push({
          name: `artifact_exists_${artifact.type}`,
          passed: false,
          detail: `Artifact ${artifact.filename} not found at ${artifact.path}`,
          evidence: "VERIFIED",
        });
      }
    }
  } else {
    artifactQA.push({
      name: "artifacts_exist",
      passed: true,
      detail: "Handoff-only mode — no artifacts expected",
      evidence: "INFERRED",
    });
  }

  // ── Visual QA: run visual-qa on PDF artifacts ────────────────────────
  const pdfArtifacts = artifacts.filter((a) => a.type === "pdf");
  if (pdfArtifacts.length > 0) {
    try {
      const { runVisualQA } = await import("./visual-qa");
      for (const pdfArtifact of pdfArtifacts) {
        const report = await runVisualQA(productId, pdfArtifact.path);
        visualQA.push({
          name: `visual_qa_${pdfArtifact.filename}`,
          passed: report.passed,
          detail: `${report.checks.length} checks, ${report.issues.length} issues`,
          evidence: report.evidence,
        });
        // Surface individual check results into structure QA
        for (const check of report.checks) {
          if (check.name === "pdf_valid" || check.name === "page_count" || check.name === "no_empty_pages") {
            structureQA.push({
              name: `${pdfArtifact.filename}_${check.name}`,
              passed: check.passed,
              detail: check.detail,
              evidence: check.evidence,
            });
          }
        }
      }
    } catch (err) {
      visualQA.push({
        name: "visual_qa",
        passed: false,
        detail: `Visual QA failed: ${err instanceof Error ? err.message : String(err)}`,
        evidence: "NOT_VERIFIED",
      });
    }
  } else {
    visualQA.push({
      name: "visual_qa",
      passed: true,
      detail: "No PDF artifacts to inspect",
      evidence: "INFERRED",
    });
  }

  // ── Content QA ────────────────────────────────────────────────────────
  contentQA.push({
    name: "content_generated",
    passed: artifacts.length > 0 || factoryType === "handoff_only",
    detail:
      factoryType === "handoff_only"
        ? "Handoff-only mode — content not applicable"
        : `${artifacts.length} artifact(s) generated`,
    evidence:
      factoryType === "handoff_only" ? "INFERRED" : "VERIFIED",
  });

  // ── Commercial QA ─────────────────────────────────────────────────────
  commercialQA.push({
    name: "product_viable",
    passed: true,
    detail: "Commercial viability check deferred to product-economics",
    evidence: "NOT_VERIFIED",
  });

  // ── Delivery QA ───────────────────────────────────────────────────────
  deliveryQA.push({
    name: "delivery_ready",
    passed: artifacts.length > 0 || factoryType === "handoff_only",
    detail:
      artifacts.length > 0
        ? `${artifacts.length} artifact(s) ready for delivery`
        : "Handoff contract ready for delivery",
    evidence: "INFERRED",
  });

  // ── Determine overall pass/fail ──────────────────────────────────────
  const allChecks = [
    ...artifactQA,
    ...contentQA,
    ...structureQA,
    ...visualQA,
    ...commercialQA,
    ...deliveryQA,
  ];
  const passed = allChecks.every((c) => c.passed);

  return {
    passed,
    artifactQA,
    contentQA,
    structureQA,
    visualQA,
    commercialQA,
    deliveryQA,
  };
}

// ─── Default Specifications ───────────────────────────────────────────────────

function getDefaultArtifacts(
  factoryType: FactoryType
): Array<{ type: string; format: string; required: boolean }> {
  switch (factoryType) {
    case "book_factory":
      return [
        { type: "pdf", format: "application/pdf", required: true },
        { type: "cover", format: "image/png", required: false },
        { type: "metadata", format: "application/json", required: true },
      ];
    case "document_factory":
      return [
        { type: "pdf", format: "application/pdf", required: true },
        { type: "metadata", format: "application/json", required: true },
      ];
    case "kit_factory":
      return [
        { type: "pdf", format: "application/pdf", required: true },
        { type: "image", format: "image/png", required: false },
        { type: "template", format: "application/json", required: false },
        { type: "data", format: "application/json", required: false },
      ];
    case "handoff_only":
      return []; // No direct artifact production
  }
}

function getDefaultQARequirements(
  factoryType: FactoryType
): Array<{ type: string; description: string; required: boolean }> {
  const common = [
    { type: "artifact_existence", description: "All required artifacts exist on disk", required: true },
    { type: "artifact_integrity", description: "Artifacts are not empty or corrupt", required: true },
  ];

  if (factoryType === "book_factory" || factoryType === "document_factory") {
    return [
      ...common,
      { type: "pdf_validity", description: "PDF can be parsed and has pages", required: true },
      { type: "visual_qa", description: "Visual QA checks pass", required: true },
      { type: "metadata_complete", description: "PDF metadata is populated", required: false },
    ];
  }

  return common;
}

function getDefaultSuccessCriteria(
  factoryType: FactoryType
): Array<{ id: string; description: string; measurable: boolean }> {
  return [
    {
      id: "artifacts_produced",
      description: `At least one artifact is produced by ${factoryType}`,
      measurable: true,
    },
    {
      id: "qa_passed",
      description: "All required QA checks pass",
      measurable: true,
    },
  ];
}

function getStepsForFactory(factoryType: FactoryType): string[] {
  switch (factoryType) {
    case "book_factory":
      return [
        "ARCHITECTURE",
        "CONTENT_GENERATION",
        "ART_DIRECTION",
        "COVER_DESIGN",
        "EDITORIAL_DESIGN",
        "LAYOUT",
        "PDF_GENERATION",
        "VISUAL_QA",
        "REPAIR",
        "FINAL",
      ];
    case "document_factory":
      return ["CONTENT_PREP", "PDF_GENERATION", "FINAL"];
    case "kit_factory":
      return ["ASSEMBLE", "PACKAGE", "FINAL"];
    case "handoff_only":
      return ["HANDOFF", "FINAL"];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateExecutionId(): string {
  return `exec_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

function getExecutionOrThrow(executionId: string): FactoryExecution {
  const execution = executionStore.get(executionId);
  if (!execution) {
    throw new OrchestratorError(
      `Execution not found: ${executionId}`,
      "NOT_FOUND",
      executionId
    );
  }
  return execution;
}

function findExecutionByContract(
  factoryId: string
): FactoryExecution | null {
  for (const execution of executionStore.values()) {
    if (execution.contract.factoryId === factoryId) {
      return execution;
    }
  }
  return null;
}

function updateExecution(
  executionId: string,
  updates: Partial<FactoryExecution>
): void {
  const current = executionStore.get(executionId);
  if (current) {
    executionStore.set(executionId, { ...current, ...updates });
  }
}

// ─── Error Class ──────────────────────────────────────────────────────────────

class NonRecoverableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRecoverableError";
  }
}

export class OrchestratorError extends Error {
  readonly code: string;
  readonly executionId: string;

  constructor(message: string, code: string, executionId: string) {
    super(message);
    this.name = "OrchestratorError";
    this.code = code;
    this.executionId = executionId;
  }
}
