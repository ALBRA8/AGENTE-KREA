/**
 * PDF Factory — KREA V2
 *
 * Generates REAL PDF files using pdf-lib. Every function must produce a
 * verifiable result or throw a real error. No `pdfGenerated = true` without
 * the file physically existing on disk.
 *
 * Evidence tags: VERIFIED (file inspected), NOT_VERIFIED (skipped/cached)
 */

import {
  PDFDocument,
  rgb,
  StandardFonts,
  PDFPage,
  PDFFont,
} from "pdf-lib";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

// ─── Evidence Tag ─────────────────────────────────────────────────────────────

export type EvidenceTag =
  | "VERIFIED"
  | "INFERRED"
  | "ESTIMATED"
  | "NOT_VERIFIED"
  | "UNKNOWN";

// ─── Configuration ────────────────────────────────────────────────────────────

export const DEFAULT_OUTPUT_DIR =
  process.env.KREA_PDF_OUTPUT_DIR || "/home/z/my-project/download";

export interface PdfConfig {
  title: string;
  author: string;
  subject?: string;
  pageSize: "A4" | "Letter" | "A5";
  orientation: "portrait" | "landscape";
  margins: { top: number; bottom: number; left: number; right: number };
  defaultFont: string;
  defaultFontSize: number;
  lineHeight: number;
}

export interface PdfChapter {
  title: string;
  content: string; // plain text (markdown is stripped to text)
}

export interface PdfResult {
  success: boolean;
  filePath: string; // absolute path to the generated PDF
  fileName: string;
  fileSize: number; // bytes
  pageCount: number;
  metadata: PdfMetadata;
  evidence: EvidenceTag;
}

export interface PdfMetadata {
  title: string;
  author: string;
  creator: string;
  producer: string;
  creationDate: Date;
}

export interface PdfInspection {
  filePath: string;
  exists: boolean;
  fileSize: number;
  pageCount: number;
  metadata: {
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: Date;
  };
  evidence: EvidenceTag;
}

// ─── Page dimensions ──────────────────────────────────────────────────────────

const PAGE_SIZES: Record<
  string,
  { width: number; height: number }
> = {
  A4: { width: 595.28, height: 841.89 },
  Letter: { width: 612, height: 792 },
  A5: { width: 419.53, height: 595.28 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip basic markdown to plain text */
function stripMarkdown(md: string): string {
  return md
    .replace(/^#{1,6}\s+/gm, "") // headings
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/_(.+?)_/g, "$1") // italic underscore
    .replace(/`(.+?)`/g, "$1") // inline code
    .replace(/^\s*[-*+]\s+/gm, "• ") // unordered list
    .replace(/^\s*\d+\.\s+/gm, "") // ordered list numbers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links → text
    .replace(/^---+$/gm, "—") // hr
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // images removed
    .trim();
}

/** Split text into lines that fit within maxWidth */
function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const rawLines = text.split("\n");
  const wrapped: string[] = [];

  for (const rawLine of rawLines) {
    if (rawLine.trim() === "") {
      wrapped.push("");
      continue;
    }
    const words = rawLine.split(" ");
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(test, fontSize);
      if (testWidth > maxWidth && current) {
        wrapped.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) wrapped.push(current);
  }

  return wrapped;
}

/** Ensure directory exists */
async function ensureDir(dir: string): Promise<void> {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // may already exist
  }
}

/** Detect image type from file extension */
function imageTypeFromPath(
  filePath: string
): "jpg" | "png" | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "jpg";
  if (ext === ".png") return "png";
  return null;
}

// ─── Default config builder ───────────────────────────────────────────────────

export function defaultPdfConfig(
  title: string,
  author: string
): PdfConfig {
  return {
    title,
    author,
    subject: title,
    pageSize: "A4",
    orientation: "portrait",
    margins: { top: 72, bottom: 72, left: 72, right: 72 },
    defaultFont: "Helvetica",
    defaultFontSize: 11,
    lineHeight: 1.5,
  };
}

// ─── generatePdf ──────────────────────────────────────────────────────────────

/**
 * Generate a REAL PDF file on disk.
 *
 * - Embeds cover image as first page if provided
 * - Creates table of contents page
 * - Formats each chapter with proper typography
 * - Adds page numbers to every content page
 * - Verifies the file exists after writing
 * - Returns PdfResult with VERIFIED evidence
 */
export async function generatePdf(
  config: PdfConfig,
  chapters: PdfChapter[],
  coverImagePath?: string,
  outputDir?: string
): Promise<PdfResult> {
  const outDir = outputDir || DEFAULT_OUTPUT_DIR;
  await ensureDir(outDir);

  const pdfDoc = await PDFDocument.create();

  // ── Metadata ──────────────────────────────────────────────────────────
  pdfDoc.setTitle(config.title);
  pdfDoc.setAuthor(config.author);
  pdfDoc.setSubject(config.subject || config.title);
  pdfDoc.setCreator("KREA V2 — Book Factory");
  pdfDoc.setProducer("pdf-lib / KREA V2");
  pdfDoc.setCreationDate(new Date());

  // ── Fonts ─────────────────────────────────────────────────────────────
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // ── Page geometry ─────────────────────────────────────────────────────
  const pageSize = PAGE_SIZES[config.pageSize] || PAGE_SIZES.A4;
  const pageWidth =
    config.orientation === "landscape" ? pageSize.height : pageSize.width;
  const pageHeight =
    config.orientation === "landscape" ? pageSize.width : pageSize.height;

  const contentWidth =
    pageWidth - config.margins.left - config.margins.right;
  const contentHeight =
    pageHeight - config.margins.top - config.margins.bottom;

  // ── Cover page (if image provided) ────────────────────────────────────
  let coverPageAdded = false;
  if (coverImagePath) {
    try {
      const coverBytes = await fs.readFile(coverImagePath);
      const imgType = imageTypeFromPath(coverImagePath);

      if (imgType === "jpg") {
        const coverImage = await pdfDoc.embedJpg(coverBytes);
        const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
        // Scale image to fit page while maintaining aspect ratio
        const imgAspect = coverImage.width / coverImage.height;
        const pageAspect = pageWidth / pageHeight;
        let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

        if (imgAspect > pageAspect) {
          // Image is wider relative to page
          drawWidth = pageWidth;
          drawHeight = pageWidth / imgAspect;
          drawX = 0;
          drawY = (pageHeight - drawHeight) / 2;
        } else {
          // Image is taller relative to page
          drawHeight = pageHeight;
          drawWidth = pageHeight * imgAspect;
          drawX = (pageWidth - drawWidth) / 2;
          drawY = 0;
        }

        coverPage.drawImage(coverImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
        coverPageAdded = true;
      } else if (imgType === "png") {
        const coverImage = await pdfDoc.embedPng(coverBytes);
        const coverPage = pdfDoc.addPage([pageWidth, pageHeight]);
        const imgAspect = coverImage.width / coverImage.height;
        const pageAspect = pageWidth / pageHeight;
        let drawWidth: number, drawHeight: number, drawX: number, drawY: number;

        if (imgAspect > pageAspect) {
          drawWidth = pageWidth;
          drawHeight = pageWidth / imgAspect;
          drawX = 0;
          drawY = (pageHeight - drawHeight) / 2;
        } else {
          drawHeight = pageHeight;
          drawWidth = pageHeight * imgAspect;
          drawX = (pageWidth - drawWidth) / 2;
          drawY = 0;
        }

        coverPage.drawImage(coverImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight,
        });
        coverPageAdded = true;
      }
      // If image type unrecognized, skip cover — don't crash the pipeline
    } catch (err) {
      // Cover image failed to load — continue without it
      console.warn(
        `[pdf-factory] Cover image failed to load: ${coverImagePath}`,
        err
      );
    }
  }

  // ── Title page ────────────────────────────────────────────────────────
  const titlePage = pdfDoc.addPage([pageWidth, pageHeight]);
  const titleY = pageHeight / 2 + 60;
  titlePage.drawText(config.title, {
    x: config.margins.left,
    y: titleY,
    size: 28,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
    maxWidth: contentWidth,
  });

  if (config.subject && config.subject !== config.title) {
    titlePage.drawText(config.subject, {
      x: config.margins.left,
      y: titleY - 40,
      size: 14,
      font: italicFont,
      color: rgb(0.3, 0.3, 0.3),
      maxWidth: contentWidth,
    });
  }

  titlePage.drawText(`by ${config.author}`, {
    x: config.margins.left,
    y: titleY - 70,
    size: 12,
    font: font,
    color: rgb(0.4, 0.4, 0.4),
  });

  // ── Table of Contents ─────────────────────────────────────────────────
  // We add a TOC page now, but page numbers for chapters will be estimated
  // since we haven't laid out chapters yet. We'll note the TOC page index.
  const tocPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let tocY = pageHeight - config.margins.top;

  tocPage.drawText("Table of Contents", {
    x: config.margins.left,
    y: tocY,
    size: 20,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.1),
  });
  tocY -= 32;

  // Draw a separator line
  tocPage.drawLine({
    start: { x: config.margins.left, y: tocY },
    end: { x: pageWidth - config.margins.right, y: tocY },
    thickness: 1,
    color: rgb(0.7, 0.7, 0.7),
  });
  tocY -= 20;

  // We'll record chapter start page indices after layout
  const chapterPageIndices: number[] = [];

  // ── Chapter pages ─────────────────────────────────────────────────────
  const tocEntryHeight = 20;
  const tocEntries: { title: string; pageLabel: string }[] = [];

  for (let ci = 0; ci < chapters.length; ci++) {
    const chapter = chapters[ci];
    const plainContent = stripMarkdown(chapter.content);
    const lines = wrapText(
      plainContent,
      font,
      config.defaultFontSize,
      contentWidth
    );

    // Reserve space for chapter heading
    const headingLines = wrapText(
      chapter.title,
      boldFont,
      18,
      contentWidth
    );
    const headingHeight =
      headingLines.length * (18 * config.lineHeight) + 16; // +gap

    // Calculate how many lines fit per page
    const lineGap = config.defaultFontSize * config.lineHeight;
    const linesPerPage = Math.floor(
      (contentHeight - 10) / lineGap // 10pt padding at bottom for page number
    );

    // Total lines = heading lines + content lines + blank line after heading
    const totalContentLines =
      headingLines.length + 1 + lines.length;
    const pagesNeeded = Math.max(
      1,
      Math.ceil(totalContentLines / linesPerPage)
    );

    // Record the page index this chapter starts on (0-based among all pages)
    const chapterStartPageIndex = pdfDoc.getPageCount();
    chapterPageIndices.push(chapterStartPageIndex);
    tocEntries.push({
      title: chapter.title,
      pageLabel: `${chapterStartPageIndex + 1}`,
    });

    // Create pages and write content
    let currentPage: PDFPage | null = null;
    let currentY = 0;
    let lineIndex = 0;

    function newPage(): PDFPage {
      const p = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - config.margins.top;
      return p;
    }

    // Write heading
    currentPage = newPage();
    for (const hl of headingLines) {
      currentPage.drawText(hl, {
        x: config.margins.left,
        y: currentY,
        size: 18,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
        maxWidth: contentWidth,
      });
      currentY -= 18 * config.lineHeight;
    }

    // Separator under heading
    currentY -= 4;
    currentPage.drawLine({
      start: { x: config.margins.left, y: currentY },
      end: { x: pageWidth - config.margins.right, y: currentY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    currentY -= 12;

    // Write content lines
    for (const line of lines) {
      if (currentY < config.margins.bottom + 20) {
        currentPage = newPage();
      }

      if (line.trim() === "") {
        currentY -= lineGap * 0.5; // half-height gap for blank lines
        continue;
      }

      // Check if text will actually fit — if not, wrap aggressively
      try {
        const textWidth = font.widthOfTextAtSize(
          line,
          config.defaultFontSize
        );
        if (textWidth > contentWidth) {
          // Force-wrap the line further
          const subLines = wrapText(line, font, config.defaultFontSize, contentWidth);
          for (const sl of subLines) {
            if (currentY < config.margins.bottom + 20) {
              currentPage = newPage();
            }
            currentPage.drawText(sl, {
              x: config.margins.left,
              y: currentY,
              size: config.defaultFontSize,
              font,
              color: rgb(0.15, 0.15, 0.15),
              maxWidth: contentWidth,
            });
            currentY -= lineGap;
          }
        } else {
          currentPage.drawText(line, {
            x: config.margins.left,
            y: currentY,
            size: config.defaultFontSize,
            font,
            color: rgb(0.15, 0.15, 0.15),
            maxWidth: contentWidth,
          });
          currentY -= lineGap;
        }
      } catch {
        // If a character can't be encoded, replace with '?'
        const safeLine = line.replace(/[^\x20-\x7E]/g, "?");
        currentPage.drawText(safeLine, {
          x: config.margins.left,
          y: currentY,
          size: config.defaultFontSize,
          font,
          color: rgb(0.15, 0.15, 0.15),
          maxWidth: contentWidth,
        });
        currentY -= lineGap;
      }
    }
  }

  // ── Add page numbers to all pages (except cover) ──────────────────────
  const allPages = pdfDoc.getPages();
  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    const pageNum = i + 1;
    // Skip cover page if it was added
    if (coverPageAdded && i === 0) continue;

    const pageLabel = `${pageNum}`;
    const labelWidth = font.widthOfTextAtSize(pageLabel, 9);
    page.drawText(pageLabel, {
      x: (pageWidth - labelWidth) / 2,
      y: 30,
      size: 9,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  // ── Update TOC with page numbers ──────────────────────────────────────
  for (const entry of tocEntries) {
    if (tocY < config.margins.bottom + 20) {
      // Would need a second TOC page — for simplicity, stop adding entries
      break;
    }
    const label = `${entry.title}  ....  ${entry.pageLabel}`;
    tocPage.drawText(entry.title, {
      x: config.margins.left,
      y: tocY,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: contentWidth - 60,
    });
    // Page number right-aligned
    tocPage.drawText(entry.pageLabel, {
      x: pageWidth - config.margins.right - 20,
      y: tocY,
      size: 11,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
    tocY -= tocEntryHeight;
  }

  // ── Save PDF ──────────────────────────────────────────────────────────
  const pdfBytes = await pdfDoc.save();
  const safeFileName = config.title
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
  const fileName = `${safeFileName}_${randomUUID().slice(0, 8)}.pdf`;
  const outputPath = path.join(outDir, fileName);

  await fs.writeFile(outputPath, pdfBytes);

  // ── VERIFY file exists on disk ────────────────────────────────────────
  const stat = await fs.stat(outputPath);
  if (!stat.isFile()) {
    throw new Error(
      `[pdf-factory] PDF was not written as a file: ${outputPath}`
    );
  }
  if (stat.size === 0) {
    throw new Error(
      `[pdf-factory] PDF file is empty (0 bytes): ${outputPath}`
    );
  }

  const finalPageCount = pdfDoc.getPageCount();

  return {
    success: true,
    filePath: outputPath,
    fileName,
    fileSize: stat.size,
    pageCount: finalPageCount,
    metadata: {
      title: config.title,
      author: config.author,
      creator: "KREA V2 — Book Factory",
      producer: "pdf-lib / KREA V2",
      creationDate: new Date(),
    },
    evidence: "VERIFIED", // File was physically written and stat'd
  };
}

// ─── inspectPdf ───────────────────────────────────────────────────────────────

/**
 * Open and inspect a PDF file. Returns real metadata read from the file.
 * Returns evidence=VERIFIED only if the file was actually opened by pdf-lib.
 */
export async function inspectPdf(
  filePath: string
): Promise<PdfInspection> {
  // Check file exists
  let stat;
  try {
    stat = await fs.stat(filePath);
  } catch {
    return {
      filePath,
      exists: false,
      fileSize: 0,
      pageCount: 0,
      metadata: {},
      evidence: "NOT_VERIFIED",
    };
  }

  // Check file size
  if (stat.size === 0) {
    return {
      filePath,
      exists: true,
      fileSize: 0,
      pageCount: 0,
      metadata: {},
      evidence: "NOT_VERIFIED",
    };
  }

  // Try to open with pdf-lib
  try {
    const pdfBytes = await fs.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
    });

    const pageCount = pdfDoc.getPageCount();

    return {
      filePath,
      exists: true,
      fileSize: stat.size,
      pageCount,
      metadata: {
        title: pdfDoc.getTitle() || undefined,
        author: pdfDoc.getAuthor() || undefined,
        creator: pdfDoc.getCreator() || undefined,
        producer: pdfDoc.getProducer() || undefined,
        creationDate: pdfDoc.getCreationDate() || undefined,
      },
      evidence: "VERIFIED", // File was physically opened and parsed
    };
  } catch (err) {
    // File exists but pdf-lib can't parse it
    return {
      filePath,
      exists: true,
      fileSize: stat.size,
      pageCount: 0,
      metadata: {},
      evidence: "NOT_VERIFIED",
    };
  }
}
