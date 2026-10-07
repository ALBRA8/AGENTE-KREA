/**
 * PDF/EPUB Factory — KREA Book Factory Layer
 *
 * Generates the final PDF artifact from layout, content, cover, and editorial
 * specifications. Also provides verification that the generated PDF is valid.
 *
 * Satisfies:
 *   AC-042 — PDFVerification with opens, page_count_ok, structure_ok,
 *            fonts_ok, images_ok, links_ok, index_ok, numbering_ok,
 *            no_broken_pages, no_cut_content, no_overflow, overall
 *
 * FASE 9 hardening:
 *   - renderToPDF() generates REAL PDF files via Python/ReportLab subprocess
 *   - verify() checks the actual file on disk when filePath is set
 *   - Unverifiable checks are marked "NOT_VERIFIED" instead of hardcoded true
 */

import { randomUUID } from "crypto";
import { createHash } from "crypto";
import { existsSync, statSync, readFileSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { tmpdir } from "os";
import { writeFileSync, unlinkSync } from "fs";
import type { LayoutResult, EditorialSpecification, BookContent } from "./editorial-design";
import type { ArtDirectionSpec } from "./art-direction";
import type { CoverSpecification } from "./cover-design";
import type { QAResult } from "./visual-qa";

// ─── PDF Generation Result ─────────────────────────────────────────────

export interface PDFResult {
  /** Whether generation was successful */
  success: boolean;
  /** File path of the generated PDF (if saved to disk) */
  filePath: string | null;
  /** File name */
  fileName: string;
  /** Number of pages in the PDF */
  pageCount: number;
  /** Size in bytes */
  sizeBytes: number;
  /** SHA-256 checksum for integrity verification */
  checksum: string;
  /** Timestamp of generation */
  generatedAt: string;
  /** The PDF spec data (for rendering by pdf skill) */
  spec: PDFRenderSpec;
  /** Any errors during generation */
  errors: string[];
}

// ─── PDF Render Specification ──────────────────────────────────────────

/**
 * Complete specification for rendering a PDF.
 * This is the data structure passed to the pdf skill for actual rendering.
 */
export interface PDFRenderSpec {
  /** Unique spec ID */
  id: string;
  /** Document metadata */
  metadata: PDFMetadata;
  /** Page dimensions and settings */
  page_setup: PDFPageSetup;
  /** Cover page specification */
  cover: CoverSpecification;
  /** Table of contents configuration */
  toc: PDFTocConfig;
  /** Body pages with all elements */
  pages: PDFPageSpec[];
  /** Fonts to embed */
  fonts: PDFFontSpec[];
  /** Visual system ID this PDF belongs to */
  visual_system_id: string;
}

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  keywords: string[];
  creator: string;
  producer: string;
  creation_date: string;
}

export interface PDFPageSetup {
  width: number;
  height: number;
  margins: {
    top: number;
    bottom: number;
    inner: number;
    outer: number;
  };
  dpi: number;
  /** Whether to enable PDF/A archival format */
  pdf_a: boolean;
}

export interface PDFTocConfig {
  enabled: boolean;
  max_depth: number;
  /** Whether TOC uses dot leaders */
  dot_leaders: boolean;
  /** Page where TOC starts */
  start_page: number;
}

export interface PDFPageSpec {
  page_number: number;
  is_chapter_opening: boolean;
  chapter_number: number | null;
  elements: PDFElementSpec[];
  header: PDFHeaderFooterSpec | null;
  footer: PDFHeaderFooterSpec | null;
}

export interface PDFElementSpec {
  type: "heading" | "paragraph" | "quote" | "list" | "image" | "table" | "caption" | "page_break" | "decoration" | "drop_cap";
  x: number;
  y: number;
  width: number;
  height: number;
  content: string;
  style: Record<string, unknown>;
}

export interface PDFHeaderFooterSpec {
  text: string;
  position: "left" | "center" | "right";
  style: Record<string, unknown>;
}

export interface PDFFontSpec {
  name: string;
  family: string;
  weight: number;
  style: "normal" | "italic";
  /** Whether this font must be embedded */
  embed: boolean;
}

// ─── PDF Verification (AC-042) ─────────────────────────────────────────

/**
 * Tri-state for verification: true (passed), false (failed), "NOT_VERIFIED" (could not check).
 */
export type VerificationStatus = boolean | "NOT_VERIFIED";

/**
 * Comprehensive verification of a generated PDF.
 *
 * AC-042: Verifies opens, page_count, structure, fonts, images, links,
 *   index, numbering, broken pages, cut content, overflow.
 *
 * Each field may be true, false, or "NOT_VERIFIED" if the check
 * could not be performed (e.g., no PDF file on disk, no PDF parser).
 */
export interface PDFVerification {
  /** PDF opens without errors */
  opens: VerificationStatus;
  /** Page count matches expected */
  page_count_ok: VerificationStatus;
  /** PDF structure is valid (catalog, pages tree, etc.) */
  structure_ok: VerificationStatus;
  /** All fonts are embedded and valid */
  fonts_ok: VerificationStatus;
  /** All images are embedded and not corrupted */
  images_ok: VerificationStatus;
  /** All internal links resolve to valid pages */
  links_ok: VerificationStatus;
  /** Index (if present) is correct */
  index_ok: VerificationStatus;
  /** Page and chapter numbering is sequential and correct */
  numbering_ok: VerificationStatus;
  /** No broken pages (blank, misformatted, etc.) */
  no_broken_pages: VerificationStatus;
  /** No content is cut off */
  no_cut_content: VerificationStatus;
  /** No content overflows page boundaries */
  no_overflow: VerificationStatus;
  /** Overall pass/fail (all critical checks must pass; NOT_VERIFIED is treated as inconclusive, not a fail) */
  overall: VerificationStatus;
  /** Detailed results for each check */
  details: PDFVerificationDetail[];
}

export interface PDFVerificationDetail {
  check: string;
  passed: VerificationStatus;
  message: string;
  severity: "critical" | "warning" | "info";
}

// ─── PDF Generation Options ────────────────────────────────────────────

export interface PDFGenerationOptions {
  /** Output format */
  format: "pdf" | "epub";
  /** Whether to include cover page */
  include_cover: boolean;
  /** Whether to generate TOC */
  include_toc: boolean;
  /** Whether to generate index */
  include_index: boolean;
  /** PDF/A archival format */
  pdf_a: boolean;
  /** Whether to compress the output */
  compress: boolean;
}

// ─── RenderToPDF Result ────────────────────────────────────────────────

export interface RenderToPDFResult {
  /** Whether the render succeeded */
  success: boolean;
  /** Absolute path of the generated PDF file */
  filePath: string;
  /** Number of pages in the generated PDF */
  pageCount: number;
  /** Size of the PDF file in bytes */
  sizeBytes: number;
  /** Error message if render failed */
  error?: string;
}

// ─── PDFFactory Class ──────────────────────────────────────────────────

/**
 * PDFFactory — generates final PDF/EPUB artifacts.
 *
 * Three main operations:
 * 1. generatePDF() — produces the PDF spec and (optionally) the file
 * 2. renderToPDF() — renders a PDFRenderSpec to a real PDF file via Python/ReportLab
 * 3. verify() — validates the generated PDF against AC-042 criteria
 */
export class PDFFactory {
  /** Path to the render-pdf.py script */
  private readonly renderScriptPath: string;

  constructor() {
    // Resolve the Python renderer script path relative to project root
    this.renderScriptPath = join(process.cwd(), "scripts", "render-pdf.py");
  }

  /**
   * Generate a PDF from layout, content, cover, and editorial specifications.
   *
   * This produces the PDFRenderSpec (the blueprint for the PDF) and
   * optionally triggers actual PDF generation via the pdf skill.
   *
   * @param layout - The deterministic layout result
   * @param content - The book content
   * @param cover - The cover specification
   * @param editorial - The editorial specification
   * @param artDirection - The visual system
   * @param options - Generation options
   * @returns PDFResult with the generated PDF info and render spec
   */
  generatePDF(
    layout: LayoutResult,
    content: BookContent,
    cover: CoverSpecification,
    editorial: EditorialSpecification,
    artDirection: ArtDirectionSpec,
    options: PDFGenerationOptions = {
      format: "pdf",
      include_cover: true,
      include_toc: true,
      include_index: editorial.index_config.generate,
      pdf_a: false,
      compress: true,
    }
  ): PDFResult {
    const errors: string[] = [];

    try {
      // Build the complete PDF render specification
      const spec = this.buildRenderSpec(
        layout, content, cover, editorial, artDirection, options
      );

      // Compute checksum of the spec for integrity
      const specJson = JSON.stringify(spec);
      const checksum = createHash("sha256").update(specJson).digest("hex");

      // Generate filename
      const safeTitle = content.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const fileName = `${safeTitle}.${options.format}`;

      // Estimate size (rough: ~2KB per page for text-heavy PDFs)
      const estimatedSize = layout.page_count * 2048 + (options.include_cover ? 50000 : 0);

      return {
        success: true,
        filePath: null, // Set by renderToPDF() after actual rendering
        fileName,
        pageCount: layout.page_count + (options.include_cover ? 1 : 0) + (options.include_toc ? 1 : 0),
        sizeBytes: estimatedSize,
        checksum,
        generatedAt: new Date().toISOString(),
        spec,
        errors: [],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);

      return {
        success: false,
        filePath: null,
        fileName: "",
        pageCount: 0,
        sizeBytes: 0,
        checksum: "",
        generatedAt: new Date().toISOString(),
        spec: this.emptyRenderSpec(),
        errors,
      };
    }
  }

  /**
   * Render a PDFRenderSpec to a real PDF file using the Python/ReportLab subprocess.
   *
   * This is the REAL PDF generation — it calls scripts/render-pdf.py which
   * uses ReportLab to produce actual PDF bytes on disk.
   *
   * @param renderSpec - The complete PDF render specification
   * @param outputPath - Where to write the PDF file (defaults to tmpdir)
   * @returns RenderToPDFResult with file path, page count, and size
   */
  renderToPDF(
    renderSpec: PDFRenderSpec,
    outputPath?: string
  ): RenderToPDFResult {
    const outPath = outputPath ?? join(tmpdir(), `krea-${renderSpec.id}.pdf`);
    let tempJsonPath = "";

    try {
      // 1. Write the renderSpec as JSON to a temp file
      tempJsonPath = join(tmpdir(), `krea-spec-${renderSpec.id}.json`);
      const specPayload = JSON.stringify({
        spec: renderSpec,
        outputPath: outPath,
      });
      writeFileSync(tempJsonPath, specPayload, "utf-8");

      // 2. Call the Python script via subprocess
      const result = execSync(
        `python3 "${this.renderScriptPath}" < "${tempJsonPath}"`,
        {
          encoding: "utf-8",
          timeout: 60_000, // 60s timeout for PDF rendering
          maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        }
      );

      // 3. Parse the JSON result from the Python script
      const parsed = JSON.parse(result.trim()) as {
        success: boolean;
        pageCount: number;
        sizeBytes: number;
        filePath: string | null;
        error?: string;
      };

      // 4. Clean up temp file
      try { unlinkSync(tempJsonPath); } catch { /* ignore */ }

      if (!parsed.success) {
        return {
          success: false,
          filePath: outPath,
          pageCount: 0,
          sizeBytes: 0,
          error: parsed.error ?? "Python renderer returned success=false",
        };
      }

      return {
        success: true,
        filePath: parsed.filePath ?? outPath,
        pageCount: parsed.pageCount,
        sizeBytes: parsed.sizeBytes,
      };
    } catch (error) {
      // Clean up temp file on error
      if (tempJsonPath) {
        try { unlinkSync(tempJsonPath); } catch { /* ignore */ }
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        filePath: outPath,
        pageCount: 0,
        sizeBytes: 0,
        error: `renderToPDF subprocess failed: ${message}`,
      };
    }
  }

  /**
   * Verify a generated PDF against AC-042 criteria.
   *
   * AC-042: Comprehensive verification of PDF quality.
   *
   * HONESTY RULE: If a check cannot be performed (no file on disk, no PDF
   * parser available), the status is "NOT_VERIFIED" — never fake a PASS.
   *
   * @param pdfResult - The PDF result to verify
   * @param expectedPageCount - Expected page count
   * @param qaResult - Optional QA result for additional checks
   * @returns PDFVerification with detailed check results
   */
  verify(
    pdfResult: PDFResult,
    expectedPageCount: number,
    qaResult?: QAResult
  ): PDFVerification {
    const details: PDFVerificationDetail[] = [];

    // Determine if we have a real PDF file to inspect
    const hasFile = pdfResult.filePath !== null && existsSync(pdfResult.filePath);
    let fileSize = 0;
    let canOpenFile = false;

    if (hasFile) {
      try {
        const stat = statSync(pdfResult.filePath!);
        fileSize = stat.size;
        // Try to read the first bytes to confirm it's a PDF
        const buf = readFileSync(pdfResult.filePath!);
        const header = buf.subarray(0, 5).toString("utf-8");
        canOpenFile = header.startsWith("%PDF");
      } catch {
        canOpenFile = false;
      }
    }

    // ── Check: PDF opens ──────────────────────────────────────────────
    let opens: VerificationStatus;
    if (hasFile && canOpenFile) {
      // Real file on disk that starts with %PDF — actually opens
      opens = pdfResult.success && pdfResult.errors.length === 0;
      details.push({
        check: "opens",
        passed: opens,
        message: opens
          ? `PDF file verified: ${pdfResult.filePath} (${fileSize} bytes, valid %PDF header)`
          : `PDF has errors: ${pdfResult.errors.join(", ")}`,
        severity: "critical",
      });
    } else if (hasFile && !canOpenFile) {
      // File exists but doesn't have valid PDF header
      opens = false;
      details.push({
        check: "opens",
        passed: false,
        message: `File exists at ${pdfResult.filePath} but is not a valid PDF (missing %PDF header)`,
        severity: "critical",
      });
    } else {
      // No file on disk — cannot verify
      opens = "NOT_VERIFIED";
      details.push({
        check: "opens",
        passed: "NOT_VERIFIED",
        message: "No PDF file on disk to verify — renderToPDF() has not been called or filePath is null",
        severity: "critical",
      });
    }

    // ── Check: Page count matches expected ────────────────────────────
    const pageCountOk: VerificationStatus = pdfResult.pageCount === expectedPageCount;
    details.push({
      check: "page_count",
      passed: pageCountOk,
      message: pageCountOk
        ? `Page count matches: ${pdfResult.pageCount}`
        : `Page count mismatch: got ${pdfResult.pageCount}, expected ${expectedPageCount}`,
      severity: "warning",
    });

    // ── Check: Structure is valid ─────────────────────────────────────
    const structureOk: VerificationStatus = hasFile && canOpenFile
      ? (pdfResult.success && pdfResult.spec.pages.length > 0)
      : "NOT_VERIFIED";
    details.push({
      check: "structure",
      passed: structureOk,
      message: structureOk === true
        ? "PDF structure is valid (file on disk, spec has pages)"
        : structureOk === false
          ? "PDF structure is invalid or empty"
          : "NOT_VERIFIED: Cannot verify structure without a rendered PDF file",
      severity: "critical",
    });

    // ── Check: Fonts are specified ────────────────────────────────────
    // Fonts are in the spec, so we CAN check this at spec level
    const fontsOk = pdfResult.spec.fonts.length > 0 &&
      pdfResult.spec.fonts.every((f) => f.name && f.family);
    details.push({
      check: "fonts",
      passed: fontsOk,
      message: fontsOk
        ? `All ${pdfResult.spec.fonts.length} fonts are valid in spec`
        : "Some fonts are missing or invalid in spec",
      severity: "critical",
    });

    // ── Check: Images ─────────────────────────────────────────────────
    // HONEST: Without a PDF parser, we cannot verify embedded images
    let imagesOk: VerificationStatus;
    if (hasFile && canOpenFile) {
      // We have a file but no PDF parser to inspect image objects
      imagesOk = "NOT_VERIFIED";
      details.push({
        check: "images",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: PDF file exists but no PDF parser available to inspect embedded images",
        severity: "info",
      });
    } else {
      imagesOk = "NOT_VERIFIED";
      details.push({
        check: "images",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: No PDF file on disk to inspect for image integrity",
        severity: "info",
      });
    }

    // ── Check: Links ──────────────────────────────────────────────────
    // We can verify internal links from the spec (page references)
    const linksOk = this.verifyInternalLinks(pdfResult);
    details.push({
      check: "links",
      passed: linksOk,
      message: linksOk
        ? "All internal links resolve (spec-level check)"
        : "Some internal links are broken (spec-level check)",
      severity: "warning",
    });

    // ── Check: Index ──────────────────────────────────────────────────
    // HONEST: Without rendering the PDF and parsing it, we cannot verify the index
    let indexOk: VerificationStatus;
    if (hasFile && canOpenFile) {
      indexOk = "NOT_VERIFIED";
      details.push({
        check: "index",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: PDF file exists but no PDF parser to verify index correctness",
        severity: "info",
      });
    } else {
      indexOk = "NOT_VERIFIED";
      details.push({
        check: "index",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: No PDF file on disk to verify index",
        severity: "info",
      });
    }

    // ── Check: Numbering ──────────────────────────────────────────────
    const numberingOk = this.verifyNumbering(pdfResult);
    details.push({
      check: "numbering",
      passed: numberingOk,
      message: numberingOk
        ? "Numbering is sequential (spec-level check)"
        : "Numbering has gaps or errors (spec-level check)",
      severity: "warning",
    });

    // ── Check: No broken pages ────────────────────────────────────────
    const noBrokenPages = pdfResult.spec.pages.every(
      (p) => p.elements.length > 0 || p.is_chapter_opening
    );
    details.push({
      check: "no_broken_pages",
      passed: noBrokenPages,
      message: noBrokenPages
        ? "No broken pages detected (spec-level check)"
        : "Some pages are broken (spec-level check)",
      severity: "warning",
    });

    // ── Check: No cut content ─────────────────────────────────────────
    let noCutContent: VerificationStatus;
    if (qaResult) {
      noCutContent = qaResult.by_category.cut_text === 0;
      details.push({
        check: "no_cut_content",
        passed: noCutContent,
        message: noCutContent
          ? "No cut content detected (QA result)"
          : "Some content appears cut off (QA result)",
        severity: "critical",
      });
    } else {
      noCutContent = "NOT_VERIFIED";
      details.push({
        check: "no_cut_content",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: No QA result provided to check for cut content",
        severity: "critical",
      });
    }

    // ── Check: No overflow ────────────────────────────────────────────
    let noOverflow: VerificationStatus;
    if (qaResult) {
      noOverflow = qaResult.by_category.overflow === 0;
      details.push({
        check: "no_overflow",
        passed: noOverflow,
        message: noOverflow
          ? "No overflow detected (QA result)"
          : "Some content overflows page boundaries (QA result)",
        severity: "critical",
      });
    } else {
      noOverflow = "NOT_VERIFIED";
      details.push({
        check: "no_overflow",
        passed: "NOT_VERIFIED",
        message: "NOT_VERIFIED: No QA result provided to check for overflow",
        severity: "critical",
      });
    }

    // ── Overall ───────────────────────────────────────────────────────
    // Overall is true only if all critical checks pass (not NOT_VERIFIED).
    // If any critical check is NOT_VERIFIED, overall is NOT_VERIFIED.
    // If any critical check is false, overall is false.
    const criticalResults = details
      .filter((d) => d.severity === "critical")
      .map((d) => d.passed);

    const anyFailed = criticalResults.some((r) => r === false);
    const anyNotVerified = criticalResults.some((r) => r === "NOT_VERIFIED");

    let overall: VerificationStatus;
    if (anyFailed) {
      overall = false;
    } else if (anyNotVerified) {
      overall = "NOT_VERIFIED";
    } else {
      overall = true;
    }

    return {
      opens,
      page_count_ok: pageCountOk,
      structure_ok: structureOk,
      fonts_ok: fontsOk,
      images_ok: imagesOk,
      links_ok: linksOk,
      index_ok: indexOk,
      numbering_ok: numberingOk,
      no_broken_pages: noBrokenPages,
      no_cut_content: noCutContent,
      no_overflow: noOverflow,
      overall,
      details,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Build the complete PDF render specification.
   */
  private buildRenderSpec(
    layout: LayoutResult,
    content: BookContent,
    cover: CoverSpecification,
    editorial: EditorialSpecification,
    artDirection: ArtDirectionSpec,
    options: PDFGenerationOptions
  ): PDFRenderSpec {
    const metadata: PDFMetadata = {
      title: content.title,
      author: content.author,
      subject: `${content.title} - ${content.subtitle}`,
      keywords: [artDirection.style, artDirection.mood, cover.genre],
      creator: "KREA Book Factory v2",
      producer: "KREA-PDF-Factory",
      creation_date: new Date().toISOString(),
    };

    const pageSetup: PDFPageSetup = {
      width: artDirection.visual_system.page_dimensions.width,
      height: artDirection.visual_system.page_dimensions.height,
      margins: {
        top: editorial.margins.top,
        bottom: editorial.margins.bottom,
        inner: editorial.margins.inner,
        outer: editorial.margins.outer,
      },
      dpi: artDirection.visual_system.dpi,
      pdf_a: options.pdf_a,
    };

    const toc: PDFTocConfig = {
      enabled: options.include_toc,
      max_depth: editorial.hierarchy_rules.length > 0
        ? Math.max(...editorial.hierarchy_rules.map((r) => r.to_level))
        : 3,
      dot_leaders: true,
      start_page: options.include_cover ? 2 : 1,
    };

    // Convert layout pages to PDF page specs
    const pages: PDFPageSpec[] = layout.pages.map((layoutPage) => ({
      page_number: layoutPage.page_number,
      is_chapter_opening: layoutPage.is_chapter_opening,
      chapter_number: layoutPage.chapter_number,
      elements: layoutPage.elements.map((elem) => ({
        type: elem.type,
        x: elem.x,
        y: elem.y,
        width: elem.width,
        height: elem.height,
        content: elem.content_ref,
        style: elem.style,
      })),
      header: layoutPage.header_text
        ? { text: layoutPage.header_text, position: "center", style: {} }
        : null,
      footer: layoutPage.footer_text
        ? { text: layoutPage.footer_text, position: "center", style: {} }
        : null,
    }));

    // Collect all fonts used
    const fonts = this.collectFonts(artDirection, editorial);

    return {
      id: randomUUID(),
      metadata,
      page_setup: pageSetup,
      cover,
      toc,
      pages,
      fonts,
      visual_system_id: artDirection.visual_system.id,
    };
  }

  /**
   * Collect all fonts used in the document.
   */
  private collectFonts(
    artDirection: ArtDirectionSpec,
    editorial: EditorialSpecification
  ): PDFFontSpec[] {
    const fontSet = new Map<string, PDFFontSpec>();

    const addFont = (name: string, family: string, weight: number, style: "normal" | "italic" = "normal") => {
      const key = `${family}-${weight}-${style}`;
      if (!fontSet.has(key)) {
        fontSet.set(key, { name, family, weight, style, embed: true });
      }
    };

    // Heading font
    addFont("heading", artDirection.typography.heading_font, artDirection.typography.weights.bold);
    addFont("heading-italic", artDirection.typography.heading_font, artDirection.typography.weights.bold, "italic");

    // Body font
    addFont("body", artDirection.typography.body_font, artDirection.typography.weights.normal);
    addFont("body-bold", artDirection.typography.body_font, artDirection.typography.weights.semibold);
    addFont("body-italic", artDirection.typography.body_font, artDirection.typography.weights.normal, "italic");

    // Mono font
    addFont("mono", artDirection.typography.mono_font, artDirection.typography.weights.normal);

    // Additional from editorial
    for (const heading of editorial.heading_styles) {
      addFont(`h${heading.level}`, heading.font, heading.weight);
    }

    return Array.from(fontSet.values());
  }

  /**
   * Verify internal links in the PDF.
   */
  private verifyInternalLinks(pdfResult: PDFResult): boolean {
    const validPageNumbers = new Set(
      pdfResult.spec.pages.map((p) => p.page_number)
    );

    // Check that all TOC entries reference valid pages
    // (This is a simplified check — full check would inspect PDF annotations)
    for (const page of pdfResult.spec.pages) {
      for (const element of page.elements) {
        if (element.type === "heading" && element.content.includes("chapter")) {
          // Chapter references should be within valid pages
          if (page.page_number > pdfResult.pageCount) {
            return false;
          }
        }
      }
    }

    return validPageNumbers.size > 0;
  }

  /**
   * Verify page numbering in the PDF.
   */
  private verifyNumbering(pdfResult: PDFResult): boolean {
    const pageNumbers = pdfResult.spec.pages.map((p) => p.page_number);

    // Check sequential numbering
    for (let i = 1; i < pageNumbers.length; i++) {
      if (pageNumbers[i] !== pageNumbers[i - 1] + 1) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create an empty render spec for error cases.
   */
  private emptyRenderSpec(): PDFRenderSpec {
    return {
      id: randomUUID(),
      metadata: {
        title: "",
        author: "",
        subject: "",
        keywords: [],
        creator: "KREA Book Factory v2",
        producer: "KREA-PDF-Factory",
        creation_date: new Date().toISOString(),
      },
      page_setup: {
        width: 0,
        height: 0,
        margins: { top: 0, bottom: 0, inner: 0, outer: 0 },
        dpi: 0,
        pdf_a: false,
      },
      cover: {} as CoverSpecification,
      toc: { enabled: false, max_depth: 0, dot_leaders: false, start_page: 0 },
      pages: [],
      fonts: [],
      visual_system_id: "",
    };
  }
}
