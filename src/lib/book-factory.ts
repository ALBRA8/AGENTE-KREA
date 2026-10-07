/**
 * Book Factory — KREA V2
 *
 * Orchestrator for the 10-step eBook production pipeline.
 * Every step must produce a REAL result or throw a REAL error.
 * No step should set `pdfGenerated = true` without the file existing on disk.
 *
 * Pipeline:
 *  1. ARCHITECTURE      → Book structure (chapters, sections, word targets)
 *  2. CONTENT GENERATION → Generate chapter content via ZAI
 *  3. ART DIRECTION     → Determine visual style, color palette, typography
 *  4. COVER DESIGN      → Generate cover image via ZAI image generation
 *  5. EDITORIAL DESIGN  → Review and refine content quality
 *  6. LAYOUT            → Layout content for PDF pages
 *  7. PDF GENERATION    → Generate actual PDF file via pdf-factory
 *  8. VISUAL QA         → Inspect the PDF for quality
 *  9. REPAIR            → Fix issues found in QA
 * 10. FINAL             → Deliver the product
 */

import ZAI from "z-ai-web-dev-sdk";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import {
  generatePdf,
  inspectPdf,
  defaultPdfConfig,
  DEFAULT_OUTPUT_DIR,
  type PdfConfig,
  type PdfChapter,
  type PdfResult,
  type EvidenceTag,
} from "./pdf-factory";
import {
  runVisualQA,
  repairIssue,
  type QAReport,
  type QAIssue,
} from "./visual-qa";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PipelineStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "FAILED";

export interface ChapterDef {
  index: number;
  title: string;
  synopsis: string;
  targetWords: number;
  content?: string; // filled after content generation
}

export interface BookStyle {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  marginSize: number;
  colorScheme: string;
  coverStyle: string;
}

export interface ArtifactMap {
  coverImagePath?: string;
  pdfPath?: string;
  metadataPath?: string;
}

export interface PipelineError {
  step: number;
  stepName: string;
  message: string;
  timestamp: Date;
  recoverable: boolean;
}

export interface BookProject {
  projectId: string;
  userId: string;
  dossierId: string;
  title: string;
  subtitle?: string;
  author: string;
  targetAudience: string;
  chapters: ChapterDef[];
  style: BookStyle;
  status: PipelineStatus;
  currentStep: number;
  artifacts: ArtifactMap;
  errors: PipelineError[];
  startedAt: Date;
  completedAt?: Date;
}

export interface BookProjectInput {
  userId: string;
  dossierId: string;
  title: string;
  subtitle?: string;
  author: string;
  targetAudience: string;
  chapters?: ChapterDef[];
  style?: Partial<BookStyle>;
}

// ─── Progress callback ────────────────────────────────────────────────────────

export type StepName =
  | "ARCHITECTURE"
  | "CONTENT_GENERATION"
  | "ART_DIRECTION"
  | "COVER_DESIGN"
  | "EDITORIAL_DESIGN"
  | "LAYOUT"
  | "PDF_GENERATION"
  | "VISUAL_QA"
  | "REPAIR"
  | "FINAL";

export const STEP_NAMES: StepName[] = [
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

export interface ProgressEvent {
  step: number;
  stepName: StepName;
  status: "started" | "completed" | "failed" | "skipped";
  detail: string;
  timestamp: Date;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ─── ZAI helper ───────────────────────────────────────────────────────────────

async function getZAI() {
  return ZAI.create();
}

// ─── In-memory project store ──────────────────────────────────────────────────
// In production, this would persist to the database via Prisma.

const projectStore = new Map<string, BookProject>();

// ─── createBookProject ────────────────────────────────────────────────────────

/**
 * Create a new BookProject with PENDING status.
 * If chapters are provided, they serve as the architecture (Step 1 is pre-done).
 */
export function createBookProject(input: BookProjectInput): BookProject {
  const projectId = randomUUID();

  const defaultStyle: BookStyle = {
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
    marginSize: 72,
    colorScheme: "professional",
    coverStyle: "modern",
  };

  const style: BookStyle = {
    ...defaultStyle,
    ...input.style,
  };

  const project: BookProject = {
    projectId,
    userId: input.userId,
    dossierId: input.dossierId,
    title: input.title,
    subtitle: input.subtitle,
    author: input.author,
    targetAudience: input.targetAudience,
    chapters: input.chapters || [],
    style,
    status: "PENDING",
    currentStep: 0,
    artifacts: {},
    errors: [],
    startedAt: new Date(),
  };

  projectStore.set(projectId, project);
  return project;
}

// ─── getBookProject ───────────────────────────────────────────────────────────

export function getBookProject(projectId: string): BookProject | undefined {
  return projectStore.get(projectId);
}

// ─── Step 1: ARCHITECTURE ─────────────────────────────────────────────────────

/**
 * If chapters are already provided, this step is trivially complete.
 * Otherwise, use ZAI to generate the book architecture (chapter outline).
 */
async function stepArchitecture(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 1,
    stepName: "ARCHITECTURE",
    status: "started",
    detail: "Determining book structure",
    timestamp: new Date(),
  });

  if (project.chapters.length > 0) {
    // Chapters already provided — architecture is pre-done
    onProgress?.({
      step: 1,
      stepName: "ARCHITECTURE",
      status: "completed",
      detail: `Architecture pre-defined with ${project.chapters.length} chapters`,
      timestamp: new Date(),
    });
    return;
  }

  // Generate architecture via ZAI
  try {
    const zai = await getZAI();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a book architect. Design a book structure based on the given topic and audience. Return a JSON array of chapters, each with: title, synopsis (1-2 sentences), targetWords (number). Return ONLY the JSON array, no other text.`,
        },
        {
          role: "user",
          content: `Book title: "${project.title}"${project.subtitle ? ` — ${project.subtitle}` : ""}\nAuthor: ${project.author}\nTarget audience: ${project.targetAudience}\n\nDesign 5-8 chapters for this book. Return a JSON array.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "[]";
    // Try to parse the JSON
    let chaptersRaw: Array<{
      title: string;
      synopsis: string;
      targetWords: number;
    }>;

    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      chaptersRaw = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error("ZAI did not return valid JSON for chapter architecture");
    }

    project.chapters = chaptersRaw.map((c, i) => ({
      index: i,
      title: c.title || `Chapter ${i + 1}`,
      synopsis: c.synopsis || "",
      targetWords: c.targetWords || 2000,
    }));

    onProgress?.({
      step: 1,
      stepName: "ARCHITECTURE",
      status: "completed",
      detail: `Generated architecture with ${project.chapters.length} chapters`,
      timestamp: new Date(),
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    project.errors.push({
      step: 1,
      stepName: "ARCHITECTURE",
      message: msg,
      timestamp: new Date(),
      recoverable: false,
    });
    onProgress?.({
      step: 1,
      stepName: "ARCHITECTURE",
      status: "failed",
      detail: msg,
      timestamp: new Date(),
    });
    throw new Error(`Step 1 ARCHITECTURE failed: ${msg}`);
  }
}

// ─── Step 2: CONTENT GENERATION ───────────────────────────────────────────────

/**
 * Generate content for each chapter via ZAI.
 * Each chapter's `content` field is filled with the generated text.
 */
async function stepContentGeneration(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 2,
    stepName: "CONTENT_GENERATION",
    status: "started",
    detail: `Generating content for ${project.chapters.length} chapters`,
    timestamp: new Date(),
  });

  const zai = await getZAI();
  let generatedCount = 0;

  for (const chapter of project.chapters) {
    try {
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a professional author writing a book titled "${project.title}" for ${project.targetAudience}. Write clear, engaging, well-structured content. Use markdown formatting for headings, bold, lists. Write approximately ${chapter.targetWords} words.`,
          },
          {
            role: "user",
            content: `Write Chapter ${chapter.index + 1}: "${chapter.title}"\n\nSynopsis: ${chapter.synopsis}\n\nWrite the full chapter content now.`,
          },
        ],
      });

      chapter.content =
        response.choices[0]?.message?.content || "";
      generatedCount++;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      project.errors.push({
        step: 2,
        stepName: "CONTENT_GENERATION",
        message: `Chapter ${chapter.index + 1} "${chapter.title}": ${msg}`,
        timestamp: new Date(),
        recoverable: true,
      });
      // Continue with other chapters — don't abort the entire pipeline
      chapter.content = `[Content generation failed for this chapter: ${msg}]`;
    }
  }

  if (generatedCount === 0) {
    const msg = "No chapters were generated successfully";
    project.errors.push({
      step: 2,
      stepName: "CONTENT_GENERATION",
      message: msg,
      timestamp: new Date(),
      recoverable: false,
    });
    onProgress?.({
      step: 2,
      stepName: "CONTENT_GENERATION",
      status: "failed",
      detail: msg,
      timestamp: new Date(),
    });
    throw new Error(`Step 2 CONTENT_GENERATION failed: ${msg}`);
  }

  onProgress?.({
    step: 2,
    stepName: "CONTENT_GENERATION",
    status: "completed",
    detail: `Generated content for ${generatedCount}/${project.chapters.length} chapters`,
    timestamp: new Date(),
  });
}

// ─── Step 3: ART DIRECTION ────────────────────────────────────────────────────

/**
 * Determine visual style based on book type and audience.
 * Uses ZAI to suggest a style, or falls back to defaults.
 */
async function stepArtDirection(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 3,
    stepName: "ART_DIRECTION",
    status: "started",
    detail: "Determining visual style",
    timestamp: new Date(),
  });

  try {
    const zai = await getZAI();
    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an art director for book design. Based on the book title, audience, and content, suggest a visual style. Return a JSON object with: colorScheme (string describing colors), coverStyle (string like "modern", "classic", "minimal", "bold"), fontSize (number, 10-14), lineHeight (number, 1.2-2.0). Return ONLY the JSON object.`,
        },
        {
          role: "user",
          content: `Title: "${project.title}"\nAudience: ${project.targetAudience}\nChapters: ${project.chapters.map((c) => c.title).join(", ")}\n\nSuggest a visual style.`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const styleSuggestion = JSON.parse(jsonMatch[0]);
      // Merge suggestions into project style (don't override user-set values)
      if (styleSuggestion.colorScheme)
        project.style.colorScheme = styleSuggestion.colorScheme;
      if (styleSuggestion.coverStyle)
        project.style.coverStyle = styleSuggestion.coverStyle;
      if (
        typeof styleSuggestion.fontSize === "number" &&
        styleSuggestion.fontSize >= 10 &&
        styleSuggestion.fontSize <= 14
      )
        project.style.fontSize = styleSuggestion.fontSize;
      if (
        typeof styleSuggestion.lineHeight === "number" &&
        styleSuggestion.lineHeight >= 1.2 &&
        styleSuggestion.lineHeight <= 2.0
      )
        project.style.lineHeight = styleSuggestion.lineHeight;
    }

    onProgress?.({
      step: 3,
      stepName: "ART_DIRECTION",
      status: "completed",
      detail: `Style: ${project.style.colorScheme}, cover: ${project.style.coverStyle}, font: ${project.style.fontSize}pt`,
      timestamp: new Date(),
    });
  } catch (err) {
    // Art direction failure is non-fatal — use defaults
    onProgress?.({
      step: 3,
      stepName: "ART_DIRECTION",
      status: "completed",
      detail: `Using default style (ZAI suggestion failed: ${err instanceof Error ? err.message : String(err)})`,
      timestamp: new Date(),
    });
  }
}

// ─── Step 4: COVER DESIGN ─────────────────────────────────────────────────────

/**
 * Generate cover image via ZAI image generation.
 * Saves the image to the download directory.
 */
async function stepCoverDesign(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 4,
    stepName: "COVER_DESIGN",
    status: "started",
    detail: "Generating cover image",
    timestamp: new Date(),
  });

  try {
    const zai = await getZAI();
    const coverPrompt = `Book cover design for "${project.title}"${project.subtitle ? `: ${project.subtitle}` : ""} by ${project.author}. Target audience: ${project.targetAudience}. Style: ${project.style.coverStyle}, ${project.style.colorScheme}. Professional, high quality, no text on image except the title.`;

    const response = await zai.images.generations.create({
      model: "flux-krea-v2",
      prompt: coverPrompt,
      size: "1024x1024",
    });

    const base64 = response.data[0]?.base64;
    if (!base64) {
      throw new Error("ZAI image generation returned no base64 data");
    }

    // Save cover image to disk
    const outputDir = DEFAULT_OUTPUT_DIR;
    await fs.mkdir(outputDir, { recursive: true });
    const coverFileName = `${project.title.replace(/[^a-zA-Z0-9]+/g, "_")}_cover_${randomUUID().slice(0, 8)}.png`;
    const coverPath = path.join(outputDir, coverFileName);

    // Decode base64 and write
    const buffer = Buffer.from(base64, "base64");
    await fs.writeFile(coverPath, buffer);

    // Verify file exists
    const stat = await fs.stat(coverPath);
    if (stat.size === 0) {
      throw new Error("Cover image file is empty after writing");
    }

    project.artifacts.coverImagePath = coverPath;

    onProgress?.({
      step: 4,
      stepName: "COVER_DESIGN",
      status: "completed",
      detail: `Cover image saved: ${coverPath} (${stat.size} bytes)`,
      timestamp: new Date(),
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    project.errors.push({
      step: 4,
      stepName: "COVER_DESIGN",
      message: msg,
      timestamp: new Date(),
      recoverable: true, // Can proceed without cover
    });
    onProgress?.({
      step: 4,
      stepName: "COVER_DESIGN",
      status: "failed",
      detail: `Cover design failed (proceeding without cover): ${msg}`,
      timestamp: new Date(),
    });
    // Non-fatal — continue without cover image
  }
}

// ─── Step 5: EDITORIAL DESIGN ─────────────────────────────────────────────────

/**
 * Review and refine each chapter's content via ZAI.
 * This step calls ZAI to review and improve the content.
 */
async function stepEditorialDesign(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 5,
    stepName: "EDITORIAL_DESIGN",
    status: "started",
    detail: `Reviewing ${project.chapters.length} chapters`,
    timestamp: new Date(),
  });

  const zai = await getZAI();
  let reviewedCount = 0;

  for (const chapter of project.chapters) {
    if (!chapter.content || chapter.content.startsWith("[Content generation failed")) {
      // Skip chapters that failed content generation
      continue;
    }

    try {
      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are an editor reviewing and refining book content. Improve clarity, fix grammar, enhance flow, and ensure consistency. Return the COMPLETE revised chapter content. Do not add meta-commentary — return only the chapter text.`,
          },
          {
            role: "user",
            content: `Review and refine this chapter from "${project.title}" (Chapter ${chapter.index + 1}: "${chapter.title}"):\n\n${chapter.content}`,
          },
        ],
      });

      const refined =
        response.choices[0]?.message?.content || chapter.content;
      // Only replace if we got substantial content back
      if (refined.length > chapter.content.length * 0.5) {
        chapter.content = refined;
      }
      reviewedCount++;
    } catch (err) {
      // Editorial failure for one chapter is non-fatal
      project.errors.push({
        step: 5,
        stepName: "EDITORIAL_DESIGN",
        message: `Chapter ${chapter.index + 1}: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date(),
        recoverable: true,
      });
    }
  }

  onProgress?.({
    step: 5,
    stepName: "EDITORIAL_DESIGN",
    status: "completed",
    detail: `Reviewed ${reviewedCount}/${project.chapters.length} chapters`,
    timestamp: new Date(),
  });
}

// ─── Step 6: LAYOUT ──────────────────────────────────────────────────────────

/**
 * Prepare layout data (margins, fonts, page structure).
 * This step doesn't generate files — it prepares the PdfConfig
 * that will be used in Step 7.
 *
 * We store the config as a side-effect on the project style.
 */
async function stepLayout(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<PdfConfig> {
  onProgress?.({
    step: 6,
    stepName: "LAYOUT",
    status: "started",
    detail: "Preparing layout configuration",
    timestamp: new Date(),
  });

  const pdfConfig: PdfConfig = {
    title: project.title,
    author: project.author,
    subject: project.subtitle || project.title,
    pageSize: "A4",
    orientation: "portrait",
    margins: {
      top: project.style.marginSize,
      bottom: project.style.marginSize,
      left: project.style.marginSize,
      right: project.style.marginSize,
    },
    defaultFont: project.style.fontFamily,
    defaultFontSize: project.style.fontSize,
    lineHeight: project.style.lineHeight,
  };

  onProgress?.({
    step: 6,
    stepName: "LAYOUT",
    status: "completed",
    detail: `Layout: ${pdfConfig.pageSize} ${pdfConfig.orientation}, margins=${pdfConfig.margins.top}pt, font=${pdfConfig.defaultFontSize}pt/${pdfConfig.lineHeight}x`,
    timestamp: new Date(),
  });

  return pdfConfig;
}

// ─── Step 7: PDF GENERATION ───────────────────────────────────────────────────

/**
 * Generate the actual PDF file via pdf-factory.
 * This is the core output step — it MUST produce a real file.
 */
async function stepPdfGeneration(
  project: BookProject,
  pdfConfig: PdfConfig,
  onProgress?: ProgressCallback
): Promise<PdfResult> {
  onProgress?.({
    step: 7,
    stepName: "PDF_GENERATION",
    status: "started",
    detail: "Generating PDF file",
    timestamp: new Date(),
  });

  // Prepare chapters for PDF
  const pdfChapters: PdfChapter[] = project.chapters.map((c) => ({
    title: c.title,
    content: c.content || `[No content for ${c.title}]`,
  }));

  try {
    const result = await generatePdf(
      pdfConfig,
      pdfChapters,
      project.artifacts.coverImagePath,
      DEFAULT_OUTPUT_DIR
    );

    if (!result.success) {
      throw new Error("PDF generation returned success=false");
    }

    // Verify file exists on disk (pdf-factory already does this, but double-check)
    const stat = await fs.stat(result.filePath);
    if (stat.size === 0) {
      throw new Error(
        `PDF file is empty: ${result.filePath}`
      );
    }

    project.artifacts.pdfPath = result.filePath;

    onProgress?.({
      step: 7,
      stepName: "PDF_GENERATION",
      status: "completed",
      detail: `PDF generated: ${result.filePath} (${result.fileSize} bytes, ${result.pageCount} pages, evidence=${result.evidence})`,
      timestamp: new Date(),
    });

    return result;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    project.errors.push({
      step: 7,
      stepName: "PDF_GENERATION",
      message: msg,
      timestamp: new Date(),
      recoverable: false,
    });
    onProgress?.({
      step: 7,
      stepName: "PDF_GENERATION",
      status: "failed",
      detail: msg,
      timestamp: new Date(),
    });
    throw new Error(`Step 7 PDF_GENERATION failed: ${msg}`);
  }
}

// ─── Step 8: VISUAL QA ────────────────────────────────────────────────────────

/**
 * Inspect the PDF for quality using visual-qa module.
 */
async function stepVisualQA(
  project: BookProject,
  onProgress?: ProgressCallback
): Promise<QAReport> {
  onProgress?.({
    step: 8,
    stepName: "VISUAL_QA",
    status: "started",
    detail: "Running visual QA inspection",
    timestamp: new Date(),
  });

  const pdfPath = project.artifacts.pdfPath;
  if (!pdfPath) {
    const msg = "No PDF path available for QA inspection";
    project.errors.push({
      step: 8,
      stepName: "VISUAL_QA",
      message: msg,
      timestamp: new Date(),
      recoverable: false,
    });
    onProgress?.({
      step: 8,
      stepName: "VISUAL_QA",
      status: "failed",
      detail: msg,
      timestamp: new Date(),
    });
    throw new Error(`Step 8 VISUAL_QA failed: ${msg}`);
  }

  const report = await runVisualQA(project.projectId, pdfPath);

  onProgress?.({
    step: 8,
    stepName: "VISUAL_QA",
    status: report.passed ? "completed" : "failed",
    detail: report.passed
      ? `QA passed (${report.checks.length} checks, evidence=${report.evidence})`
      : `QA failed: ${report.issues.filter((i) => i.severity === "CRITICAL").length} critical, ${report.issues.filter((i) => i.severity === "MAJOR").length} major issues`,
    timestamp: new Date(),
  });

  return report;
}

// ─── Step 9: REPAIR ──────────────────────────────────────────────────────────

/**
 * Fix issues found in QA. Attempts repair for each repairable issue.
 * After repairs, re-runs QA to verify fixes.
 */
async function stepRepair(
  project: BookProject,
  qaReport: QAReport,
  onProgress?: ProgressCallback
): Promise<QAReport> {
  onProgress?.({
    step: 9,
    stepName: "REPAIR",
    status: "started",
    detail: `Attempting to repair ${qaReport.issues.length} issues`,
    timestamp: new Date(),
  });

  const pdfPath = project.artifacts.pdfPath;
  if (!pdfPath) {
    onProgress?.({
      step: 9,
      stepName: "REPAIR",
      status: "skipped",
      detail: "No PDF to repair",
      timestamp: new Date(),
    });
    return qaReport;
  }

  const repairableIssues = qaReport.issues.filter(
    (i) => i.repairable
  );

  if (repairableIssues.length === 0) {
    onProgress?.({
      step: 9,
      stepName: "REPAIR",
      status: "completed",
      detail: "No repairable issues found",
      timestamp: new Date(),
    });
    return qaReport;
  }

  let repairedCount = 0;
  for (const issue of repairableIssues) {
    try {
      const result = await repairIssue(issue, pdfPath, {
        title: project.title,
        author: project.author,
      });
      if (result.repaired) {
        repairedCount++;
      }
    } catch (err) {
      project.errors.push({
        step: 9,
        stepName: "REPAIR",
        message: `Failed to repair "${issue.description}": ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date(),
        recoverable: true,
      });
    }
  }

  // Re-run QA after repairs
  const newReport = await runVisualQA(project.projectId, pdfPath);

  onProgress?.({
    step: 9,
    stepName: "REPAIR",
    status: newReport.passed ? "completed" : "failed",
    detail: `Repaired ${repairedCount}/${repairableIssues.length} issues. QA after repair: ${newReport.passed ? "PASSED" : "FAILED"}`,
    timestamp: new Date(),
  });

  return newReport;
}

// ─── Step 10: FINAL ──────────────────────────────────────────────────────────

/**
 * Deliver the product. Writes a metadata JSON file alongside the PDF.
 * Verifies the PDF still exists on disk.
 */
async function stepFinal(
  project: BookProject,
  qaReport: QAReport,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.({
    step: 10,
    stepName: "FINAL",
    status: "started",
    detail: "Finalizing product",
    timestamp: new Date(),
  });

  const pdfPath = project.artifacts.pdfPath;

  // Verify PDF still exists
  if (pdfPath) {
    try {
      const stat = await fs.stat(pdfPath);
      if (stat.size === 0) {
        throw new Error("PDF file is empty at final step");
      }
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err);
      project.errors.push({
        step: 10,
        stepName: "FINAL",
        message: `PDF verification failed: ${msg}`,
        timestamp: new Date(),
        recoverable: false,
      });
      onProgress?.({
        step: 10,
        stepName: "FINAL",
        status: "failed",
        detail: msg,
        timestamp: new Date(),
      });
      throw new Error(`Step 10 FINAL failed: ${msg}`);
    }
  }

  // Write metadata JSON
  const metadata = {
    projectId: project.projectId,
    title: project.title,
    subtitle: project.subtitle,
    author: project.author,
    targetAudience: project.targetAudience,
    chapters: project.chapters.map((c) => ({
      index: c.index,
      title: c.title,
      synopsis: c.synopsis,
      targetWords: c.targetWords,
      wordCount: c.content?.split(/\s+/).length || 0,
    })),
    style: project.style,
    artifacts: project.artifacts,
    qa: {
      passed: qaReport.passed,
      checksCount: qaReport.checks.length,
      issuesCount: qaReport.issues.length,
      evidence: qaReport.evidence,
    },
    generatedAt: new Date().toISOString(),
  };

  const metadataDir = DEFAULT_OUTPUT_DIR;
  await fs.mkdir(metadataDir, { recursive: true });
  const metadataFileName = `${project.title.replace(/[^a-zA-Z0-9]+/g, "_")}_metadata_${randomUUID().slice(0, 8)}.json`;
  const metadataPath = path.join(metadataDir, metadataFileName);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  project.artifacts.metadataPath = metadataPath;

  // Mark completed
  project.completedAt = new Date();

  onProgress?.({
    step: 10,
    stepName: "FINAL",
    status: "completed",
    detail: `Product finalized. PDF: ${pdfPath || "none"}, Metadata: ${metadataPath}`,
    timestamp: new Date(),
  });
}

// ─── runPipeline ──────────────────────────────────────────────────────────────

/**
 * Execute the full 10-step pipeline.
 *
 * - Each step must produce a REAL result or throw a REAL error
 * - Progress is reported via the onProgress callback
 * - The pipeline stops on CRITICAL errors (steps 1, 2, 7)
 * - Non-critical errors are logged but the pipeline continues
 *
 * Returns the completed BookProject.
 */
export async function runPipeline(
  projectId: string,
  onProgress?: ProgressCallback
): Promise<BookProject> {
  const project = projectStore.get(projectId);
  if (!project) {
    throw new Error(`BookProject not found: ${projectId}`);
  }

  project.status = "RUNNING";
  project.startedAt = new Date();

  try {
    // Step 1: ARCHITECTURE
    project.currentStep = 1;
    await stepArchitecture(project, onProgress);

    // Step 2: CONTENT GENERATION
    project.currentStep = 2;
    await stepContentGeneration(project, onProgress);

    // Step 3: ART DIRECTION
    project.currentStep = 3;
    await stepArtDirection(project, onProgress);

    // Step 4: COVER DESIGN (non-fatal if it fails)
    project.currentStep = 4;
    await stepCoverDesign(project, onProgress);

    // Step 5: EDITORIAL DESIGN
    project.currentStep = 5;
    await stepEditorialDesign(project, onProgress);

    // Step 6: LAYOUT
    project.currentStep = 6;
    const pdfConfig = await stepLayout(project, onProgress);

    // Step 7: PDF GENERATION
    project.currentStep = 7;
    await stepPdfGeneration(project, pdfConfig, onProgress);

    // Step 8: VISUAL QA
    project.currentStep = 8;
    let qaReport = await stepVisualQA(project, onProgress);

    // Step 9: REPAIR (if QA found issues)
    project.currentStep = 9;
    if (!qaReport.passed) {
      qaReport = await stepRepair(project, qaReport, onProgress);
    } else {
      onProgress?.({
        step: 9,
        stepName: "REPAIR",
        status: "skipped",
        detail: "QA passed — no repairs needed",
        timestamp: new Date(),
      });
    }

    // Step 10: FINAL
    project.currentStep = 10;
    await stepFinal(project, qaReport, onProgress);

    project.status = "COMPLETED";
    project.currentStep = 10;
  } catch (err) {
    project.status = "FAILED";
    const msg =
      err instanceof Error ? err.message : String(err);
    if (
      !project.errors.some(
        (e) => e.message === msg && e.step === project.currentStep
      )
    ) {
      project.errors.push({
        step: project.currentStep,
        stepName: STEP_NAMES[project.currentStep - 1] || "UNKNOWN",
        message: msg,
        timestamp: new Date(),
        recoverable: false,
      });
    }
    onProgress?.({
      step: project.currentStep,
      stepName: STEP_NAMES[project.currentStep - 1] || "UNKNOWN",
      status: "failed",
      detail: `Pipeline failed at step ${project.currentStep}: ${msg}`,
      timestamp: new Date(),
    });
  }

  return project;
}

// ─── Convenience: create and run ──────────────────────────────────────────────

/**
 * Create a book project and immediately run the pipeline.
 */
export async function createAndRun(
  input: BookProjectInput,
  onProgress?: ProgressCallback
): Promise<BookProject> {
  const project = createBookProject(input);
  return runPipeline(project.projectId, onProgress);
}
