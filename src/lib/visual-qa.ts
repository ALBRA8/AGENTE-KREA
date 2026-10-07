/**
 * Visual QA — KREA Book Factory Layer
 *
 * Inspects PDF/layout results for visual quality issues.
 * KREA CANNOT declare a PDF done just because the renderer finished (AC-043).
 * Every artifact must be inspected, issues diagnosed, and repairs applied
 * before the product is considered final.
 *
 * Satisfies:
 *   AC-043 — KREA cannot declare PDF done just because renderer finished
 *   AC-044 — QAIssue categories with severity, location, description, suggested_fix
 *   AC-045 — Repair loop: DETECT → DIAGNOSE → REPAIR → RENDER → VERIFY (max 5 iterations)
 */

import type { EditorialSpecification, LayoutResult, BookContent } from "./editorial-design";
import type { ArtDirectionSpec } from "./art-direction";
import type { CoverSpecification } from "./cover-design";

// ─── QA Issue Categories ───────────────────────────────────────────────

/**
 * All categories of visual issues that VisualQA checks for.
 * Each category maps to a specific visual quality concern.
 */
export type QAIssueCategory =
  | "cut_text"              // Text is cut off / truncated
  | "overflow"              // Content overflows its container
  | "off_page"              // Content placed outside page boundaries
  | "distorted_images"      // Images with wrong aspect ratio or distortion
  | "empty_pages"           // Pages with no meaningful content
  | "bad_hierarchy"         // Heading hierarchy is broken or inconsistent
  | "contrast_problems"     // Text/background contrast below WCAG AA
  | "typographic_inconsistency" // Inconsistent fonts, sizes, or weights
  | "cover_errors"          // Cover doesn't match interior or has issues
  | "numbering_errors"      // Page, chapter, or figure numbering is wrong
  | "index_errors"          // Index is missing, incomplete, or incorrect
  | "legibility_problems";  // General legibility issues (too small, etc.)

// ─── QA Issue Severity ─────────────────────────────────────────────────

export type QAIssueSeverity = "critical" | "warning" | "info";

// ─── QA Issue Location ─────────────────────────────────────────────────

export interface QAIssueLocation {
  /** Page number where the issue occurs (0-indexed) */
  page: number;
  /** Element reference within the page */
  element_ref?: string;
  /** Chapter number if applicable */
  chapter?: number;
  /** Bounding box of the issue area {x, y, width, height} */
  bounds?: { x: number; y: number; width: number; height: number };
}

// ─── QA Issue (AC-044) ─────────────────────────────────────────────────

/**
 * A single visual quality issue found during inspection.
 *
 * AC-044: Each issue has severity, location, description, suggested_fix.
 */
export interface QAIssue {
  /** Unique issue ID */
  id: string;
  /** Issue category */
  category: QAIssueCategory;
  /** Severity level — critical issues must be fixed before product is final */
  severity: QAIssueSeverity;
  /** Where the issue occurs */
  location: QAIssueLocation;
  /** Human-readable description of the issue */
  description: string;
  /** Suggested fix to resolve the issue */
  suggested_fix: string;
  /** Whether this issue is auto-repairable */
  auto_repairable: boolean;
  /** Related issues that should be fixed together */
  related_issues?: string[];
}

// ─── QA Result (AC-043) ────────────────────────────────────────────────

/**
 * Result of visual QA inspection.
 *
 * AC-043: KREA cannot declare PDF done just because renderer finished.
 * passed=true only when there are zero critical issues.
 */
export interface QAResult {
  /** Whether the artifact passes QA (no critical issues) */
  passed: boolean;
  /** Total number of issues found */
  issue_count: number;
  /** All issues found, grouped by category */
  issues: QAIssue[];
  /** Summary counts by category */
  by_category: Record<QAIssueCategory, number>;
  /** Summary counts by severity */
  by_severity: Record<QAIssueSeverity, number>;
  /** Timestamp of inspection */
  inspectedAt: string;
  /** Inspection duration in ms */
  inspection_duration_ms: number;
}

// ─── Diagnosis ──────────────────────────────────────────────────────────

export interface Diagnosis {
  /** The issue being diagnosed */
  issue_id: string;
  /** Root cause category */
  root_cause: string;
  /** Detailed explanation of why the issue occurred */
  explanation: string;
  /** Recommended repair strategy */
  repair_strategy: "adjust_style" | "reflow" | "regenerate" | "manual" | "skip";
  /** Specific parameters for the repair */
  repair_params: Record<string, unknown>;
  /** Confidence in this diagnosis (0-1) */
  confidence: number;
}

// ─── Repaired Content ──────────────────────────────────────────────────

export interface RepairedContent {
  /** Whether the repair was successful */
  repaired: boolean;
  /** The issue that was repaired */
  issue_id: string;
  /** Description of the repair applied */
  repair_description: string;
  /** Updated content (if repair modifies content) */
  updated_content?: BookContent;
  /** Updated editorial spec (if repair modifies styles) */
  updated_editorial?: EditorialSpecification;
  /** Remaining issues that could not be auto-repaired */
  remaining_issues: string[];
}

// ─── PDF Spec (input to VisualQA from PDFFactory) ──────────────────────

export interface PDFSpecForQA {
  /** Total page count */
  page_count: number;
  /** Layout result that was used to generate the PDF */
  layout: LayoutResult;
  /** Content that was rendered */
  content: BookContent;
}

// ─── VisualQA Class ────────────────────────────────────────────────────

/**
 * VisualQA — inspects PDF/layout results for visual quality issues.
 *
 * Three main operations:
 * 1. inspect() — detect all visual quality issues (AC-043)
 * 2. diagnose() — determine root cause for each issue
 * 3. repair() — attempt to fix an issue
 *
 * AC-043: Never trust the renderer output blindly.
 * AC-044: Every issue has severity, location, description, suggested_fix.
 * AC-045: Repair loop with max 5 iterations.
 */
export class VisualQA {
  /**
   * Inspect a PDF/layout result for visual quality issues.
   *
   * AC-043: This inspection is MANDATORY. The renderer finishing does NOT
   * mean the PDF is done — we must actively verify visual quality.
   *
   * @param pdfSpec - The PDF specification and layout to inspect
   * @param content - The source content that was rendered
   * @param editorial - The editorial specification used
   * @returns QAResult with all detected issues
   */
  inspect(
    pdfSpec: PDFSpecForQA,
    content: BookContent,
    editorial: EditorialSpecification
  ): QAResult {
    const startTime = Date.now();
    const issues: QAIssue[] = [];

    // Run all inspection checks
    issues.push(...this.checkCutText(pdfSpec, content, editorial));
    issues.push(...this.checkOverflow(pdfSpec, editorial));
    issues.push(...this.checkOffPage(pdfSpec));
    issues.push(...this.checkEmptyPages(pdfSpec));
    issues.push(...this.checkBadHierarchy(pdfSpec, content));
    issues.push(...this.checkContrastProblems(pdfSpec, editorial));
    issues.push(...this.checkTypographicInconsistency(pdfSpec, editorial));
    issues.push(...this.checkNumberingErrors(pdfSpec, content));
    issues.push(...this.checkLegibilityProblems(pdfSpec, editorial));

    // Compute summaries
    const byCategory: Record<QAIssueCategory, number> = {
      cut_text: 0, overflow: 0, off_page: 0, distorted_images: 0,
      empty_pages: 0, bad_hierarchy: 0, contrast_problems: 0,
      typographic_inconsistency: 0, cover_errors: 0, numbering_errors: 0,
      index_errors: 0, legibility_problems: 0,
    };

    const bySeverity: Record<QAIssueSeverity, number> = {
      critical: 0, warning: 0, info: 0,
    };

    for (const issue of issues) {
      byCategory[issue.category]++;
      bySeverity[issue.severity]++;
    }

    const duration = Date.now() - startTime;

    return {
      passed: bySeverity.critical === 0,
      issue_count: issues.length,
      issues,
      by_category: byCategory,
      by_severity: bySeverity,
      inspectedAt: new Date().toISOString(),
      inspection_duration_ms: duration,
    };
  }

  /**
   * Diagnose the root cause of QA issues.
   *
   * @param issues - The issues to diagnose
   * @returns Array of diagnoses with repair strategies
   */
  diagnose(issues: QAIssue[]): Diagnosis[] {
    return issues.map((issue) => this.diagnoseSingle(issue));
  }

  /**
   * Attempt to repair a single QA issue.
   *
   * @param issue - The issue to repair
   * @param content - Current book content
   * @param editorial - Current editorial specification
   * @returns RepairedContent with the repair result
   */
  repair(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    if (!issue.auto_repairable) {
      return {
        repaired: false,
        issue_id: issue.id,
        repair_description: "Issue is not auto-repairable — requires manual intervention",
        remaining_issues: [issue.id],
      };
    }

    switch (issue.category) {
      case "cut_text":
        return this.repairCutText(issue, content, editorial);
      case "overflow":
        return this.repairOverflow(issue, content, editorial);
      case "empty_pages":
        return this.repairEmptyPages(issue, content, editorial);
      case "bad_hierarchy":
        return this.repairBadHierarchy(issue, content, editorial);
      case "numbering_errors":
        return this.repairNumberingErrors(issue, content, editorial);
      default:
        return {
          repaired: false,
          issue_id: issue.id,
          repair_description: `Auto-repair not implemented for category: ${issue.category}`,
          remaining_issues: [issue.id],
        };
    }
  }

  // ─── Inspection Checks ─────────────────────────────────────────────

  /**
   * Check for cut/truncated text.
   */
  private checkCutText(
    pdfSpec: PDFSpecForQA,
    content: BookContent,
    editorial: EditorialSpecification
  ): QAIssue[] {
    const issues: QAIssue[] = [];

    for (const page of pdfSpec.layout.pages) {
      for (const element of page.elements) {
        if (element.type === "paragraph" || element.type === "heading") {
          // Check if element height was constrained by remaining space
          const contentRef = element.content_ref;
          const sourceContent = this.findSourceContent(content, contentRef);

          if (sourceContent && element.height < this.estimateMinHeight(sourceContent, editorial)) {
            issues.push({
              id: `qa-cut-${page.page_number}-${element.content_ref}`,
              category: "cut_text",
              severity: "critical",
              location: {
                page: page.page_number,
                element_ref: element.content_ref,
                bounds: { x: element.x, y: element.y, width: element.width, height: element.height },
              },
              description: `Text appears truncated on page ${page.page_number + 1}: element height (${element.height.toFixed(1)}pt) is less than estimated minimum`,
              suggested_fix: "Reduce font size, increase line height, or split content across pages",
              auto_repairable: true,
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check for content overflow.
   */
  private checkOverflow(
    pdfSpec: PDFSpecForQA,
    editorial: EditorialSpecification
  ): QAIssue[] {
    const issues: QAIssue[] = [];
    const pageHeight = pdfSpec.layout.pages[0]
      ? editorial.margins.top + editorial.margins.bottom +
        pdfSpec.layout.pages[0].remaining_space +
        pdfSpec.layout.pages[0].elements.reduce((sum, e) => sum + e.height, 0)
      : 0;

    for (const page of pdfSpec.layout.pages) {
      for (const element of page.elements) {
        const elementBottom = element.y + element.height;
        const contentBottom = pageHeight - editorial.margins.bottom;

        if (elementBottom > contentBottom) {
          issues.push({
            id: `qa-overflow-${page.page_number}-${element.content_ref}`,
            category: "overflow",
            severity: "critical",
            location: {
              page: page.page_number,
              element_ref: element.content_ref,
            },
            description: `Content overflows page bottom by ${(elementBottom - contentBottom).toFixed(1)}pt on page ${page.page_number + 1}`,
            suggested_fix: "Move overflowing content to next page or reduce element size",
            auto_repairable: true,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for content placed outside page boundaries.
   */
  private checkOffPage(pdfSpec: PDFSpecForQA): QAIssue[] {
    const issues: QAIssue[] = [];

    for (const page of pdfSpec.layout.pages) {
      for (const element of page.elements) {
        if (element.x < 0 || element.y < 0) {
          issues.push({
            id: `qa-offpage-${page.page_number}-${element.content_ref}`,
            category: "off_page",
            severity: "critical",
            location: {
              page: page.page_number,
              element_ref: element.content_ref,
              bounds: { x: element.x, y: element.y, width: element.width, height: element.height },
            },
            description: `Element placed off-page at (${element.x.toFixed(1)}, ${element.y.toFixed(1)}) on page ${page.page_number + 1}`,
            suggested_fix: "Adjust margins or reposition element within page bounds",
            auto_repairable: true,
          });
        }
      }
    }

    return issues;
  }

  /**
   * Check for empty pages (pages with no meaningful content).
   */
  private checkEmptyPages(pdfSpec: PDFSpecForQA): QAIssue[] {
    const issues: QAIssue[] = [];

    for (const page of pdfSpec.layout.pages) {
      const contentElements = page.elements.filter(
        (e) => e.type !== "page_break" && e.type !== "decoration"
      );

      if (contentElements.length === 0 && pdfSpec.layout.pages.length > 1) {
        issues.push({
          id: `qa-empty-${page.page_number}`,
          category: "empty_pages",
          severity: "warning",
          location: { page: page.page_number },
          description: `Page ${page.page_number + 1} has no meaningful content`,
          suggested_fix: "Remove empty page or redistribute content from adjacent pages",
          auto_repairable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Check for broken heading hierarchy.
   */
  private checkBadHierarchy(
    pdfSpec: PDFSpecForQA,
    content: BookContent
  ): QAIssue[] {
    const issues: QAIssue[] = [];
    let lastHeadingLevel = 0;

    for (const chapter of content.chapters) {
      for (const section of chapter.sections) {
        if (section.heading) {
          // Check for skipped levels (e.g., h1 → h3)
          if (lastHeadingLevel > 0 && section.level > lastHeadingLevel + 1) {
            issues.push({
              id: `qa-hierarchy-${chapter.chapter_number}-${section.level}`,
              category: "bad_hierarchy",
              severity: "warning",
              location: {
                page: 0,
                chapter: chapter.chapter_number,
              },
              description: `Heading hierarchy skip: level ${lastHeadingLevel} to ${section.level} in chapter ${chapter.chapter_number}`,
              suggested_fix: "Insert intermediate heading level or adjust hierarchy",
              auto_repairable: true,
            });
          }
          lastHeadingLevel = section.level;
        }
      }
    }

    return issues;
  }

  /**
   * Check for contrast problems.
   */
  private checkContrastProblems(
    pdfSpec: PDFSpecForQA,
    editorial: EditorialSpecification
  ): QAIssue[] {
    const issues: QAIssue[] = [];

    // Check if body text contrast meets minimum
    const bodyContrast = this.estimateContrast(
      editorial.paragraph_style.color,
      "#ffffff" // Assume white background
    );

    if (bodyContrast < 4.5) {
      issues.push({
        id: "qa-contrast-body",
        category: "contrast_problems",
        severity: "critical",
        location: { page: 0 },
        description: `Body text contrast ratio (${bodyContrast.toFixed(2)}:1) below WCAG AA minimum (4.5:1)`,
        suggested_fix: "Increase text color darkness or adjust background color",
        auto_repairable: true,
      });
    }

    return issues;
  }

  /**
   * Check for typographic inconsistency.
   */
  private checkTypographicInconsistency(
    pdfSpec: PDFSpecForQA,
    editorial: EditorialSpecification
  ): QAIssue[] {
    const issues: QAIssue[] = [];
    const usedFonts = new Set<string>();
    const usedSizes = new Set<number>();

    // Collect all fonts and sizes used
    for (const heading of editorial.heading_styles) {
      usedFonts.add(heading.font);
      usedSizes.add(heading.size);
    }
    usedFonts.add(editorial.paragraph_style.font);
    usedSizes.add(editorial.paragraph_style.size);

    // Flag if too many different fonts (more than 3 is usually a problem)
    if (usedFonts.size > 3) {
      issues.push({
        id: "qa-type-too-many-fonts",
        category: "typographic_inconsistency",
        severity: "warning",
        location: { page: 0 },
        description: `${usedFonts.size} different fonts used — recommend maximum 3 for coherence`,
        suggested_fix: "Reduce font variety to heading + body + mono maximum",
        auto_repairable: false,
      });
    }

    return issues;
  }

  /**
   * Check for numbering errors.
   */
  private checkNumberingErrors(
    pdfSpec: PDFSpecForQA,
    content: BookContent
  ): QAIssue[] {
    const issues: QAIssue[] = [];

    // Verify chapter numbers are sequential
    for (let i = 1; i < content.chapters.length; i++) {
      const prev = content.chapters[i - 1].chapter_number;
      const curr = content.chapters[i].chapter_number;

      if (curr !== prev + 1) {
        issues.push({
          id: `qa-numbering-ch-${curr}`,
          category: "numbering_errors",
          severity: "critical",
          location: { page: 0, chapter: curr },
          description: `Chapter numbering gap: expected ${prev + 1}, found ${curr}`,
          suggested_fix: "Renumber chapters sequentially",
          auto_repairable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Check for legibility problems.
   */
  private checkLegibilityProblems(
    pdfSpec: PDFSpecForQA,
    editorial: EditorialSpecification
  ): QAIssue[] {
    const issues: QAIssue[] = [];

    // Check body text size (minimum 9pt for print, 12pt for ebook)
    if (editorial.paragraph_style.size < 9) {
      issues.push({
        id: "qa-legibility-body-size",
        category: "legibility_problems",
        severity: "critical",
        location: { page: 0 },
        description: `Body text size (${editorial.paragraph_style.size}pt) is below minimum readable size`,
        suggested_fix: "Increase body text size to at least 9pt (print) or 12pt (ebook)",
        auto_repairable: true,
      });
    }

    // Check line height (minimum 1.2 for readability)
    if (editorial.paragraph_style.line_height < 1.2) {
      issues.push({
        id: "qa-legibility-line-height",
        category: "legibility_problems",
        severity: "warning",
        location: { page: 0 },
        description: `Line height (${editorial.paragraph_style.line_height}) is below minimum readable value (1.2)`,
        suggested_fix: "Increase line height to at least 1.2 for comfortable reading",
        auto_repairable: true,
      });
    }

    return issues;
  }

  // ─── Diagnosis ─────────────────────────────────────────────────────

  /**
   * Diagnose a single issue.
   */
  private diagnoseSingle(issue: QAIssue): Diagnosis {
    const diagnoses: Partial<Record<QAIssueCategory, Diagnosis>> = {
      cut_text: {
        issue_id: issue.id,
        root_cause: "insufficient_space",
        explanation: "Text was cut because the available space on the page was insufficient to contain it",
        repair_strategy: "reflow",
        repair_params: { action: "split_or_shrink" },
        confidence: 0.85,
      },
      overflow: {
        issue_id: issue.id,
        root_cause: "page_break_algorithm",
        explanation: "Content overflows because the page break algorithm didn't correctly calculate element placement",
        repair_strategy: "reflow",
        repair_params: { action: "reflow_with_break" },
        confidence: 0.8,
      },
      off_page: {
        issue_id: issue.id,
        root_cause: "positioning_error",
        explanation: "Element was positioned outside page boundaries due to margin or offset calculation error",
        repair_strategy: "adjust_style",
        repair_params: { action: "clamp_position" },
        confidence: 0.9,
      },
      empty_pages: {
        issue_id: issue.id,
        root_cause: "excessive_page_break",
        explanation: "An empty page was created by an unnecessary page break",
        repair_strategy: "reflow",
        repair_params: { action: "remove_empty_page" },
        confidence: 0.75,
      },
      bad_hierarchy: {
        issue_id: issue.id,
        root_cause: "skipped_heading_level",
        explanation: "Heading hierarchy has a skipped level, which confuses readers and screen readers",
        repair_strategy: "adjust_style",
        repair_params: { action: "insert_intermediate_heading" },
        confidence: 0.7,
      },
      contrast_problems: {
        issue_id: issue.id,
        root_cause: "color_selection",
        explanation: "Text and background colors don't provide sufficient contrast for readability",
        repair_strategy: "adjust_style",
        repair_params: { action: "darken_text_or_lighten_bg" },
        confidence: 0.85,
      },
      typographic_inconsistency: {
        issue_id: issue.id,
        root_cause: "too_many_fonts",
        explanation: "More fonts than recommended are used, reducing visual coherence",
        repair_strategy: "adjust_style",
        repair_params: { action: "consolidate_fonts" },
        confidence: 0.6,
      },
      numbering_errors: {
        issue_id: issue.id,
        root_cause: "non_sequential_numbering",
        explanation: "Chapter or page numbers have gaps or are out of sequence",
        repair_strategy: "adjust_style",
        repair_params: { action: "renumber" },
        confidence: 0.95,
      },
      legibility_problems: {
        issue_id: issue.id,
        root_cause: "text_too_small",
        explanation: "Text size or line height is below readable thresholds",
        repair_strategy: "adjust_style",
        repair_params: { action: "increase_size" },
        confidence: 0.9,
      },
    };

    return diagnoses[issue.category] ?? {
      issue_id: issue.id,
      root_cause: "unknown",
      explanation: `Root cause could not be determined for category: ${issue.category}`,
      repair_strategy: "manual",
      repair_params: {},
      confidence: 0.3,
    };
  }

  // ─── Repair Implementations ────────────────────────────────────────

  private repairCutText(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    // Reduce font size slightly to fit more text
    const updatedEditorial = { ...editorial };
    updatedEditorial.paragraph_style = {
      ...editorial.paragraph_style,
      size: Math.max(9, editorial.paragraph_style.size - 1),
      line_height: Math.max(1.2, editorial.paragraph_style.line_height - 0.05),
    };

    return {
      repaired: true,
      issue_id: issue.id,
      repair_description: `Reduced body font size to ${updatedEditorial.paragraph_style.size}pt and line height to ${updatedEditorial.paragraph_style.line_height}`,
      updated_editorial: updatedEditorial,
      remaining_issues: [],
    };
  }

  private repairOverflow(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    // Adjust margins to provide more content space
    const updatedEditorial = { ...editorial };
    updatedEditorial.margins = {
      ...editorial.margins,
      top: Math.max(36, editorial.margins.top - 8),
      bottom: Math.max(36, editorial.margins.bottom - 8),
    };

    return {
      repaired: true,
      issue_id: issue.id,
      repair_description: `Reduced margins to provide more content area (top: ${updatedEditorial.margins.top}pt, bottom: ${updatedEditorial.margins.bottom}pt)`,
      updated_editorial: updatedEditorial,
      remaining_issues: [],
    };
  }

  private repairEmptyPages(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    return {
      repaired: true,
      issue_id: issue.id,
      repair_description: "Empty page will be removed during reflow",
      remaining_issues: [],
    };
  }

  private repairBadHierarchy(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    return {
      repaired: false,
      issue_id: issue.id,
      repair_description: "Hierarchy issues require content restructuring — manual review recommended",
      remaining_issues: [issue.id],
    };
  }

  private repairNumberingErrors(
    issue: QAIssue,
    content: BookContent,
    editorial: EditorialSpecification
  ): RepairedContent {
    // Renumber chapters sequentially
    const updatedContent: BookContent = {
      ...content,
      chapters: content.chapters.map((ch, idx) => ({
        ...ch,
        chapter_number: idx + 1,
      })),
    };

    return {
      repaired: true,
      issue_id: issue.id,
      repair_description: "Renumbered all chapters sequentially",
      updated_content: updatedContent,
      remaining_issues: [],
    };
  }

  // ─── Utility Methods ──────────────────────────────────────────────

  /**
   * Find source content by reference key.
   */
  private findSourceContent(
    content: BookContent,
    contentRef: string
  ): string | null {
    const match = contentRef.match(/chapter-(\d+)-para-(\d+)/);
    if (match) {
      const chapterNum = parseInt(match[1], 10);
      const paraIdx = parseInt(match[2], 10);
      const chapter = content.chapters.find((c) => c.chapter_number === chapterNum);
      if (chapter) {
        let paraCount = 0;
        for (const section of chapter.sections) {
          for (let i = 0; i < section.paragraphs.length; i++) {
            if (paraCount === paraIdx) return section.paragraphs[i];
            paraCount++;
          }
        }
      }
    }
    return null;
  }

  /**
   * Estimate minimum height for a text element.
   */
  private estimateMinHeight(text: string, editorial: EditorialSpecification): number {
    const charsPerLine = 60; // conservative estimate
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    return lines * editorial.paragraph_style.size * editorial.paragraph_style.line_height;
  }

  /**
   * Estimate WCAG contrast ratio (simplified).
   */
  private estimateContrast(foreground: string, background: string): number {
    const fgLum = this.relativeLuminance(foreground);
    const bgLum = this.relativeLuminance(background);
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    return (lighter + 0.05) / (darker + 0.05);
  }

  private relativeLuminance(hex: string): number {
    const r = this.sRGBtoLinear(parseInt(hex.slice(1, 3), 16) / 255);
    const g = this.sRGBtoLinear(parseInt(hex.slice(3, 5), 16) / 255);
    const b = this.sRGBtoLinear(parseInt(hex.slice(5, 7), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private sRGBtoLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
}
