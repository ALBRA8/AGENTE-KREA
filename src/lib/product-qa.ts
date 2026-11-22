/**
 * Product QA — KREA V2.1
 *
 * Expanded QA from artifact-level QA to full product QA with 6 categories:
 *   1. artifactQA   — Does the file work? (exists, readable, valid format, MIME)
 *   2. contentQA    — Is content complete? (sections, word counts, no placeholders)
 *   3. structureQA  — Does structure match blueprint? (sections, order, page count)
 *   4. visualQA     — Is visual quality sufficient? (delegates to visual-qa)
 *   5. commercialQA — Is product correctly packaged? (pricing, customer, integrity)
 *   6. deliveryQA   — Can customer receive/use it? (format, access, guide)
 *
 * CRITICAL RULES:
 *   - Never fake QA results — if a check can't be performed, mark NOT_VERIFIED
 *   - Never inflate scores — missing data means low score
 *   - All evidence tags must be honest
 *   - Use crypto.randomUUID() for IDs
 */

import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { PDFDocument } from "pdf-lib";
import type { EvidenceTag } from "@/lib/product-fit";
import { runVisualQA, repairIssue } from "@/lib/visual-qa";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductQAReport {
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
  overallScore: number; // 0-1
  criticalIssues: QAIssue[];
  warnings: QAIssue[];
  evidence: EvidenceTag;
  inspectedAt: Date;
}

export interface QACategoryResult {
  category: string;
  passed: boolean;
  score: number; // 0-1
  checks: QACheck[];
  issues: QAIssue[];
}

export interface QACheck {
  name: string;
  passed: boolean;
  score: number; // 0-1
  detail: string;
  evidence: EvidenceTag;
}

export interface QAIssue {
  id: string;
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
  category: string;
  description: string;
  repairable: boolean;
  repairAction: string | null;
}

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ArtifactRef {
  path: string;
  type: string; // "pdf" | "epub" | "html" | "image" | "text" | "other"
  label?: string;
}

export interface BlueprintSection {
  id: string;
  title: string;
  required: boolean;
  minWordCount?: number;
  order?: number;
}

export interface Blueprint {
  sections: BlueprintSection[];
  expectedPageRange?: { min: number; max: number };
  expectedFormat?: string;
}

export interface CommercialProduct {
  hasPricing: boolean;
  hasTargetCustomer: boolean;
  hasValueProposition: boolean;
  hasProblemStatement: boolean;
  hasDifferentiation: boolean;
  testimonials: TestimonialRef[];
  claims: string[];
}

export interface TestimonialRef {
  text: string;
  author: string;
  verified: boolean;
}

export interface Packaging {
  deliveryFormat: string | null;
  accessMethod: string | null;
  usageGuide: string | null;
  prerequisites: string[];
  supportInfo: string | null;
}

export interface ProductContent {
  sections: ContentSection[];
  totalPages?: number;
  fullText?: string;
}

export interface ContentSection {
  id: string;
  title: string;
  content: string;
}

export interface RepairResult {
  repaired: boolean;
  action: string;
  evidence: EvidenceTag;
  detail: string;
}

// ─── MIME type mapping ────────────────────────────────────────────────────────

const EXPECTED_MIME_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  epub: ["application/epub+zip"],
  html: ["text/html"],
  image: ["image/png", "image/jpeg", "image/gif", "image/svg+xml", "image/webp"],
  text: ["text/plain", "text/markdown", "text/csv"],
  other: [],
};

// ─── Placeholder detection patterns ───────────────────────────────────────────

const PLACEHOLDER_PATTERNS = [
  /\[TODO\]/i,
  /\[PLACEHOLDER\]/i,
  /\[INSERT\s+/i,
  /\[TBD\]/i,
  /\[FILL\s+IN\]/i,
  /lorem\s+ipsum/i,
  /\[YOUR\s+/i,
  /\[EXAMPLE\]/i,
  /<<.*?>>/g,
];

// ─── Main Function ────────────────────────────────────────────────────────────

/**
 * Run full product QA across all 6 categories.
 *
 * Each category is evaluated independently. The overall score is the
 * weighted average of all category scores. Overall pass requires no
 * CRITICAL issues.
 *
 * CRITICAL: Never inflates scores. Missing data → low score + warnings.
 */
export async function runProductQA(
  productId: string,
  version: string,
  artifacts: ArtifactRef[],
  blueprint?: Blueprint,
  commercialProduct?: CommercialProduct,
  packaging?: Packaging,
  content?: ProductContent
): Promise<ProductQAReport> {
  const reportId = `pqa_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
  const inspectedAt = new Date();

  // Run each QA category
  const artifactQA = await runArtifactQA(artifacts);
  const contentQA = runContentQA(content, blueprint);
  const structureQA = runStructureQA(content, blueprint);
  const visualQA = await runVisualQACategory(productId, artifacts);
  const commercialQAResult = runCommercialQA(commercialProduct);
  const deliveryQAResult = runDeliveryQA(packaging);

  // Aggregate all issues
  const allIssues = [
    ...artifactQA.issues,
    ...contentQA.issues,
    ...structureQA.issues,
    ...visualQA.issues,
    ...commercialQAResult.issues,
    ...deliveryQAResult.issues,
  ];

  const criticalIssues = allIssues.filter(
    (i) => i.severity === "CRITICAL"
  );
  const warnings = allIssues.filter(
    (i) => i.severity === "MAJOR" || i.severity === "MINOR"
  );

  // Weighted overall score (equal weights for now)
  const overallScore =
    (artifactQA.score +
      contentQA.score +
      structureQA.score +
      visualQA.score +
      commercialQAResult.score +
      deliveryQAResult.score) /
    6;

  const overallPassed = criticalIssues.length === 0 && overallScore >= 0.5;

  // Overall evidence: VERIFIED only if at least one category has VERIFIED evidence
  const anyVerified = [
    artifactQA,
    contentQA,
    structureQA,
    visualQA,
    commercialQAResult,
    deliveryQAResult,
  ].some((cat) => cat.checks.some((c) => c.evidence === "VERIFIED"));

  const evidence: EvidenceTag = anyVerified ? "VERIFIED" : "NOT_VERIFIED";

  return {
    reportId,
    productId,
    version,
    overallPassed,
    artifactQA,
    contentQA,
    structureQA,
    visualQA,
    commercialQA: commercialQAResult,
    deliveryQA: deliveryQAResult,
    overallScore: Math.round(overallScore * 1000) / 1000, // 3 decimal places
    criticalIssues,
    warnings,
    evidence,
    inspectedAt,
  };
}

// ─── Category 1: Artifact QA ──────────────────────────────────────────────────

/**
 * Artifact QA — Does the file work?
 *
 * Checks:
 * - File exists and is readable
 * - File is non-zero size
 * - Valid format (PDF is valid PDF, etc.)
 * - File matches expected MIME type
 */
export async function runArtifactQA(
  artifacts: ArtifactRef[]
): Promise<QACategoryResult> {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];
  let totalScore = 0;

  if (artifacts.length === 0) {
    checks.push({
      name: "artifacts_exist",
      passed: false,
      score: 0,
      detail: "No artifacts provided for QA",
      evidence: "VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "CRITICAL",
      category: "artifact",
      description: "No artifacts provided for QA inspection",
      repairable: false,
      repairAction: null,
    });
    return {
      category: "artifact",
      passed: false,
      score: 0,
      checks,
      issues,
    };
  }

  for (const artifact of artifacts) {
    const artifactLabel = artifact.label || artifact.path;

    // Check 1: File exists and is readable
    let fileExists = false;
    let fileSize = 0;
    try {
      const stat = await fs.stat(artifact.path);
      fileExists = true;
      fileSize = stat.size;
      checks.push({
        name: `file_exists:${artifactLabel}`,
        passed: true,
        score: 1,
        detail: `File exists: ${artifact.path} (${stat.size} bytes)`,
        evidence: "VERIFIED",
      });
    } catch {
      checks.push({
        name: `file_exists:${artifactLabel}`,
        passed: false,
        score: 0,
        detail: `File not found: ${artifact.path}`,
        evidence: "VERIFIED",
      });
      issues.push({
        id: generateIssueId(),
        severity: "CRITICAL",
        category: "artifact",
        description: `Artifact file does not exist: ${artifact.path}`,
        repairable: true,
        repairAction: "regenerate_artifact",
      });
      continue; // Skip remaining checks for this artifact
    }

    // Check 2: File is non-zero size
    const sizeOk = fileSize > 0;
    checks.push({
      name: `file_size:${artifactLabel}`,
      passed: sizeOk,
      score: sizeOk ? 1 : 0,
      detail: sizeOk
        ? `File size is ${fileSize} bytes`
        : `File is empty (0 bytes): ${artifact.path}`,
      evidence: "VERIFIED",
    });
    if (!sizeOk) {
      issues.push({
        id: generateIssueId(),
        severity: "CRITICAL",
        category: "artifact",
        description: `Artifact is empty: ${artifact.path}`,
        repairable: true,
        repairAction: "regenerate_artifact",
      });
      continue;
    }

    // Check 3: Valid format
    const formatResult = await validateFormat(
      artifact.path,
      artifact.type
    );
    checks.push({
      name: `format_valid:${artifactLabel}`,
      passed: formatResult.valid,
      score: formatResult.valid ? 1 : 0,
      detail: formatResult.detail,
      evidence: formatResult.evidence,
    });
    if (!formatResult.valid) {
      issues.push({
        id: generateIssueId(),
        severity: "CRITICAL",
        category: "artifact",
        description: `Invalid format for ${artifact.type} artifact: ${artifact.path}`,
        repairable: true,
        repairAction: "regenerate_artifact",
      });
    }

    // Check 4: MIME type matches expected
    const mimeResult = await validateMimeType(
      artifact.path,
      artifact.type
    );
    checks.push({
      name: `mime_type:${artifactLabel}`,
      passed: mimeResult.valid,
      score: mimeResult.valid ? 1 : 0,
      detail: mimeResult.detail,
      evidence: mimeResult.evidence,
    });
    if (!mimeResult.valid) {
      issues.push({
        id: generateIssueId(),
        severity: "MAJOR",
        category: "artifact",
        description: `MIME type mismatch for ${artifact.type} artifact: ${artifact.path}`,
        repairable: false,
        repairAction: null,
      });
    }
  }

  // Calculate category score
  if (checks.length > 0) {
    totalScore = checks.reduce((sum, c) => sum + c.score, 0) / checks.length;
  }

  const passed = issues.filter((i) => i.severity === "CRITICAL").length === 0;

  return {
    category: "artifact",
    passed,
    score: Math.round(totalScore * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Category 2: Content QA ───────────────────────────────────────────────────

/**
 * Content QA — Is content complete?
 *
 * Checks:
 * - All blueprint sections have content
 * - Content meets minimum word counts
 * - No placeholder text remains
 * - Language quality (basic checks)
 */
export function runContentQA(
  content: ProductContent | undefined,
  blueprint: Blueprint | undefined
): QACategoryResult {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];

  if (!content || !blueprint) {
    checks.push({
      name: "content_available",
      passed: false,
      score: 0,
      detail: "Content or blueprint not provided for content QA",
      evidence: "NOT_VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "content",
      description: "Cannot perform content QA without content and blueprint",
      repairable: false,
      repairAction: null,
    });
    return {
      category: "content",
      passed: false,
      score: 0,
      checks,
      issues,
    };
  }

  // Check 1: All required blueprint sections have content
  const requiredSections = blueprint.sections.filter((s) => s.required);
  const contentSectionIds = new Set(content.sections.map((s) => s.id));

  let missingRequired = 0;
  for (const section of requiredSections) {
    const hasContent =
      contentSectionIds.has(section.id) &&
      content.sections.find(
        (s) => s.id === section.id && s.content.trim().length > 0
      );
    const passed = !!hasContent;
    checks.push({
      name: `section_has_content:${section.id}`,
      passed,
      score: passed ? 1 : 0,
      detail: passed
        ? `Required section "${section.title}" has content`
        : `Required section "${section.title}" is missing or empty`,
      evidence: "VERIFIED",
    });
    if (!passed) {
      missingRequired++;
      issues.push({
        id: generateIssueId(),
        severity: "MAJOR",
        category: "content",
        description: `Required section "${section.title}" is missing or empty`,
        repairable: true,
        repairAction: `add_content_for_section:${section.id}`,
      });
    }
  }

  // Check 2: Content meets minimum word counts
  let wordCountFailures = 0;
  for (const section of blueprint.sections) {
    if (section.minWordCount) {
      const contentSection = content.sections.find(
        (s) => s.id === section.id
      );
      const wordCount = contentSection
        ? contentSection.content.split(/\s+/).filter(Boolean).length
        : 0;
      const meetsMin = wordCount >= section.minWordCount;
      const ratio = Math.min(1, wordCount / section.minWordCount);

      checks.push({
        name: `word_count:${section.id}`,
        passed: meetsMin,
        score: ratio,
        detail: meetsMin
          ? `Section "${section.title}" has ${wordCount} words (min: ${section.minWordCount})`
          : `Section "${section.title}" has ${wordCount} words (min: ${section.minWordCount}) — ${Math.round(ratio * 100)}% of minimum`,
        evidence: "VERIFIED",
      });
      if (!meetsMin) {
        wordCountFailures++;
        issues.push({
          id: generateIssueId(),
          severity: "MINOR",
          category: "content",
          description: `Section "${section.title}" below minimum word count: ${wordCount}/${section.minWordCount}`,
          repairable: true,
          repairAction: `expand_content_for_section:${section.id}`,
        });
      }
    }
  }

  // Check 3: No placeholder text remains
  const fullText =
    content.fullText ||
    content.sections.map((s) => s.content).join("\n");
  const placeholderHits: string[] = [];
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = fullText.match(pattern);
    if (matches) {
      placeholderHits.push(...matches);
    }
  }
  const noPlaceholders = placeholderHits.length === 0;
  checks.push({
    name: "no_placeholders",
    passed: noPlaceholders,
    score: noPlaceholders ? 1 : Math.max(0, 1 - placeholderHits.length * 0.1),
    detail: noPlaceholders
      ? "No placeholder text found"
      : `Found ${placeholderHits.length} placeholder(s): ${placeholderHits.slice(0, 5).join(", ")}${placeholderHits.length > 5 ? "..." : ""}`,
    evidence: "VERIFIED",
  });
  if (!noPlaceholders) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "content",
      description: `Placeholder text found (${placeholderHits.length} instances)`,
      repairable: true,
      repairAction: "replace_placeholders",
    });
  }

  // Check 4: Language quality (basic checks — repeated words, short sections)
  let shortSections = 0;
  for (const section of content.sections) {
    const wordCount = section.content.split(/\s+/).filter(Boolean).length;
    if (wordCount < 20 && wordCount > 0) {
      shortSections++;
    }
  }
  const languageOk = shortSections === 0;
  checks.push({
    name: "language_quality",
    passed: languageOk,
    score: languageOk
      ? 1
      : Math.max(0, 1 - shortSections * 0.1),
    detail: languageOk
      ? "All sections have adequate content length"
      : `${shortSections} section(s) have very short content (<20 words)`,
    evidence: "VERIFIED",
  });
  if (!languageOk) {
    issues.push({
      id: generateIssueId(),
      severity: "MINOR",
      category: "content",
      description: `${shortSections} section(s) have very short content`,
      repairable: true,
      repairAction: "expand_short_sections",
    });
  }

  // Calculate score
  const score =
    checks.length > 0
      ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
      : 0;

  const passed =
    issues.filter((i) => i.severity === "CRITICAL").length === 0 &&
    score >= 0.5;

  return {
    category: "content",
    passed,
    score: Math.round(score * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Category 3: Structure QA ─────────────────────────────────────────────────

/**
 * Structure QA — Does structure match blueprint?
 *
 * Checks:
 * - Required sections present
 * - Section order matches blueprint
 * - Page count within expected range
 */
export function runStructureQA(
  content: ProductContent | undefined,
  blueprint: Blueprint | undefined
): QACategoryResult {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];

  if (!content || !blueprint) {
    checks.push({
      name: "structure_available",
      passed: false,
      score: 0,
      detail: "Content or blueprint not provided for structure QA",
      evidence: "NOT_VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "structure",
      description: "Cannot perform structure QA without content and blueprint",
      repairable: false,
      repairAction: null,
    });
    return {
      category: "structure",
      passed: false,
      score: 0,
      checks,
      issues,
    };
  }

  // Check 1: Required sections present
  const contentSectionIds = new Set(content.sections.map((s) => s.id));
  const requiredBlueprintSections = blueprint.sections.filter((s) => s.required);
  const presentRequired = requiredBlueprintSections.filter((s) =>
    contentSectionIds.has(s.id)
  );
  const sectionPresenceScore =
    requiredBlueprintSections.length > 0
      ? presentRequired.length / requiredBlueprintSections.length
      : 1;

  checks.push({
    name: "required_sections_present",
    passed: sectionPresenceScore === 1,
    score: sectionPresenceScore,
    detail:
      sectionPresenceScore === 1
        ? `All ${requiredBlueprintSections.length} required sections present`
        : `${presentRequired.length}/${requiredBlueprintSections.length} required sections present`,
    evidence: "VERIFIED",
  });
  if (sectionPresenceScore < 1) {
    const missing = requiredBlueprintSections.filter(
      (s) => !contentSectionIds.has(s.id)
    );
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "structure",
      description: `Missing required sections: ${missing.map((s) => s.title).join(", ")}`,
      repairable: true,
      repairAction: "add_missing_sections",
    });
  }

  // Check 2: Section order matches blueprint
  const orderedBlueprintSections = blueprint.sections
    .filter((s) => s.order !== undefined)
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  if (orderedBlueprintSections.length > 1) {
    let orderCorrect = true;
    for (let i = 0; i < orderedBlueprintSections.length - 1; i++) {
      const currentIdx = content.sections.findIndex(
        (s) => s.id === orderedBlueprintSections[i].id
      );
      const nextIdx = content.sections.findIndex(
        (s) => s.id === orderedBlueprintSections[i + 1].id
      );
      if (currentIdx !== -1 && nextIdx !== -1 && currentIdx > nextIdx) {
        orderCorrect = false;
        break;
      }
    }
    checks.push({
      name: "section_order",
      passed: orderCorrect,
      score: orderCorrect ? 1 : 0.5,
      detail: orderCorrect
        ? "Section order matches blueprint"
        : "Section order does not match blueprint ordering",
      evidence: "VERIFIED",
    });
    if (!orderCorrect) {
      issues.push({
        id: generateIssueId(),
        severity: "MINOR",
        category: "structure",
        description: "Section order does not match blueprint",
        repairable: true,
        repairAction: "reorder_sections",
      });
    }
  }

  // Check 3: Page count within expected range
  if (blueprint.expectedPageRange && content.totalPages !== undefined) {
    const { min, max } = blueprint.expectedPageRange;
    const inRange =
      content.totalPages >= min && content.totalPages <= max;
    const distanceBelow = Math.max(0, min - content.totalPages);
    const distanceAbove = Math.max(0, content.totalPages - max);
    const maxDistance = Math.max(distanceBelow, distanceAbove);
    const rangeScore = inRange
      ? 1
      : Math.max(0, 1 - maxDistance / (max - min || 1));

    checks.push({
      name: "page_count_range",
      passed: inRange,
      score: rangeScore,
      detail: inRange
        ? `Page count ${content.totalPages} is within range [${min}, ${max}]`
        : `Page count ${content.totalPages} is outside range [${min}, ${max}]`,
      evidence: "VERIFIED",
    });
    if (!inRange) {
      issues.push({
        id: generateIssueId(),
        severity: "MINOR",
        category: "structure",
        description: `Page count ${content.totalPages} outside expected range [${min}, ${max}]`,
        repairable: true,
        repairAction: "adjust_content_length",
      });
    }
  }

  // Calculate score
  const score =
    checks.length > 0
      ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
      : 0;

  const passed =
    issues.filter((i) => i.severity === "CRITICAL").length === 0 &&
    score >= 0.5;

  return {
    category: "structure",
    passed,
    score: Math.round(score * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Category 4: Visual QA ────────────────────────────────────────────────────

/**
 * Visual QA — Is visual quality sufficient?
 *
 * Delegates to visual-qa module for real PDF inspection.
 * If no PDF artifacts are present, marks as NOT_VERIFIED.
 * Rendering quality checks are always marked NOT_VERIFIED since
 * they require a visual renderer.
 */
async function runVisualQACategory(
  productId: string,
  artifacts: ArtifactRef[]
): Promise<QACategoryResult> {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];

  const pdfArtifacts = artifacts.filter((a) => a.type === "pdf");

  if (pdfArtifacts.length === 0) {
    checks.push({
      name: "visual_qa_available",
      passed: false,
      score: 0,
      detail: "No PDF artifacts found for visual QA",
      evidence: "NOT_VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "INFO",
      category: "visual",
      description: "No PDF artifacts available for visual QA",
      repairable: false,
      repairAction: null,
    });
    return {
      category: "visual",
      passed: true, // Not a failure — just not applicable
      score: 0,
      checks,
      issues,
    };
  }

  // Run visual QA on each PDF artifact
  let totalVisualScore = 0;
  for (const pdfArtifact of pdfArtifacts) {
    const artifactLabel = pdfArtifact.label || pdfArtifact.path;

    try {
      const qaReport = await runVisualQA(productId, pdfArtifact.path);

      // Map visual-qa checks to product-qa checks
      for (const check of qaReport.checks) {
        checks.push({
          name: `visual:${check.name}:${artifactLabel}`,
          passed: check.passed,
          score: check.passed ? 1 : 0,
          detail: check.detail,
          evidence: check.evidence,
        });
      }

      // Map visual-qa issues to product-qa issues
      for (const issue of qaReport.issues) {
        issues.push({
          id: generateIssueId(),
          severity: issue.severity,
          category: "visual",
          description: issue.description,
          repairable: issue.repairable,
          repairAction: issue.repairAction || null,
        });
      }

      totalVisualScore += qaReport.passed ? 1 : 0.5;
    } catch (err) {
      checks.push({
        name: `visual_qa_run:${artifactLabel}`,
        passed: false,
        score: 0,
        detail: `Visual QA failed: ${err instanceof Error ? err.message : String(err)}`,
        evidence: "NOT_VERIFIED",
      });
      issues.push({
        id: generateIssueId(),
        severity: "MAJOR",
        category: "visual",
        description: `Visual QA could not be performed on ${pdfArtifact.path}`,
        repairable: true,
        repairAction: "regenerate_artifact",
      });
    }
  }

  // Calculate score based on checks
  const score =
    checks.length > 0
      ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
      : 0;

  const passed =
    issues.filter((i) => i.severity === "CRITICAL").length === 0;

  return {
    category: "visual",
    passed,
    score: Math.round(score * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Category 5: Commercial QA ────────────────────────────────────────────────

/**
 * Commercial QA — Is product correctly packaged for sale?
 *
 * Checks:
 * - Has commercial definition
 * - Has pricing
 * - Has target customer
 * - Has value proposition
 * - No integrity issues (no fake testimonials, etc.)
 */
export function runCommercialQA(
  commercialProduct: CommercialProduct | undefined
): QACategoryResult {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];

  if (!commercialProduct) {
    checks.push({
      name: "commercial_definition",
      passed: false,
      score: 0,
      detail: "No commercial product definition provided",
      evidence: "NOT_VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: "Product lacks commercial definition",
      repairable: true,
      repairAction: "define_commercial_product",
    });
    return {
      category: "commercial",
      passed: false,
      score: 0,
      checks,
      issues,
    };
  }

  // Check 1: Has pricing
  checks.push({
    name: "has_pricing",
    passed: commercialProduct.hasPricing,
    score: commercialProduct.hasPricing ? 1 : 0,
    detail: commercialProduct.hasPricing
      ? "Product has pricing defined"
      : "Product lacks pricing information",
    evidence: "VERIFIED",
  });
  if (!commercialProduct.hasPricing) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: "Product has no pricing defined",
      repairable: true,
      repairAction: "add_pricing",
    });
  }

  // Check 2: Has target customer
  checks.push({
    name: "has_target_customer",
    passed: commercialProduct.hasTargetCustomer,
    score: commercialProduct.hasTargetCustomer ? 1 : 0,
    detail: commercialProduct.hasTargetCustomer
      ? "Target customer is defined"
      : "Target customer is not defined",
    evidence: "VERIFIED",
  });
  if (!commercialProduct.hasTargetCustomer) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: "Product has no target customer defined",
      repairable: true,
      repairAction: "define_target_customer",
    });
  }

  // Check 3: Has value proposition
  checks.push({
    name: "has_value_proposition",
    passed: commercialProduct.hasValueProposition,
    score: commercialProduct.hasValueProposition ? 1 : 0,
    detail: commercialProduct.hasValueProposition
      ? "Value proposition is defined"
      : "Value proposition is not defined",
    evidence: "VERIFIED",
  });
  if (!commercialProduct.hasValueProposition) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: "Product has no value proposition",
      repairable: true,
      repairAction: "define_value_proposition",
    });
  }

  // Check 4: Has problem statement
  checks.push({
    name: "has_problem_statement",
    passed: commercialProduct.hasProblemStatement,
    score: commercialProduct.hasProblemStatement ? 1 : 0,
    detail: commercialProduct.hasProblemStatement
      ? "Problem statement is defined"
      : "Problem statement is not defined",
    evidence: "VERIFIED",
  });
  if (!commercialProduct.hasProblemStatement) {
    issues.push({
      id: generateIssueId(),
      severity: "MINOR",
      category: "commercial",
      description: "Product has no problem statement",
      repairable: true,
      repairAction: "define_problem_statement",
    });
  }

  // Check 5: Has differentiation
  checks.push({
    name: "has_differentiation",
    passed: commercialProduct.hasDifferentiation,
    score: commercialProduct.hasDifferentiation ? 1 : 0,
    detail: commercialProduct.hasDifferentiation
      ? "Differentiation is stated"
      : "Differentiation is not stated",
    evidence: "VERIFIED",
  });
  if (!commercialProduct.hasDifferentiation) {
    issues.push({
      id: generateIssueId(),
      severity: "MINOR",
      category: "commercial",
      description: "Product has no differentiation from alternatives",
      repairable: true,
      repairAction: "define_differentiation",
    });
  }

  // Check 6: No integrity issues (fake testimonials)
  const unverifiedTestimonials = commercialProduct.testimonials.filter(
    (t) => !t.verified
  );
  const noFakeTestimonials = unverifiedTestimonials.length === 0;
  checks.push({
    name: "no_fake_testimonials",
    passed: noFakeTestimonials,
    score: noFakeTestimonials
      ? 1
      : Math.max(
          0,
          1 -
            unverifiedTestimonials.length /
              Math.max(1, commercialProduct.testimonials.length) *
              0.5
        ),
    detail: noFakeTestimonials
      ? "All testimonials are verified"
      : `${unverifiedTestimonials.length}/${commercialProduct.testimonials.length} testimonials are unverified`,
    evidence: "VERIFIED",
  });
  if (!noFakeTestimonials) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: `${unverifiedTestimonials.length} unverified testimonial(s) found — potential integrity issue`,
      repairable: true,
      repairAction: "verify_or_remove_testimonials",
    });
  }

  // Check 7: No guaranteed results in claims
  const guaranteedClaims = commercialProduct.claims.filter((c) =>
    /\b(guarantee|guaranteed|100%|always|never fail|certain)\b/i.test(c)
  );
  const noGuaranteedClaims = guaranteedClaims.length === 0;
  checks.push({
    name: "no_guaranteed_claims",
    passed: noGuaranteedClaims,
    score: noGuaranteedClaims ? 1 : 0.5,
    detail: noGuaranteedClaims
      ? "No guaranteed-result claims found"
      : `${guaranteedClaims.length} guaranteed-result claim(s) found`,
    evidence: "VERIFIED",
  });
  if (!noGuaranteedClaims) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "commercial",
      description: "Product contains guaranteed-result claims — potential integrity issue",
      repairable: true,
      repairAction: "remove_guaranteed_claims",
    });
  }

  // Calculate score
  const score =
    checks.length > 0
      ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
      : 0;

  const passed =
    issues.filter((i) => i.severity === "CRITICAL").length === 0 &&
    score >= 0.5;

  return {
    category: "commercial",
    passed,
    score: Math.round(score * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Category 6: Delivery QA ──────────────────────────────────────────────────

/**
 * Delivery QA — Can customer receive/use the product?
 *
 * Checks:
 * - Delivery format specified
 * - Access method defined
 * - Usage guide exists
 * - Prerequisites documented
 */
export function runDeliveryQA(
  packaging: Packaging | undefined
): QACategoryResult {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];

  if (!packaging) {
    checks.push({
      name: "delivery_available",
      passed: false,
      score: 0,
      detail: "No packaging/delivery information provided",
      evidence: "NOT_VERIFIED",
    });
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "delivery",
      description: "Product has no delivery/packaging information",
      repairable: true,
      repairAction: "define_packaging",
    });
    return {
      category: "delivery",
      passed: false,
      score: 0,
      checks,
      issues,
    };
  }

  // Check 1: Delivery format specified
  const hasFormat = !!packaging.deliveryFormat;
  checks.push({
    name: "delivery_format",
    passed: hasFormat,
    score: hasFormat ? 1 : 0,
    detail: hasFormat
      ? `Delivery format: ${packaging.deliveryFormat}`
      : "Delivery format not specified",
    evidence: "VERIFIED",
  });
  if (!hasFormat) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "delivery",
      description: "Delivery format not specified",
      repairable: true,
      repairAction: "specify_delivery_format",
    });
  }

  // Check 2: Access method defined
  const hasAccess = !!packaging.accessMethod;
  checks.push({
    name: "access_method",
    passed: hasAccess,
    score: hasAccess ? 1 : 0,
    detail: hasAccess
      ? `Access method: ${packaging.accessMethod}`
      : "Access method not defined",
    evidence: "VERIFIED",
  });
  if (!hasAccess) {
    issues.push({
      id: generateIssueId(),
      severity: "MAJOR",
      category: "delivery",
      description: "Access method not defined",
      repairable: true,
      repairAction: "define_access_method",
    });
  }

  // Check 3: Usage guide exists
  const hasGuide = !!packaging.usageGuide;
  checks.push({
    name: "usage_guide",
    passed: hasGuide,
    score: hasGuide ? 1 : 0,
    detail: hasGuide
      ? "Usage guide exists"
      : "Usage guide not provided",
    evidence: "VERIFIED",
  });
  if (!hasGuide) {
    issues.push({
      id: generateIssueId(),
      severity: "MINOR",
      category: "delivery",
      description: "No usage guide provided",
      repairable: true,
      repairAction: "create_usage_guide",
    });
  }

  // Check 4: Prerequisites documented
  const hasPrereqs = packaging.prerequisites.length > 0;
  checks.push({
    name: "prerequisites",
    passed: hasPrereqs,
    score: hasPrereqs ? 1 : 0.5, // No prerequisites is OK (score 0.5, not 0)
    detail: hasPrereqs
      ? `Prerequisites documented: ${packaging.prerequisites.join(", ")}`
      : "No prerequisites documented (may not be needed)",
    evidence: "VERIFIED",
  });

  // Check 5: Support info exists
  const hasSupport = !!packaging.supportInfo;
  checks.push({
    name: "support_info",
    passed: hasSupport,
    score: hasSupport ? 1 : 0.5,
    detail: hasSupport
      ? "Support information provided"
      : "No support information provided",
    evidence: "VERIFIED",
  });
  if (!hasSupport) {
    issues.push({
      id: generateIssueId(),
      severity: "INFO",
      category: "delivery",
      description: "No support information provided",
      repairable: true,
      repairAction: "add_support_info",
    });
  }

  // Calculate score
  const score =
    checks.length > 0
      ? checks.reduce((sum, c) => sum + c.score, 0) / checks.length
      : 0;

  const passed =
    issues.filter((i) => i.severity === "CRITICAL").length === 0 &&
    score >= 0.5;

  return {
    category: "delivery",
    passed,
    score: Math.round(score * 1000) / 1000,
    checks,
    issues,
  };
}

// ─── Repair ───────────────────────────────────────────────────────────────────

/**
 * Attempt to repair a QA issue.
 *
 * Supported repairs:
 * - regenerate_artifact: Cannot auto-regenerate in QA — NOT_VERIFIED
 * - add_content_for_section: Cannot auto-generate content — NOT_VERIFIED
 * - replace_placeholders: Cannot auto-replace — NOT_VERIFIED
 * - All visual-qa repair actions: delegates to visual-qa module
 *
 * Returns RepairResult with honest evidence.
 */
export async function repairProductIssue(
  issue: QAIssue,
  productId: string,
  artifacts: ArtifactRef[]
): Promise<RepairResult> {
  // Delegate to visual-qa for PDF repairs
  if (
    issue.repairAction === "remove_empty_pages" ||
    issue.repairAction === "update_metadata" ||
    issue.repairAction === "add_cover_page" ||
    issue.repairAction === "regenerate_pdf"
  ) {
    const pdfArtifact = artifacts.find((a) => a.type === "pdf");
    if (pdfArtifact) {
      const visualIssue = {
        severity: issue.severity as "CRITICAL" | "MAJOR" | "MINOR" | "INFO",
        category: issue.category,
        description: issue.description,
        repairable: issue.repairable,
        repairAction: issue.repairAction || undefined,
      };
      return await repairIssue(visualIssue, pdfArtifact.path);
    }
  }

  // Content repairs — cannot be automated in QA
  if (
    issue.repairAction?.startsWith("add_content_for_section:") ||
    issue.repairAction?.startsWith("expand_content_for_section:") ||
    issue.repairAction === "replace_placeholders" ||
    issue.repairAction === "expand_short_sections"
  ) {
    return {
      repaired: false,
      action: issue.repairAction,
      evidence: "NOT_VERIFIED",
      detail: `Content repair "${issue.repairAction}" requires manual content creation. Cannot be auto-repaired in QA.`,
    };
  }

  // Structure repairs
  if (
    issue.repairAction === "add_missing_sections" ||
    issue.repairAction === "reorder_sections" ||
    issue.repairAction === "adjust_content_length"
  ) {
    return {
      repaired: false,
      action: issue.repairAction,
      evidence: "NOT_VERIFIED",
      detail: `Structure repair "${issue.repairAction}" requires content pipeline. Cannot be auto-repaired in QA.`,
    };
  }

  // Commercial/delivery repairs — require human decisions
  if (
    issue.repairAction?.startsWith("define_") ||
    issue.repairAction?.startsWith("add_") ||
    issue.repairAction?.startsWith("specify_") ||
    issue.repairAction === "verify_or_remove_testimonials" ||
    issue.repairAction === "remove_guaranteed_claims" ||
    issue.repairAction === "create_usage_guide"
  ) {
    return {
      repaired: false,
      action: issue.repairAction,
      evidence: "NOT_VERIFIED",
      detail: `Repair "${issue.repairAction}" requires human decision. Cannot be auto-repaired in QA.`,
    };
  }

  // Artifact regeneration
  if (issue.repairAction === "regenerate_artifact") {
    return {
      repaired: false,
      action: "regenerate_artifact",
      evidence: "NOT_VERIFIED",
      detail:
        "Cannot regenerate artifact in QA. Regeneration requires the production pipeline.",
    };
  }

  // Unknown repair
  return {
    repaired: false,
    action: issue.repairAction || "none",
    evidence: "NOT_VERIFIED",
    detail: `Unknown repair action: ${issue.repairAction}`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateIssueId(): string {
  return `qi_${randomUUID().replace(/-/g, "").substring(0, 12)}`;
}

/**
 * Validate that a file matches its expected format.
 * For PDFs, tries to load with pdf-lib.
 */
async function validateFormat(
  filePath: string,
  expectedType: string
): Promise<{ valid: boolean; detail: string; evidence: EvidenceTag }> {
  try {
    if (expectedType === "pdf") {
      const bytes = await fs.readFile(filePath);
      const header = bytes.subarray(0, 5).toString("ascii");
      if (header !== "%PDF-") {
        return {
          valid: false,
          detail: `File does not start with %PDF- header (got: ${header})`,
          evidence: "VERIFIED",
        };
      }
      // Try to load with pdf-lib for deeper validation
      try {
        await PDFDocument.load(bytes, { ignoreEncryption: true });
        return {
          valid: true,
          detail: "PDF is valid and parseable by pdf-lib",
          evidence: "VERIFIED",
        };
      } catch (err) {
        return {
          valid: false,
          detail: `PDF cannot be parsed: ${err instanceof Error ? err.message : String(err)}`,
          evidence: "VERIFIED",
        };
      }
    }

    // For other types, we just check the file is readable
    const stat = await fs.stat(filePath);
    return {
      valid: stat.size > 0,
      detail: stat.size > 0
        ? `File is ${stat.size} bytes (${expectedType})`
        : `File is empty (${expectedType})`,
      evidence: "VERIFIED",
    };
  } catch (err) {
    return {
      valid: false,
      detail: `Format validation failed: ${err instanceof Error ? err.message : String(err)}`,
      evidence: "NOT_VERIFIED",
    };
  }
}

/**
 * Validate that a file's MIME type matches its expected type.
 * Uses file extension and header bytes for detection.
 */
async function validateMimeType(
  filePath: string,
  expectedType: string
): Promise<{ valid: boolean; detail: string; evidence: EvidenceTag }> {
  const expectedMimes = EXPECTED_MIME_TYPES[expectedType];

  // "other" type — can't validate MIME
  if (!expectedMimes || expectedMimes.length === 0) {
    return {
      valid: true,
      detail: `Cannot validate MIME type for "${expectedType}" type — accepted by default`,
      evidence: "NOT_VERIFIED",
    };
  }

  try {
    // Read first bytes for magic number detection
    const bytes = await fs.readFile(filePath);
    const header = bytes.subarray(0, 8);

    // PDF: starts with %PDF-
    if (expectedType === "pdf") {
      const isPdf = header.subarray(0, 5).toString("ascii") === "%PDF-";
      return {
        valid: isPdf,
        detail: isPdf
          ? "File matches PDF magic number"
          : "File does not match PDF magic number",
        evidence: "VERIFIED",
      };
    }

    // EPUB: starts with PK (ZIP)
    if (expectedType === "epub") {
      const isZip = header[0] === 0x50 && header[1] === 0x4b; // PK
      return {
        valid: isZip,
        detail: isZip
          ? "File matches EPUB/ZIP magic number"
          : "File does not match EPUB/ZIP magic number",
        evidence: "VERIFIED",
      };
    }

    // HTML: starts with < or DOCTYPE
    if (expectedType === "html") {
      const text = header.toString("ascii").trimStart();
      const isHtml = text.startsWith("<") || text.startsWith("DOCTYPE");
      return {
        valid: isHtml,
        detail: isHtml
          ? "File appears to be HTML"
          : "File does not appear to be HTML",
        evidence: "VERIFIED",
      };
    }

    // Image: check common image magic numbers
    if (expectedType === "image") {
      // PNG: 89 50 4E 47
      const isPng =
        header[0] === 0x89 &&
        header[1] === 0x50 &&
        header[2] === 0x4e &&
        header[3] === 0x47;
      // JPEG: FF D8
      const isJpeg = header[0] === 0xff && header[1] === 0xd8;
      // GIF: GIF8
      const isGif =
        header[0] === 0x47 &&
        header[1] === 0x49 &&
        header[2] === 0x46;

      const isImage = isPng || isJpeg || isGif;
      return {
        valid: isImage,
        detail: isImage
          ? "File matches image magic number"
          : "File does not match common image magic numbers",
        evidence: "VERIFIED",
      };
    }

    // Text: hard to validate, assume OK
    return {
      valid: true,
      detail: `Text file MIME type assumed valid`,
      evidence: "INFERRED",
    };
  } catch (err) {
    return {
      valid: false,
      detail: `MIME type validation failed: ${err instanceof Error ? err.message : String(err)}`,
      evidence: "NOT_VERIFIED",
    };
  }
}
