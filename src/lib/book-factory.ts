/**
 * Book Factory — KREA Book Factory Layer
 *
 * Orchestrates the full eBook production pipeline from opportunity to verified artifact.
 * Each step produces evidence and is fully traceable.
 *
 * Satisfies:
 *   AC-029 — Full pipeline: bookArchitecture → content → artDirection →
 *            coverDesign → editorialDesign → layout → pdf → visualQA →
 *            repair → finalProduct
 *   AC-032 — No copying literal content from references; model principles only
 *   AC-045 — Repair loop: DETECT → DIAGNOSE → REPAIR → RENDER → VERIFY
 *            (max 5 iterations)
 *
 * Uses ZAI SDK for content generation (the ONLY module that imports ZAI).
 * Uses ArtDirection, CoverDesign, EditorialDesign, PDFFactory, VisualQA
 * for the respective pipeline steps.
 * Uses MemoryManager and ExecutionTracer for traceability.
 */

import ZAI from "z-ai-web-dev-sdk";
import { randomUUID } from "crypto";
import { ArtDirection } from "./art-direction";
import type { ArtDirectionSpec, ArchitectureInput, BookArchitectureInput } from "./art-direction";
import { CoverDesign } from "./cover-design";
import type { CoverSpecification } from "./cover-design";
import { EditorialDesign } from "./editorial-design";
import type {
  EditorialSpecification,
  LayoutResult,
  BookContent,
  ChapterContent,
  SectionContent,
} from "./editorial-design";
import { PDFFactory } from "./pdf-factory";
import type { PDFResult, PDFVerification, PDFGenerationOptions, VerificationStatus } from "./pdf-factory";
import { VisualQA } from "./visual-qa";
import type { QAResult, Diagnosis, RepairedContent } from "./visual-qa";
import { MemoryManager } from "./memory";
import { ExecutionTracer } from "./execution";

// ─── Pipeline Step Evidence ─────────────────────────────────────────────

export interface PipelineStepEvidence {
  step: string;
  step_number: number;
  started_at: string;
  completed_at: string;
  duration_ms: number;
  success: boolean;
  output_id: string;
  error?: string;
}

// ─── Pipeline State ────────────────────────────────────────────────────

export interface PipelineState {
  /** Current step in the pipeline */
  current_step: string;
  /** Completed steps with evidence */
  steps: PipelineStepEvidence[];
  /** Whether the pipeline is in repair mode */
  in_repair: boolean;
  /** Current repair iteration (0 = no repair, 1-5 = repair loop) */
  repair_iteration: number;
  /** Maximum repair iterations (AC-045: max 5) */
  max_repair_iterations: number;
}

// ─── Opportunity (input to BookFactory) ─────────────────────────────────

export interface Opportunity {
  /** Topic/subject of the book */
  topic: string;
  /** Target audience */
  targetAudience: string;
  /** Genre/category */
  genre: string;
  /** Desired chapter count */
  chapterCount: number;
  /** Author name */
  author: string;
  /** Purpose of the book (e.g., "generate leads", "educate", "build authority") */
  purpose: string;
  /** Tone of the content (e.g., "professional", "conversational") */
  tone: string;
  /** Optional subtitle override */
  subtitle?: string;
  /** User ID for tracing */
  userId?: string;
}

// ─── Architecture (input to BookFactory) ───────────────────────────────

export interface Architecture {
  /** Product format */
  format: "ebook" | "guide" | "template" | "report";
  /** Complexity level */
  complexity: "simple" | "moderate" | "complex";
  /** Target market */
  targetMarket: string;
}

// ─── Book Product (final output) ───────────────────────────────────────

export interface BookProduct {
  /** Whether production was successful */
  success: boolean;
  /** Book title */
  title: string;
  /** Book subtitle */
  subtitle: string;
  /** Author name */
  author: string;
  /** The complete content */
  content: BookContent;
  /** Art direction specification */
  art_direction: ArtDirectionSpec;
  /** Cover specification */
  cover: CoverSpecification;
  /** Editorial specification */
  editorial: EditorialSpecification;
  /** Layout result */
  layout: LayoutResult;
  /** PDF result */
  pdf: PDFResult;
  /** PDF verification */
  pdf_verification: PDFVerification;
  /** QA result */
  qa_result: QAResult;
  /** Pipeline state with evidence */
  pipeline: PipelineState;
  /** Total production time in ms */
  production_time_ms: number;
  /** Number of repair iterations used */
  repair_iterations_used: number;
  /** Any errors */
  errors: string[];
}

// ─── Content Generation Options ─────────────────────────────────────────

export interface ContentGenerationOptions {
  /** Words per chapter (approximate) */
  words_per_chapter: number;
  /** Include introduction chapter */
  include_introduction: boolean;
  /** Include conclusion chapter */
  include_conclusion: boolean;
  /** Language for content generation */
  language: string;
}

// ─── BookFactory Class ─────────────────────────────────────────────────

/**
 * BookFactory — orchestrates the full eBook production pipeline.
 *
 * Pipeline (AC-029):
 *   1. bookArchitecture — define editorial structure
 *   2. content — generate chapter content with ZAI
 *   3. artDirection — define visual system
 *   4. coverDesign — specify cover
 *   5. editorialDesign — margins, grid, typography, hierarchy
 *   6. layout — produce deterministic layout
 *   7. pdf — generate PDF artifact
 *   8. visualQA — inspect result
 *   9. repair — fix issues if found (AC-045: max 5 iterations)
 *   10. finalProduct — verified artifact
 *
 * Each step produces evidence and is traceable via ExecutionTracer.
 */
export class BookFactory {
  private artDirection = new ArtDirection();
  private coverDesign = new CoverDesign();
  private editorialDesign = new EditorialDesign();
  private pdfFactory = new PDFFactory();
  private visualQA = new VisualQA();
  private memory = new MemoryManager();
  private tracer = new ExecutionTracer();

  /**
   * Produce a complete book product from an opportunity and architecture.
   *
   * @param opportunity - The book opportunity/topic
   * @param architecture - The product architecture
   * @returns BookProduct — the verified book artifact
   */
  async produce(
    opportunity: Opportunity,
    architecture: Architecture
  ): Promise<BookProduct> {
    const startTime = Date.now();
    const errors: string[] = [];
    const pipelineSteps: PipelineStepEvidence[] = [];

    const pipelineState: PipelineState = {
      current_step: "init",
      steps: pipelineSteps,
      in_repair: false,
      repair_iteration: 0,
      max_repair_iterations: 5,
    };

    // Start execution trace
    const executionId = await this.tracer.start("book-factory-produce", {
      agentId: "krea",
      userId: opportunity.userId,
      inputs: { topic: opportunity.topic, genre: opportunity.genre },
      skillsUsed: ["book-factory"],
    });

    // Mutable state for repair loop
    let bookArchitecture: BookArchitectureInput | null = null;
    let content: BookContent | null = null;
    let artDir: ArtDirectionSpec | null = null;
    let cover: CoverSpecification | null = null;
    let editorial: EditorialSpecification | null = null;
    let layout: LayoutResult | null = null;
    let pdfResult: PDFResult | null = null;
    let qaResult: QAResult | null = null;
    let pdfVerification: PDFVerification | null = null;

    try {
      // ─── Step 1: Book Architecture ────────────────────────────────
      pipelineState.current_step = "bookArchitecture";
      bookArchitecture = await this.runStep(
        "bookArchitecture", 1, pipelineSteps, executionId,
        () => this.defineBookArchitecture(opportunity)
      );

      // ─── Step 2: Content Generation ───────────────────────────────
      pipelineState.current_step = "content";
      content = await this.runStep(
        "content", 2, pipelineSteps, executionId,
        () => this.generateContent(opportunity, bookArchitecture!, executionId)
      );

      // ─── Step 3: Art Direction ────────────────────────────────────
      pipelineState.current_step = "artDirection";
      const archInput: ArchitectureInput = {
        productType: "book",
        format: architecture.format,
        complexity: architecture.complexity,
        targetMarket: architecture.targetMarket,
      };
      artDir = await this.runStep(
        "artDirection", 3, pipelineSteps, executionId,
        () => Promise.resolve(this.artDirection.define(archInput, bookArchitecture!))
      );

      // ─── Step 4: Cover Design ─────────────────────────────────────
      pipelineState.current_step = "coverDesign";
      cover = await this.runStep(
        "coverDesign", 4, pipelineSteps, executionId,
        () => Promise.resolve(this.coverDesign.design(artDir!, bookArchitecture!))
      );

      // ─── Step 5: Editorial Design ────────────────────────────────
      pipelineState.current_step = "editorialDesign";
      editorial = await this.runStep(
        "editorialDesign", 5, pipelineSteps, executionId,
        () => Promise.resolve(this.editorialDesign.design(artDir!, bookArchitecture!))
      );

      // ─── Step 6: Layout ──────────────────────────────────────────
      pipelineState.current_step = "layout";
      layout = await this.runStep(
        "layout", 6, pipelineSteps, executionId,
        () => Promise.resolve(this.editorialDesign.layout(content!, editorial!, artDir!))
      );

      // ─── Step 7: PDF Generation ──────────────────────────────────
      pipelineState.current_step = "pdf";
      pdfResult = await this.runStep(
        "pdf", 7, pipelineSteps, executionId,
        () => Promise.resolve(this.pdfFactory.generatePDF(
          layout!, content!, cover!, editorial!, artDir!
        ))
      );

      // ─── Step 8: Visual QA ──────────────────────────────────────
      pipelineState.current_step = "visualQA";
      qaResult = await this.runStep(
        "visualQA", 8, pipelineSteps, executionId,
        () => Promise.resolve(this.visualQA.inspect(
          { page_count: pdfResult!.pageCount, layout: layout!, content: content! },
          content!,
          editorial!
        ))
      );

      // ─── Step 9: Repair Loop (AC-045) ──────────────────────────
      if (!qaResult.passed) {
        pipelineState.in_repair = true;
        const repairResult = await this.executeRepairLoop(
          qaResult, content, editorial, artDir, layout, cover,
          pipelineState, pipelineSteps, executionId
        );
        content = repairResult.content;
        editorial = repairResult.editorial;
        layout = repairResult.layout;
        cover = repairResult.cover;
        qaResult = repairResult.qaResult;

        // Re-generate PDF after repair
        pdfResult = this.pdfFactory.generatePDF(
          layout, content, cover, editorial, artDir
        );
      }

      // ─── Step 10: Final Verification ───────────────────────────
      pipelineState.current_step = "finalProduct";
      pdfVerification = this.pdfFactory.verify(
        pdfResult,
        layout.page_count,
        qaResult
      );

      // Record step
      pipelineSteps.push({
        step: "finalProduct",
        step_number: 10,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 0,
        success: pdfVerification.overall === true,
        output_id: randomUUID(),
      });

      // Store in memory for future reference
      await this.storeProductMemory(opportunity, content, executionId);

      // Mark execution as succeeded
      await this.tracer.succeed(executionId, {
        pageCount: layout.page_count,
        qaPassed: qaResult.passed,
        pdfVerified: pdfVerification.overall === true,
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      await this.tracer.addError(executionId, message);
      await this.tracer.fail(executionId, { message });
    }

    return {
      success: pdfVerification?.overall === true,
      title: bookArchitecture?.title ?? opportunity.topic,
      subtitle: bookArchitecture?.subtitle ?? "",
      author: opportunity.author,
      content: content ?? { title: "", subtitle: "", author: "", chapters: [], total_word_count: 0 },
      art_direction: artDir ?? {} as ArtDirectionSpec,
      cover: cover ?? {} as CoverSpecification,
      editorial: editorial ?? {} as EditorialSpecification,
      layout: layout ?? { id: "", createdAt: "", input_hash: "", page_count: 0, pages: [], table_of_contents: [], visual_system_id: "" },
      pdf: pdfResult ?? { success: false, filePath: null, fileName: "", pageCount: 0, sizeBytes: 0, checksum: "", generatedAt: "", spec: {} as PDFResult["spec"], errors: [] },
      pdf_verification: pdfVerification ?? {} as PDFVerification,
      qa_result: qaResult ?? { passed: false, issue_count: 0, issues: [], by_category: {} as QAResult["by_category"], by_severity: {} as QAResult["by_severity"], inspectedAt: "", inspection_duration_ms: 0 },
      pipeline: pipelineState,
      production_time_ms: Date.now() - startTime,
      repair_iterations_used: pipelineState.repair_iteration,
      errors,
    };
  }

  // ─── Pipeline Steps ───────────────────────────────────────────────

  /**
   * Step 1: Define the book's editorial architecture.
   * Derives structure from the opportunity (topic, audience, genre, etc.)
   */
  private async defineBookArchitecture(
    opportunity: Opportunity
  ): Promise<BookArchitectureInput> {
    // Generate chapter titles using ZAI
    const chapterTitles = await this.generateChapterTitles(opportunity);

    return {
      title: opportunity.topic,
      subtitle: opportunity.subtitle ?? `A comprehensive guide for ${opportunity.targetAudience}`,
      author: opportunity.author,
      genre: opportunity.genre,
      audience: opportunity.targetAudience,
      chapterCount: opportunity.chapterCount,
      chapterTitles,
      tone: opportunity.tone,
      purpose: opportunity.purpose,
    };
  }

  /**
   * Step 2: Generate chapter content using ZAI SDK.
   *
   * AC-032: Model principles and structure only — no literal copying.
   * The ZAI generates original content based on the topic and structure.
   */
  private async generateContent(
    opportunity: Opportunity,
    bookArchitecture: BookArchitectureInput,
    executionId: string
  ): Promise<BookContent> {
    const zai = await ZAI.create();
    const chapters: ChapterContent[] = [];

    for (let i = 0; i < bookArchitecture.chapterCount; i++) {
      const chapterTitle = bookArchitecture.chapterTitles[i] ?? `Chapter ${i + 1}`;

      const prompt = `Write a comprehensive, original chapter titled "${chapterTitle}" for a book about "${opportunity.topic}".

Target audience: ${opportunity.targetAudience}
Genre: ${opportunity.genre}
Tone: ${opportunity.tone}
Purpose: ${opportunity.purpose}

Requirements:
- Write ORIGINAL content that models principles and structure (AC-032)
- Include 3-5 major sections with subheadings
- Each section should have 2-3 substantial paragraphs
- Include practical insights the reader can apply
- Use clear, engaging language appropriate for the audience
- Do NOT copy or closely paraphrase existing sources

Format the response as JSON with this structure:
{
  "sections": [
    {
      "heading": "Section Title",
      "level": 2,
      "paragraphs": ["paragraph 1 text...", "paragraph 2 text..."]
    }
  ]
}`;

      try {
        const response = await zai.chat.completions.create({
          messages: [
            {
              role: "system",
              content: `You are a professional author writing original book content. You model principles and structure without copying literal content from references. You write in ${opportunity.tone} tone for ${opportunity.targetAudience}. Always respond with valid JSON.`,
            },
            { role: "user", content: prompt },
          ],
        });

        const rawContent = response.choices[0]?.message?.content ?? "{}";

        // Parse the generated content
        let sections: SectionContent[];
        try {
          // Extract JSON from the response (may be wrapped in markdown code blocks)
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          const parsed = JSON.parse(jsonMatch?.[0] ?? "{}");
          sections = Array.isArray(parsed.sections)
            ? parsed.sections.map((s: Record<string, unknown>) => ({
                heading: String(s.heading ?? ""),
                level: Number(s.level ?? 2),
                paragraphs: Array.isArray(s.paragraphs)
                  ? s.paragraphs.map((p: unknown) => String(p))
                  : [],
              }))
            : [];
        } catch {
          // Fallback: treat entire response as a single section
          sections = [{
            heading: chapterTitle,
            level: 2,
            paragraphs: [rawContent],
          }];
        }

        const wordCount = sections.reduce(
          (sum, s) => sum + s.paragraphs.reduce((ps, p) => ps + p.split(/\s+/).length, 0),
          0
        );

        chapters.push({
          chapter_number: i + 1,
          title: chapterTitle,
          sections,
          word_count: wordCount,
        });

        await this.tracer.addTool(executionId, "zai-chat-completions");
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        await this.tracer.addError(executionId, `Chapter ${i + 1} generation failed: ${msg}`);

        // Add placeholder chapter on failure
        chapters.push({
          chapter_number: i + 1,
          title: chapterTitle,
          sections: [{
            heading: chapterTitle,
            level: 2,
            paragraphs: [`Content for ${chapterTitle} will be regenerated.`],
          }],
          word_count: 10,
        });
      }
    }

    const totalWordCount = chapters.reduce((sum, ch) => sum + ch.word_count, 0);

    return {
      title: bookArchitecture.title,
      subtitle: bookArchitecture.subtitle,
      author: bookArchitecture.author,
      chapters,
      total_word_count: totalWordCount,
    };
  }

  /**
   * Generate chapter titles using ZAI.
   */
  private async generateChapterTitles(
    opportunity: Opportunity
  ): Promise<string[]> {
    try {
      const zai = await ZAI.create();

      const response = await zai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a book architect. Generate compelling, original chapter titles. Respond with a JSON array of strings only.",
          },
          {
            role: "user",
            content: `Generate ${opportunity.chapterCount} chapter titles for a book about "${opportunity.topic}" for ${opportunity.targetAudience}. The tone should be ${opportunity.tone}. Each title should be concise (2-6 words) and descriptive. Return as JSON array: ["Title 1", "Title 2", ...]`,
          },
        ],
      });

      const raw = response.choices[0]?.message?.content ?? "[]";
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? "[]");

      if (Array.isArray(parsed) && parsed.length >= opportunity.chapterCount) {
        return parsed.slice(0, opportunity.chapterCount).map(String);
      }

      // Fallback if ZAI returned wrong number of titles
      return this.generateFallbackTitles(opportunity);
    } catch {
      return this.generateFallbackTitles(opportunity);
    }
  }

  /**
   * Fallback chapter titles when ZAI is unavailable.
   */
  private generateFallbackTitles(opportunity: Opportunity): string[] {
    const titles: string[] = [];
    for (let i = 1; i <= opportunity.chapterCount; i++) {
      titles.push(`Chapter ${i}: ${opportunity.topic} — Part ${i}`);
    }
    return titles;
  }

  // ─── Repair Loop (AC-045) ─────────────────────────────────────────

  /**
   * Execute the repair loop: DETECT → DIAGNOSE → REPAIR → RENDER → VERIFY
   *
   * AC-045: Maximum 5 iterations. Each iteration:
   *   1. DETECT — issues already detected in qaResult
   *   2. DIAGNOSE — determine root causes
   *   3. REPAIR — apply fixes
   *   4. RENDER — re-layout and re-render
   *   5. VERIFY — re-inspect
   */
  private async executeRepairLoop(
    qaResult: QAResult,
    content: BookContent,
    editorial: EditorialSpecification,
    artDir: ArtDirectionSpec,
    layout: LayoutResult,
    cover: CoverSpecification,
    pipelineState: PipelineState,
    pipelineSteps: PipelineStepEvidence[],
    executionId: string
  ): Promise<{
    content: BookContent;
    editorial: EditorialSpecification;
    layout: LayoutResult;
    cover: CoverSpecification;
    qaResult: QAResult;
  }> {
    let currentContent = content;
    let currentEditorial = editorial;
    let currentLayout = layout;
    let currentCover = cover;
    let currentQA = qaResult;

    // Only repair critical and auto-repairable issues
    const repairableIssues = currentQA.issues.filter(
      (i) => i.severity === "critical" && i.auto_repairable
    );

    if (repairableIssues.length === 0) {
      // No auto-repairable issues — skip repair
      return {
        content: currentContent,
        editorial: currentEditorial,
        layout: currentLayout,
        cover: currentCover,
        qaResult: currentQA,
      };
    }

    for (let iteration = 1; iteration <= pipelineState.max_repair_iterations; iteration++) {
      pipelineState.repair_iteration = iteration;
      pipelineState.current_step = `repair-${iteration}`;

      const iterStart = Date.now();

      // ── DETECT (already done) ──────────────────────────────────────
      const criticalIssues = currentQA.issues.filter(
        (i) => i.severity === "critical" && i.auto_repairable
      );

      if (criticalIssues.length === 0) {
        // All critical issues resolved
        break;
      }

      // ── DIAGNOSE ───────────────────────────────────────────────────
      const diagnoses = this.visualQA.diagnose(criticalIssues);

      // ── REPAIR ─────────────────────────────────────────────────────
      for (const diagnosis of diagnoses) {
        const issue = criticalIssues.find((i) => i.id === diagnosis.issue_id);
        if (!issue) continue;

        const repairResult: RepairedContent = this.visualQA.repair(
          issue, currentContent, currentEditorial
        );

        if (repairResult.repaired) {
          if (repairResult.updated_content) {
            currentContent = repairResult.updated_content;
          }
          if (repairResult.updated_editorial) {
            currentEditorial = repairResult.updated_editorial;
          }
        }

        await this.tracer.addEvidence(executionId, {
          repair_iteration: iteration,
          issue_id: issue.id,
          repair_strategy: diagnosis.repair_strategy,
          repaired: repairResult.repaired,
        });
      }

      // ── RENDER ─────────────────────────────────────────────────────
      currentLayout = this.editorialDesign.layout(
        currentContent, currentEditorial, artDir
      );

      // ── VERIFY ─────────────────────────────────────────────────────
      currentQA = this.visualQA.inspect(
        { page_count: currentLayout.page_count, layout: currentLayout, content: currentContent },
        currentContent,
        currentEditorial
      );

      // Record step evidence
      pipelineSteps.push({
        step: `repair-${iteration}`,
        step_number: 9,
        started_at: new Date(iterStart).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - iterStart,
        success: currentQA.passed,
        output_id: randomUUID(),
      });

      // If QA now passes, exit repair loop
      if (currentQA.passed) {
        break;
      }
    }

    return {
      content: currentContent,
      editorial: currentEditorial,
      layout: currentLayout,
      cover: currentCover,
      qaResult: currentQA,
    };
  }

  // ─── Utility Methods ──────────────────────────────────────────────

  /**
   * Run a single pipeline step with timing and error handling.
   */
  private async runStep<T>(
    stepName: string,
    stepNumber: number,
    pipelineSteps: PipelineStepEvidence[],
    executionId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      pipelineSteps.push({
        step: stepName,
        step_number: stepNumber,
        started_at: new Date(start).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        success: true,
        output_id: randomUUID(),
      });
      await this.tracer.addSkill(executionId, `book-factory-${stepName}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pipelineSteps.push({
        step: stepName,
        step_number: stepNumber,
        started_at: new Date(start).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - start,
        success: false,
        output_id: randomUUID(),
        error: message,
      });
      await this.tracer.addError(executionId, `${stepName}: ${message}`);
      throw error;
    }
  }

  /**
   * Store the produced book in memory for future reference.
   */
  private async storeProductMemory(
    opportunity: Opportunity,
    content: BookContent,
    executionId: string
  ): Promise<void> {
    try {
      await this.memory.store("krea", "book-production", "EPISODIC", {
        topic: opportunity.topic,
        genre: opportunity.genre,
        audience: opportunity.targetAudience,
        chapterCount: content.chapters.length,
        totalWordCount: content.total_word_count,
        executionId,
      }, {
        source: "book-factory",
        sourceType: "AGENT",
        confidence: 0.9,
        truthLevel: "OBSERVED",
        scope: "agent",
      });
    } catch {
      // Memory storage failure is non-critical
    }
  }
}
