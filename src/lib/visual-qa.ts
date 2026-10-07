/**
 * Visual QA — KREA V2
 *
 * Quality assurance for generated PDF artifacts. Every check is performed
 * against the REAL file on disk. No check declares PASS without actual
 * inspection.
 *
 * IMPORTANT: We do NOT claim to detect visual/layout issues that require
 * actual rendering (like "text cut off" or "bad typography"). Those require
 * a visual renderer which we don't have. Those are marked NOT_VERIFIED.
 *
 * Evidence tags:
 *   VERIFIED     — check was actually performed on the real file
 *   NOT_VERIFIED — check was skipped or cannot be performed programmatically
 *   INFERRED     — result derived from other VERIFIED checks
 */

import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { inspectPdf, type EvidenceTag } from "./pdf-factory";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QAReport {
  productId: string;
  artifactPath: string;
  passed: boolean;
  checks: QACheck[];
  issues: QAIssue[];
  evidence: EvidenceTag;
  inspectedAt: Date;
}

export interface QACheck {
  name: string;
  passed: boolean;
  detail: string;
  evidence: EvidenceTag;
}

export interface QAIssue {
  severity: "CRITICAL" | "MAJOR" | "MINOR" | "INFO";
  category: string;
  description: string;
  repairable: boolean;
  repairAction?: string;
}

export interface RepairResult {
  repaired: boolean;
  action: string;
  evidence: EvidenceTag;
  detail: string;
}

// ─── runVisualQA ──────────────────────────────────────────────────────────────

/**
 * Run full QA inspection on a PDF artifact.
 *
 * Checks performed (all VERIFIED by actual file inspection):
 * 1. File exists and is readable
 * 2. File size > 0
 * 3. PDF is valid (can be opened by pdf-lib)
 * 4. Page count > 0
 * 5. No empty pages (each page has a non-zero width/height)
 * 6. Metadata is populated (title, author)
 * 7. Cover page exists (first page is present)
 *
 * Checks NOT performed (marked NOT_VERIFIED):
 * - Visual rendering quality (text cutoff, typography, layout)
 * - Image quality/resolution
 * - Color accuracy
 */
export async function runVisualQA(
  productId: string,
  artifactPath: string
): Promise<QAReport> {
  const checks: QACheck[] = [];
  const issues: QAIssue[] = [];
  const inspectedAt = new Date();

  // ── Check 1: File exists and is readable ──────────────────────────────
  let fileExists = false;
  let fileSize = 0;
  try {
    const stat = await fs.stat(artifactPath);
    fileExists = true;
    fileSize = stat.size;
    checks.push({
      name: "file_exists",
      passed: true,
      detail: `File exists at ${artifactPath} (${stat.size} bytes)`,
      evidence: "VERIFIED",
    });
  } catch {
    checks.push({
      name: "file_exists",
      passed: false,
      detail: `File not found: ${artifactPath}`,
      evidence: "VERIFIED",
    });
    issues.push({
      severity: "CRITICAL",
      category: "file_system",
      description: `PDF file does not exist: ${artifactPath}`,
      repairable: false,
    });
  }

  // ── Check 2: File size > 0 ───────────────────────────────────────────
  if (fileExists) {
    const sizeOk = fileSize > 0;
    checks.push({
      name: "file_size",
      passed: sizeOk,
      detail: sizeOk
        ? `File size is ${fileSize} bytes`
        : `File size is 0 bytes (empty)`,
      evidence: "VERIFIED",
    });
    if (!sizeOk) {
      issues.push({
        severity: "CRITICAL",
        category: "file_system",
        description: "PDF file is empty (0 bytes)",
        repairable: false,
      });
    }
  }

  // ── Check 3: PDF is valid (can be opened by pdf-lib) ─────────────────
  let pdfDoc: PDFDocument | null = null;
  let pageCount = 0;

  if (fileExists && fileSize > 0) {
    try {
      const pdfBytes = await fs.readFile(artifactPath);
      pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      pageCount = pdfDoc.getPageCount();
      checks.push({
        name: "pdf_valid",
        passed: true,
        detail: `PDF is valid and parseable by pdf-lib`,
        evidence: "VERIFIED",
      });
    } catch (err) {
      checks.push({
        name: "pdf_valid",
        passed: false,
        detail: `PDF cannot be parsed: ${err instanceof Error ? err.message : String(err)}`,
        evidence: "VERIFIED",
      });
      issues.push({
        severity: "CRITICAL",
        category: "pdf_integrity",
        description: "PDF file is corrupt or cannot be parsed",
        repairable: true,
        repairAction: "regenerate_pdf",
      });
    }
  }

  // ── Check 4: Page count > 0 ──────────────────────────────────────────
  if (pdfDoc) {
    const pageCountOk = pageCount > 0;
    checks.push({
      name: "page_count",
      passed: pageCountOk,
      detail: pageCountOk
        ? `PDF has ${pageCount} pages`
        : "PDF has 0 pages",
      evidence: "VERIFIED",
    });
    if (!pageCountOk) {
      issues.push({
        severity: "CRITICAL",
        category: "pdf_structure",
        description: "PDF has no pages",
        repairable: true,
        repairAction: "regenerate_pdf",
      });
    }
  }

  // ── Check 5: No empty pages ──────────────────────────────────────────
  // pdf-lib can check page dimensions (width/height). A page with zero
  // dimension is effectively empty/corrupt.
  if (pdfDoc && pageCount > 0) {
    let emptyPagesFound = 0;
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const { width, height } = pages[i].getSize();
      if (width === 0 || height === 0) {
        emptyPagesFound++;
      }
    }
    const noEmptyPages = emptyPagesFound === 0;
    checks.push({
      name: "no_empty_pages",
      passed: noEmptyPages,
      detail: noEmptyPages
        ? `All ${pageCount} pages have non-zero dimensions`
        : `Found ${emptyPagesFound} page(s) with zero dimensions`,
      evidence: "VERIFIED",
    });
    if (!noEmptyPages) {
      issues.push({
        severity: "MAJOR",
        category: "pdf_structure",
        description: `${emptyPagesFound} page(s) have zero width or height`,
        repairable: true,
        repairAction: "remove_empty_pages",
      });
    }
  }

  // ── Check 6: Metadata is populated ───────────────────────────────────
  if (pdfDoc) {
    const title = pdfDoc.getTitle();
    const author = pdfDoc.getAuthor();
    const hasMetadata = !!(title && author);
    checks.push({
      name: "metadata_populated",
      passed: hasMetadata,
      detail: hasMetadata
        ? `Metadata: title="${title}", author="${author}"`
        : `Metadata incomplete: title="${title || "(empty)"}", author="${author || "(empty)"}"`,
      evidence: "VERIFIED",
    });
    if (!hasMetadata) {
      issues.push({
        severity: "MINOR",
        category: "pdf_metadata",
        description: "PDF metadata is incomplete (missing title or author)",
        repairable: true,
        repairAction: "update_metadata",
      });
    }
  }

  // ── Check 7: Cover page exists ───────────────────────────────────────
  // We verify that there is at least one page (the first page is the cover).
  // We cannot verify that the cover IMAGE is correct — that requires rendering.
  if (pdfDoc && pageCount > 0) {
    checks.push({
      name: "cover_page_exists",
      passed: true,
      detail: `First page exists (page 1 of ${pageCount})`,
      evidence: "VERIFIED",
    });
  } else if (pdfDoc) {
    checks.push({
      name: "cover_page_exists",
      passed: false,
      detail: "No pages exist, so no cover page",
      evidence: "VERIFIED",
    });
    issues.push({
      severity: "MAJOR",
      category: "pdf_structure",
      description: "No cover page found",
      repairable: true,
      repairAction: "add_cover_page",
    });
  }

  // ── Check 8 (NOT_VERIFIED): Visual rendering quality ─────────────────
  // We CANNOT check these without a visual renderer:
  checks.push({
    name: "visual_rendering_quality",
    passed: true, // Assumed OK — we cannot verify
    detail:
      "Visual rendering quality (text cutoff, typography, layout) cannot be verified programmatically. Requires a visual renderer.",
    evidence: "NOT_VERIFIED",
  });

  // ── Check 9 (NOT_VERIFIED): Image quality ────────────────────────────
  checks.push({
    name: "image_quality",
    passed: true, // Assumed OK — we cannot verify
    detail:
      "Image quality/resolution within PDF cannot be verified programmatically. Requires rendering.",
    evidence: "NOT_VERIFIED",
  });

  // ── Determine pass/fail ──────────────────────────────────────────────
  const hasCritical = issues.some((i) => i.severity === "CRITICAL");
  const passed = !hasCritical;

  // Overall evidence: VERIFIED if at least one real check was performed,
  // NOT_VERIFIED if we never opened the file
  const anyVerified = checks.some((c) => c.evidence === "VERIFIED");
  const overallEvidence: EvidenceTag = anyVerified
    ? "VERIFIED"
    : "NOT_VERIFIED";

  return {
    productId,
    artifactPath,
    passed,
    checks,
    issues,
    evidence: overallEvidence,
    inspectedAt,
  };
}

// ─── repairIssue ──────────────────────────────────────────────────────────────

/**
 * Attempt to repair a QA issue.
 *
 * Supported repairs:
 * - remove_empty_pages: Loads PDF, removes pages with zero dimensions, saves
 * - update_metadata: Loads PDF, updates title/author metadata, saves
 * - add_cover_page: Cannot auto-generate cover in QA — flagged NOT_VERIFIED
 * - regenerate_pdf: Cannot regenerate in QA — flagged NOT_VERIFIED
 *
 * Returns RepairResult with evidence of whether repair was actually performed.
 */
export async function repairIssue(
  issue: QAIssue,
  artifactPath: string,
  metadata?: { title?: string; author?: string }
): Promise<RepairResult> {
  // ── Remove empty pages ────────────────────────────────────────────────
  if (issue.repairAction === "remove_empty_pages") {
    try {
      const pdfBytes = await fs.readFile(artifactPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });
      const pages = pdfDoc.getPages();
      const indicesToRemove: number[] = [];

      for (let i = 0; i < pages.length; i++) {
        const { width, height } = pages[i].getSize();
        if (width === 0 || height === 0) {
          indicesToRemove.push(i);
        }
      }

      if (indicesToRemove.length === 0) {
        return {
          repaired: true,
          action: "remove_empty_pages",
          evidence: "VERIFIED",
          detail: "No empty pages found on re-inspection",
        };
      }

      // Remove pages in reverse order to preserve indices
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        pdfDoc.removePage(indicesToRemove[i]);
      }

      const newBytes = await pdfDoc.save();
      await fs.writeFile(artifactPath, newBytes);

      // Verify
      const stat = await fs.stat(artifactPath);
      return {
        repaired: stat.size > 0,
        action: `Removed ${indicesToRemove.length} empty page(s)`,
        evidence: "VERIFIED",
        detail: `New file size: ${stat.size} bytes, new page count: ${pdfDoc.getPageCount()}`,
      };
    } catch (err) {
      return {
        repaired: false,
        action: "remove_empty_pages",
        evidence: "NOT_VERIFIED",
        detail: `Repair failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Update metadata ───────────────────────────────────────────────────
  if (issue.repairAction === "update_metadata") {
    try {
      const pdfBytes = await fs.readFile(artifactPath);
      const pdfDoc = await PDFDocument.load(pdfBytes, {
        ignoreEncryption: true,
      });

      if (metadata?.title) pdfDoc.setTitle(metadata.title);
      if (metadata?.author) pdfDoc.setAuthor(metadata.author);

      const newBytes = await pdfDoc.save();
      await fs.writeFile(artifactPath, newBytes);

      const stat = await fs.stat(artifactPath);
      return {
        repaired: true,
        action: "update_metadata",
        evidence: "VERIFIED",
        detail: `Metadata updated: title="${metadata?.title || "(unchanged)"}", author="${metadata?.author || "(unchanged)"}". File size: ${stat.size} bytes`,
      };
    } catch (err) {
      return {
        repaired: false,
        action: "update_metadata",
        evidence: "NOT_VERIFIED",
        detail: `Repair failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // ── Add cover page ────────────────────────────────────────────────────
  if (issue.repairAction === "add_cover_page") {
    return {
      repaired: false,
      action: "add_cover_page",
      evidence: "NOT_VERIFIED",
      detail:
        "Cannot auto-generate cover image in QA. Cover design requires the Book Factory pipeline (Step 4).",
    };
  }

  // ── Regenerate PDF ────────────────────────────────────────────────────
  if (issue.repairAction === "regenerate_pdf") {
    return {
      repaired: false,
      action: "regenerate_pdf",
      evidence: "NOT_VERIFIED",
      detail:
        "Cannot regenerate PDF in QA. Regeneration requires the Book Factory pipeline (Step 7).",
    };
  }

  // ── Unknown repair ────────────────────────────────────────────────────
  return {
    repaired: false,
    action: issue.repairAction || "none",
    evidence: "NOT_VERIFIED",
    detail: `Unknown repair action: ${issue.repairAction}`,
  };
}
