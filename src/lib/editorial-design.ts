/**
 * Editorial Design & Layout — KREA Book Factory Layer
 *
 * Defines the complete editorial specification (margins, grid, typography,
 * hierarchy rules) and produces deterministic, reproducible layouts.
 *
 * Satisfies:
 *   AC-038 — EditorialSpecification with margins, grid, hierarchy_rules,
 *            heading_styles, paragraph_style, quote_style, list_style,
 *            table_style, image_style, caption_style, chapter_style,
 *            page_break_rules, numbering, index_config
 *   AC-039 — Layout must be deterministic/reproducible
 *   AC-040 — Same visual system throughout (derived from ArtDirection)
 */

import { randomUUID } from "crypto";
import type {
  ArtDirectionSpec,
  BookArchitectureInput,
} from "./art-direction";

// ─── Margins ───────────────────────────────────────────────────────────

export interface Margins {
  top: number;      // in points
  bottom: number;
  inner: number;    // gutter side
  outer: number;    // edge side
}

// ─── Grid ──────────────────────────────────────────────────────────────

export interface GridSpec {
  columns: number;
  column_gap: number;  // in points
  row_gap: number;
  baseline_grid: number; // baseline grid increment in points
  /** Whether to use asymmetric margins for bound books */
  asymmetric_margins: boolean;
}

// ─── Style Specifications ──────────────────────────────────────────────

export interface HeadingStyleRule {
  level: number;
  font: string;
  size: number;
  weight: number;
  color: string;
  line_height: number;
  space_before: number;
  space_after: number;
  keep_with_next: boolean;
  /** Numbering format (e.g., "chapter" for "Chapter 1") */
  numbering_format: "none" | "chapter" | "section" | "decimal" | "custom";
  /** Custom numbering prefix (e.g., "Part") */
  numbering_prefix: string;
}

export interface ParagraphStyle {
  font: string;
  size: number;
  weight: number;
  color: string;
  line_height: number;
  first_line_indent: number;
  space_before: number;
  space_after: number;
  alignment: "left" | "justify" | "center" | "right";
  hyphenation: boolean;
  orphans_min: number;
  widows_min: number;
}

export interface QuoteStyle {
  font: string;
  size: number;
  weight: number;
  color: string;
  line_height: number;
  left_margin: number;
  right_margin: number;
  space_before: number;
  space_after: number;
  border_left_width: number;
  border_left_color: string;
  /** Whether to include a quote mark */
  include_mark: boolean;
  mark_font: string;
  mark_size: number;
  mark_color: string;
}

export interface ListStyle {
  font: string;
  size: number;
  weight: number;
  color: string;
  line_height: number;
  bullet_style: "disc" | "circle" | "square" | "dash" | "custom";
  indent: number;
  space_between_items: number;
  /** For ordered lists */
  numbering_style: "decimal" | "alpha" | "roman" | "none";
}

export interface TableStyle {
  header_font: string;
  header_size: number;
  header_weight: number;
  header_bg_color: string;
  header_text_color: string;
  body_font: string;
  body_size: number;
  body_weight: number;
  border_width: number;
  border_color: string;
  cell_padding: number;
  stripe_bg_color: string;
}

export interface ImageStyle {
  max_width_percent: number;
  alignment: "left" | "center" | "right";
  space_before: number;
  space_after: number;
  border_radius: number;
}

export interface CaptionStyle {
  font: string;
  size: number;
  weight: number;
  color: string;
  alignment: "left" | "center" | "right";
  space_before: number;
  space_after: number;
  /** Format string for caption numbering (e.g., "Figure {n}") */
  numbering_format: string;
}

export interface ChapterStyle {
  /** Whether chapter opens on a new page */
  page_break_before: boolean;
  /** Whether chapter opening uses a drop cap */
  drop_cap: boolean;
  drop_cap_lines: number;
  /** Chapter title formatting */
  title_style: HeadingStyleRule;
  /** Epigraph/quote before chapter content */
  epigraph: boolean;
  epigraph_style: QuoteStyle;
  /** Chapter number display */
  show_chapter_number: boolean;
  chapter_number_format: "Chapter {n}" | "{n}." | "Part {n}" | "custom";
  /** Decorative element on chapter opening page */
  opening_decoration: "none" | "rule" | "ornament" | "custom";
}

// ─── Page Break Rules ──────────────────────────────────────────────────

export interface PageBreakRule {
  element: string;
  /** When to break: "always" | "avoid" | "auto" | "left" | "right" */
  break_before: "always" | "avoid" | "auto" | "left" | "right";
  break_after: "always" | "avoid" | "auto" | "left" | "right";
  /** Minimum content that must remain on a page before a break */
  keep_together_min?: number;
}

// ─── Numbering ─────────────────────────────────────────────────────────

export interface NumberingConfig {
  /** Page numbering style */
  pages: "arabic" | "roman" | "none";
  /** Where page numbers appear */
  page_number_position: "header-center" | "header-right" | "footer-center" | "footer-right" | "none";
  /** First page number (for front matter) */
  first_page_number: number;
  /** Whether to restart numbering at each chapter */
  restart_at_chapter: boolean;
  /** Figure numbering scheme */
  figures: "chapter-relative" | "continuous" | "none";
  /** Table numbering scheme */
  tables: "chapter-relative" | "continuous" | "none";
}

// ─── Index Configuration ───────────────────────────────────────────────

export interface IndexConfig {
  /** Whether to generate an index */
  generate: boolean;
  /** Index depth (1 = main entries, 2 = sub-entries) */
  depth: number;
  /** Whether to include page ranges (e.g., "23-27") */
  include_ranges: boolean;
  /** Alphabet separator style */
  alphabet_headers: boolean;
  /** Column count for index */
  columns: number;
}

// ─── Hierarchy Rules ───────────────────────────────────────────────────

export interface HierarchyRule {
  from_level: number;
  to_level: number;
  /** Whether child levels must appear under parent in TOC */
  requires_parent: boolean;
  /** Minimum nesting depth */
  min_depth: number;
  /** Maximum nesting depth */
  max_depth: number;
}

// ─── Editorial Specification (AC-038) ──────────────────────────────────

/**
 * Complete editorial specification produced by EditorialDesign.
 *
 * AC-038: margins, grid, hierarchy_rules, heading_styles,
 *   paragraph_style, quote_style, list_style, table_style,
 *   image_style, caption_style, chapter_style,
 *   page_break_rules, numbering, index_config
 */
export interface EditorialSpecification {
  /** Unique specification ID */
  id: string;
  /** Timestamp of creation */
  createdAt: string;
  /** ID of the ArtDirectionSpec this derives from (AC-040) */
  visual_system_id: string;

  /** Page margins */
  margins: Margins;
  /** Grid system */
  grid: GridSpec;
  /** Hierarchy nesting rules */
  hierarchy_rules: HierarchyRule[];

  /** Heading styles for each level */
  heading_styles: HeadingStyleRule[];
  /** Body paragraph style */
  paragraph_style: ParagraphStyle;
  /** Blockquote style */
  quote_style: QuoteStyle;
  /** List style */
  list_style: ListStyle;
  /** Table style */
  table_style: TableStyle;
  /** Image style */
  image_style: ImageStyle;
  /** Caption style */
  caption_style: CaptionStyle;
  /** Chapter opening style */
  chapter_style: ChapterStyle;

  /** Page break rules */
  page_break_rules: PageBreakRule[];
  /** Numbering configuration */
  numbering: NumberingConfig;
  /** Index configuration */
  index_config: IndexConfig;
}

// ─── Layout Content Types ──────────────────────────────────────────────

export interface ChapterContent {
  chapter_number: number;
  title: string;
  sections: SectionContent[];
  /** Estimated word count */
  word_count: number;
}

export interface SectionContent {
  heading?: string;
  level: number;
  paragraphs: string[];
  quotes?: { text: string; attribution?: string }[];
  lists?: { ordered: boolean; items: string[] }[];
  images?: { src: string; caption?: string; alt: string }[];
  tables?: { headers: string[]; rows: string[][]; caption?: string }[];
}

export interface BookContent {
  title: string;
  subtitle: string;
  author: string;
  chapters: ChapterContent[];
  total_word_count: number;
}

// ─── Layout Element ────────────────────────────────────────────────────

export interface LayoutElement {
  type: "heading" | "paragraph" | "quote" | "list" | "image" | "table" | "caption" | "page_break" | "decoration" | "drop_cap";
  /** Absolute page number this element starts on (0-indexed) */
  page: number;
  /** Y position on the page in points from top */
  y: number;
  /** X position in points from left margin */
  x: number;
  /** Width of the element in points */
  width: number;
  /** Height of the element in points */
  height: number;
  /** Content reference (index into source content) */
  content_ref: string;
  /** Style properties applied */
  style: Record<string, unknown>;
}

// ─── Layout Page ───────────────────────────────────────────────────────

export interface LayoutPage {
  page_number: number;
  /** Whether this is a chapter-opening page */
  is_chapter_opening: boolean;
  chapter_number: number | null;
  /** All elements on this page, in reading order */
  elements: LayoutElement[];
  /** Remaining vertical space in points */
  remaining_space: number;
  /** Page header text */
  header_text: string | null;
  /** Page footer text */
  footer_text: string | null;
}

// ─── Layout Result (AC-039) ────────────────────────────────────────────

/**
 * Deterministic layout result produced by EditorialDesign.layout().
 *
 * AC-039: Layout must be deterministic/reproducible.
 * Same input always produces same output.
 */
export interface LayoutResult {
  /** Unique layout ID */
  id: string;
  /** Timestamp */
  createdAt: string;
  /** Hash of inputs for deterministic verification (AC-039) */
  input_hash: string;
  /** Total page count */
  page_count: number;
  /** All pages in order */
  pages: LayoutPage[];
  /** Table of contents entries */
  table_of_contents: { title: string; page: number; level: number }[];
  /** Visual system ID this layout adheres to (AC-040) */
  visual_system_id: string;
}

// ─── EditorialDesign Class ─────────────────────────────────────────────

/**
 * EditorialDesign — produces editorial specifications and deterministic layouts.
 *
 * Two main operations:
 * 1. design() — produces the EditorialSpecification (AC-038)
 * 2. layout() — produces a deterministic LayoutResult (AC-039)
 *
 * Both operations derive from the same ArtDirectionSpec, ensuring
 * visual system coherence throughout (AC-040).
 */
export class EditorialDesign {
  /**
   * Produce the editorial specification from art direction and book structure.
   *
   * @param artDirection - The visual system specification
   * @param bookArchitecture - The book's editorial structure
   * @returns Complete EditorialSpecification (AC-038)
   */
  design(
    artDirection: ArtDirectionSpec,
    bookArchitecture: BookArchitectureInput
  ): EditorialSpecification {
    const margins = this.computeMargins(artDirection);
    const grid = this.buildGrid(artDirection);
    const headingStyles = this.buildHeadingStyles(artDirection);
    const paragraphStyle = this.buildParagraphStyle(artDirection);
    const quoteStyle = this.buildQuoteStyle(artDirection);
    const listStyle = this.buildListStyle(artDirection);
    const tableStyle = this.buildTableStyle(artDirection);
    const imageStyle = this.buildImageStyle(artDirection);
    const captionStyle = this.buildCaptionStyle(artDirection);
    const chapterStyle = this.buildChapterStyle(artDirection, headingStyles[0]);
    const pageBreakRules = this.buildPageBreakRules();
    const numbering = this.buildNumberingConfig();
    const indexConfig = this.buildIndexConfig(bookArchitecture);
    const hierarchyRules = this.buildHierarchyRules();

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      visual_system_id: artDirection.visual_system.id,
      margins,
      grid,
      hierarchy_rules: hierarchyRules,
      heading_styles: headingStyles,
      paragraph_style: paragraphStyle,
      quote_style: quoteStyle,
      list_style: listStyle,
      table_style: tableStyle,
      image_style: imageStyle,
      caption_style: captionStyle,
      chapter_style: chapterStyle,
      page_break_rules: pageBreakRules,
      numbering,
      index_config: indexConfig,
    };
  }

  /**
   * Produce a deterministic layout from content and specifications.
   *
   * AC-039: Layout is deterministic — same inputs always produce same output.
   * This is achieved by processing content sequentially with fixed rules,
   * no randomization, and a deterministic page-breaking algorithm.
   *
   * @param content - The book content to lay out
   * @param editorial - The editorial specification
   * @param artDirection - The visual system (AC-040)
   * @returns Deterministic LayoutResult (AC-039)
   */
  layout(
    content: BookContent,
    editorial: EditorialSpecification,
    artDirection: ArtDirectionSpec
  ): LayoutResult {
    const inputHash = this.computeInputHash(content, editorial);
    const { width } = artDirection.visual_system.page_dimensions;
    const contentWidth = width - editorial.margins.inner - editorial.margins.outer;
    const contentHeight = artDirection.visual_system.page_dimensions.height
      - editorial.margins.top
      - editorial.margins.bottom;

    const pages: LayoutPage[] = [];
    const toc: LayoutResult["table_of_contents"] = [];

    let currentPage = 0;
    let currentY = 0;
    let currentChapter: number | null = null;
    let currentPageElements: LayoutElement[] = [];
    let remainingSpace = contentHeight;

    // Process each chapter
    for (const chapter of content.chapters) {
      // Chapter opening — always starts new page
      if (currentPage > 0 || currentPageElements.length > 0) {
        // Finalize previous page
        pages.push(this.finalizePage(
          currentPage,
          currentChapter,
          currentPageElements,
          remainingSpace,
          editorial
        ));
        currentPage++;
        currentPageElements = [];
        currentY = 0;
        remainingSpace = contentHeight;
      }

      currentChapter = chapter.chapter_number;

      // Chapter heading
      const chHeadingHeight = this.estimateElementHeight(
        "heading",
        chapter.title,
        editorial.chapter_style.title_style,
        contentWidth
      );

      toc.push({
        title: chapter.title,
        page: currentPage + 1, // 1-indexed for display
        level: 1,
      });

      currentPageElements.push({
        type: "heading",
        page: currentPage,
        y: currentY,
        x: editorial.margins.inner,
        width: contentWidth,
        height: chHeadingHeight,
        content_ref: `chapter-${chapter.chapter_number}-title`,
        style: { ...editorial.chapter_style.title_style },
      });

      currentY += chHeadingHeight;
      remainingSpace -= chHeadingHeight;

      // Process sections
      for (const section of chapter.sections) {
        // Section heading
        if (section.heading) {
          const headingStyle = editorial.heading_styles.find(
            (h) => h.level === section.level
          ) ?? editorial.heading_styles[editorial.heading_styles.length - 1];

          const headingHeight = this.estimateElementHeight(
            "heading",
            section.heading,
            headingStyle,
            contentWidth
          );

          if (headingHeight > remainingSpace) {
            pages.push(this.finalizePage(
              currentPage, currentChapter, currentPageElements, remainingSpace, editorial
            ));
            currentPage++;
            currentPageElements = [];
            currentY = 0;
            remainingSpace = contentHeight;
          }

          toc.push({
            title: section.heading,
            page: currentPage + 1,
            level: section.level,
          });

          currentPageElements.push({
            type: "heading",
            page: currentPage,
            y: currentY,
            x: editorial.margins.inner,
            width: contentWidth,
            height: headingHeight,
            content_ref: `chapter-${chapter.chapter_number}-section-${section.level}`,
            style: { ...headingStyle },
          });

          currentY += headingHeight;
          remainingSpace -= headingHeight;
        }

        // Paragraphs
        for (let pi = 0; pi < section.paragraphs.length; pi++) {
          const para = section.paragraphs[pi];
          const paraHeight = this.estimateElementHeight(
            "paragraph",
            para,
            editorial.paragraph_style,
            contentWidth
          );

          if (paraHeight > remainingSpace) {
            pages.push(this.finalizePage(
              currentPage, currentChapter, currentPageElements, remainingSpace, editorial
            ));
            currentPage++;
            currentPageElements = [];
            currentY = 0;
            remainingSpace = contentHeight;
          }

          currentPageElements.push({
            type: "paragraph",
            page: currentPage,
            y: currentY,
            x: editorial.margins.inner,
            width: contentWidth,
            height: Math.min(paraHeight, remainingSpace),
            content_ref: `chapter-${chapter.chapter_number}-para-${pi}`,
            style: { ...editorial.paragraph_style },
          });

          currentY += paraHeight;
          remainingSpace -= paraHeight;
        }
      }
    }

    // Finalize last page
    if (currentPageElements.length > 0) {
      pages.push(this.finalizePage(
        currentPage, currentChapter, currentPageElements, remainingSpace, editorial
      ));
    }

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      input_hash: inputHash,
      page_count: pages.length,
      pages,
      table_of_contents: toc,
      visual_system_id: artDirection.visual_system.id,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Compute margins based on visual system and page size.
   */
  private computeMargins(artDirection: ArtDirectionSpec): Margins {
    const base = artDirection.visual_system.base_unit;
    // Traditional book margins: inner < outer (for gutter), top < bottom
    return {
      top: base * 7,    // 56pt
      bottom: base * 9, // 72pt
      inner: base * 6,  // 48pt (gutter)
      outer: base * 8,  // 64pt
    };
  }

  /**
   * Build grid specification.
   */
  private buildGrid(artDirection: ArtDirectionSpec): GridSpec {
    return {
      columns: 1, // Single column for most books
      column_gap: 0,
      row_gap: artDirection.visual_system.base_unit,
      baseline_grid: artDirection.typography.sizes.base * artDirection.typography.line_heights.normal,
      asymmetric_margins: true,
    };
  }

  /**
   * Build heading styles from art direction hierarchy.
   */
  private buildHeadingStyles(artDirection: ArtDirectionSpec): HeadingStyleRule[] {
    const h = artDirection.hierarchy;
    const t = artDirection.typography;

    return [
      {
        level: 1, font: h.h1.font, size: h.h1.size, weight: h.h1.weight,
        color: h.h1.color, line_height: h.h1.line_height,
        space_before: h.h1.margin_top, space_after: h.h1.margin_bottom,
        keep_with_next: true, numbering_format: "chapter", numbering_prefix: "Chapter",
      },
      {
        level: 2, font: h.h2.font, size: h.h2.size, weight: h.h2.weight,
        color: h.h2.color, line_height: h.h2.line_height,
        space_before: h.h2.margin_top, space_after: h.h2.margin_bottom,
        keep_with_next: true, numbering_format: "none", numbering_prefix: "",
      },
      {
        level: 3, font: h.h3.font, size: h.h3.size, weight: h.h3.weight,
        color: h.h3.color, line_height: h.h3.line_height,
        space_before: h.h3.margin_top, space_after: h.h3.margin_bottom,
        keep_with_next: true, numbering_format: "none", numbering_prefix: "",
      },
      {
        level: 4, font: h.h4.font, size: h.h4.size, weight: h.h4.weight,
        color: h.h4.color, line_height: h.h4.line_height,
        space_before: h.h4.margin_top, space_after: h.h4.margin_bottom,
        keep_with_next: true, numbering_format: "none", numbering_prefix: "",
      },
      {
        level: 5, font: h.h5.font, size: h.h5.size, weight: h.h5.weight,
        color: h.h5.color, line_height: h.h5.line_height,
        space_before: h.h5.margin_top, space_after: h.h5.margin_bottom,
        keep_with_next: false, numbering_format: "none", numbering_prefix: "",
      },
      {
        level: 6, font: h.h6.font, size: h.h6.size, weight: h.h6.weight,
        color: h.h6.color, line_height: h.h6.line_height,
        space_before: h.h6.margin_top, space_after: h.h6.margin_bottom,
        keep_with_next: false, numbering_format: "none", numbering_prefix: "",
      },
    ];
  }

  /**
   * Build paragraph style from art direction.
   */
  private buildParagraphStyle(artDirection: ArtDirectionSpec): ParagraphStyle {
    return {
      font: artDirection.typography.body_font,
      size: artDirection.typography.sizes.base,
      weight: artDirection.typography.weights.normal,
      color: artDirection.palette.text.hex,
      line_height: artDirection.typography.line_heights.normal,
      first_line_indent: 18, // Standard first-line indent
      space_before: 0,
      space_after: artDirection.visual_system.base_unit,
      alignment: "justify",
      hyphenation: true,
      orphans_min: 2,
      widows_min: 2,
    };
  }

  /**
   * Build quote style from art direction.
   */
  private buildQuoteStyle(artDirection: ArtDirectionSpec): QuoteStyle {
    return {
      font: artDirection.typography.body_font,
      size: artDirection.typography.sizes.lg,
      weight: artDirection.typography.weights.normal,
      color: artDirection.palette.secondary.hex,
      line_height: artDirection.typography.line_heights.relaxed,
      left_margin: 36,
      right_margin: 36,
      space_before: 18,
      space_after: 18,
      border_left_width: 3,
      border_left_color: artDirection.palette.accent.hex,
      include_mark: true,
      mark_font: artDirection.typography.heading_font,
      mark_size: 48,
      mark_color: artDirection.palette.accent.hex,
    };
  }

  /**
   * Build list style from art direction.
   */
  private buildListStyle(artDirection: ArtDirectionSpec): ListStyle {
    return {
      font: artDirection.typography.body_font,
      size: artDirection.typography.sizes.base,
      weight: artDirection.typography.weights.normal,
      color: artDirection.palette.text.hex,
      line_height: artDirection.typography.line_heights.normal,
      bullet_style: "disc",
      indent: 24,
      space_between_items: 6,
      numbering_style: "decimal",
    };
  }

  /**
   * Build table style from art direction.
   */
  private buildTableStyle(artDirection: ArtDirectionSpec): TableStyle {
    return {
      header_font: artDirection.typography.body_font,
      header_size: artDirection.typography.sizes.sm,
      header_weight: artDirection.typography.weights.semibold,
      header_bg_color: artDirection.palette.primary.hex,
      header_text_color: artDirection.palette.background.hex,
      body_font: artDirection.typography.body_font,
      body_size: artDirection.typography.sizes.sm,
      body_weight: artDirection.typography.weights.normal,
      border_width: 1,
      border_color: artDirection.palette.secondary.hex,
      cell_padding: 6,
      stripe_bg_color: "#f5f5f5",
    };
  }

  /**
   * Build image style from art direction.
   */
  private buildImageStyle(artDirection: ArtDirectionSpec): ImageStyle {
    return {
      max_width_percent: artDirection.image_treatment.max_width_percent,
      alignment: "center",
      space_before: 18,
      space_after: 12,
      border_radius: artDirection.image_treatment.border_radius,
    };
  }

  /**
   * Build caption style from art direction.
   */
  private buildCaptionStyle(artDirection: ArtDirectionSpec): CaptionStyle {
    return {
      font: artDirection.typography.body_font,
      size: artDirection.typography.sizes.sm,
      weight: artDirection.typography.weights.normal,
      color: artDirection.palette.secondary.hex,
      alignment: "center",
      space_before: 4,
      space_after: 18,
      numbering_format: "Figure {n}",
    };
  }

  /**
   * Build chapter opening style.
   */
  private buildChapterStyle(
    artDirection: ArtDirectionSpec,
    h1Style: HeadingStyleRule
  ): ChapterStyle {
    return {
      page_break_before: true,
      drop_cap: true,
      drop_cap_lines: 3,
      title_style: h1Style,
      epigraph: false,
      epigraph_style: this.buildQuoteStyle(artDirection),
      show_chapter_number: true,
      chapter_number_format: "Chapter {n}",
      opening_decoration: "rule",
    };
  }

  /**
   * Build page break rules.
   */
  private buildPageBreakRules(): PageBreakRule[] {
    return [
      { element: "chapter", break_before: "always", break_after: "avoid" },
      { element: "h1", break_before: "always", break_after: "avoid", keep_together_min: 3 },
      { element: "h2", break_before: "auto", break_after: "avoid", keep_together_min: 2 },
      { element: "h3", break_before: "auto", break_after: "avoid" },
      { element: "table", break_before: "avoid", break_after: "avoid", keep_together_min: 2 },
      { element: "image", break_before: "avoid", break_after: "avoid" },
      { element: "blockquote", break_before: "avoid", break_after: "avoid" },
    ];
  }

  /**
   * Build numbering configuration.
   */
  private buildNumberingConfig(): NumberingConfig {
    return {
      pages: "arabic",
      page_number_position: "footer-center",
      first_page_number: 1,
      restart_at_chapter: false,
      figures: "chapter-relative",
      tables: "chapter-relative",
    };
  }

  /**
   * Build index configuration.
   */
  private buildIndexConfig(bookArchitecture: BookArchitectureInput): IndexConfig {
    return {
      generate: bookArchitecture.chapterCount > 5,
      depth: bookArchitecture.chapterCount > 10 ? 2 : 1,
      include_ranges: true,
      alphabet_headers: true,
      columns: 2,
    };
  }

  /**
   * Build hierarchy nesting rules.
   */
  private buildHierarchyRules(): HierarchyRule[] {
    return [
      { from_level: 1, to_level: 2, requires_parent: false, min_depth: 1, max_depth: 4 },
      { from_level: 2, to_level: 3, requires_parent: true, min_depth: 2, max_depth: 4 },
      { from_level: 3, to_level: 4, requires_parent: true, min_depth: 3, max_depth: 4 },
    ];
  }

  /**
   * Estimate the height of a layout element in points.
   * Used by the deterministic layout algorithm.
   */
  private estimateElementHeight(
    type: "heading" | "paragraph",
    text: string,
    style: { size: number; line_height: number; space_before?: number; space_after?: number },
    contentWidth: number
  ): number {
    // Estimate characters per line based on font size and width
    const charsPerLine = Math.floor(contentWidth / (style.size * 0.5));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    const lineHeight = style.size * style.line_height;
    const height = lines * lineHeight;

    const spaceBefore = ("space_before" in style && typeof style.space_before === "number")
      ? style.space_before : 0;
    const spaceAfter = ("space_after" in style && typeof style.space_after === "number")
      ? style.space_after : 0;

    return height + spaceBefore + spaceAfter;
  }

  /**
   * Finalize a page with header/footer.
   */
  private finalizePage(
    pageNum: number,
    chapterNum: number | null,
    elements: LayoutElement[],
    remainingSpace: number,
    editorial: EditorialSpecification
  ): LayoutPage {
    const headerText = chapterNum ? `Chapter ${chapterNum}` : null;
    let footerText: string | null = null;

    if (editorial.numbering.page_number_position.startsWith("footer")) {
      footerText = String(pageNum + editorial.numbering.first_page_number);
    }

    return {
      page_number: pageNum,
      is_chapter_opening: elements.some((e) => e.type === "heading" && e.content_ref.includes("title")),
      chapter_number: chapterNum,
      elements,
      remaining_space: remainingSpace,
      header_text: headerText,
      footer_text: footerText,
    };
  }

  /**
   * Compute a deterministic hash of layout inputs for reproducibility check.
   * AC-039: Same inputs → same hash → same layout.
   */
  private computeInputHash(
    content: BookContent,
    editorial: EditorialSpecification
  ): string {
    // Simple deterministic hash — concatenate key inputs and hash
    const data = JSON.stringify({
      title: content.title,
      chapterCount: content.chapters.length,
      totalWords: content.total_word_count,
      editorialId: editorial.id,
      margins: editorial.margins,
      grid: editorial.grid,
    });

    // Simple hash function (djb2)
    let hash = 5381;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) + hash + data.charCodeAt(i)) & 0xffffffff;
    }
    return hash.toString(16).padStart(8, "0");
  }
}
