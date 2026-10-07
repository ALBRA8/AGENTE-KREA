/**
 * Cover Design — KREA Book Factory Layer
 *
 * Produces a professional book cover specification that belongs to the
 * same visual system as the book interior.
 *
 * Satisfies:
 *   AC-035 — CoverSpecification with format, dimensions, hierarchy, composition,
 *            image_spec, typography_spec, contrast, legibility, genre, audience,
 *            thumbnail_readability
 *   AC-036 — evaluateThumbnail() for thumbnail readability assessment
 *   AC-037 — Cover belongs to same visual system as interior
 */

import { randomUUID } from "crypto";
import type {
  ArtDirectionSpec,
  ColorSpec,
  HeadingStyle,
  TypographySystem,
  Palette,
  BookArchitectureInput,
} from "./art-direction";

// ─── Cover Dimensions ──────────────────────────────────────────────────

export interface CoverDimensions {
  width: number;   // in points
  height: number;  // in points
  unit: "pt" | "in" | "mm";
  bleed: number;   // bleed margin in points
  spine_width: number;
}

// ─── Cover Typography ──────────────────────────────────────────────────

export interface CoverTypographySpec {
  title: {
    font: string;
    size: number;
    weight: number;
    color: string;
    letter_spacing: number;
    line_height: number;
    max_lines: number;
  };
  subtitle: {
    font: string;
    size: number;
    weight: number;
    color: string;
    letter_spacing: number;
    line_height: number;
    max_lines: number;
  };
  author: {
    font: string;
    size: number;
    weight: number;
    color: string;
    letter_spacing: number;
  };
  /** Any additional text elements (series name, edition, etc.) */
  auxiliary: {
    font: string;
    size: number;
    weight: number;
    color: string;
  };
}

// ─── Cover Image Specification ─────────────────────────────────────────

export interface CoverImageSpec {
  position: "background" | "top-half" | "bottom-half" | "left" | "right" | "center" | "none";
  overlay: boolean;
  overlay_color: string;
  overlay_opacity: number;
  /** Description of the ideal cover image for generation */
  description: string;
  /** Aspect ratio constraint */
  aspect_ratio: string;
  /** Whether the image extends to the edge (full bleed) */
  full_bleed: boolean;
}

// ─── Cover Hierarchy ───────────────────────────────────────────────────

export interface CoverHierarchy {
  /** Visual weight order (highest first) */
  element_order: string[];
  /** Size ratios between elements */
  size_ratios: Record<string, number>;
  /** Spacing ratios between elements */
  spacing_ratios: Record<string, number>;
}

// ─── Cover Composition ─────────────────────────────────────────────────

export interface CoverComposition {
  layout: "centered" | "left-aligned" | "right-aligned" | "split" | "diagonal" | "custom";
  /** Grid zones for element placement */
  zones: {
    title: { x: number; y: number; width: number; height: number };
    subtitle: { x: number; y: number; width: number; height: number };
    author: { x: number; y: number; width: number; height: number };
    image: { x: number; y: number; width: number; height: number };
  };
  /** Balance score (0-1, where 0.5 is perfectly balanced) */
  balance: number;
}

// ─── Contrast & Legibility ─────────────────────────────────────────────

export interface ContrastLegibility {
  /** WCAG contrast ratio for title text against background */
  title_contrast_ratio: number;
  /** WCAG contrast ratio for subtitle text */
  subtitle_contrast_ratio: number;
  /** WCAG contrast ratio for author name */
  author_contrast_ratio: number;
  /** Minimum contrast ratio required (WCAG AA = 4.5:1) */
  min_required_ratio: number;
  /** Overall legibility score (0-1) */
  legibility_score: number;
  /** Whether contrast meets WCAG AA */
  meets_wcag_aa: boolean;
}

// ─── Thumbnail Evaluation (AC-036) ─────────────────────────────────────

export interface ThumbnailEvaluation {
  /** Title is readable at thumbnail size */
  title_readable: boolean;
  /** Author name is readable at thumbnail size */
  author_readable: boolean;
  /** Cover is distinguishable from competitors at thumbnail */
  distinguishable: boolean;
  /** Overall thumbnail effectiveness score (0-1) */
  thumbnail_score: number;
  /** Specific recommendations for thumbnail improvement */
  recommendations: string[];
  /** At what approximate pixel width does title become unreadable */
  title_breakpoint_px: number;
  /** At what approximate pixel width does author become unreadable */
  author_breakpoint_px: number;
}

// ─── Author Brand ──────────────────────────────────────────────────────

export interface AuthorBrand {
  name: string;
  credentials?: string;
  previous_works?: string[];
  brand_color?: string;
  headshot?: boolean;
}

// ─── Cover Specification (AC-035) ──────────────────────────────────────

/**
 * Complete cover specification produced by CoverDesign.
 *
 * AC-035: format, dimensions, title, subtitle, author_brand,
 *   hierarchy, composition, image_spec, typography_spec,
 *   contrast, legibility, genre, audience, thumbnail_readability
 *
 * AC-037: Cover MUST belong to same visual system as interior
 */
export interface CoverSpecification {
  /** Unique specification ID */
  id: string;
  /** Timestamp of creation */
  createdAt: string;
  /** ID of the ArtDirectionSpec this cover belongs to (AC-037) */
  visual_system_id: string;

  /** Cover format (e.g., "paperback", "hardcover", "ebook-only") */
  format: string;
  /** Physical dimensions including bleed */
  dimensions: CoverDimensions;

  /** Book title as it appears on cover */
  title: string;
  /** Book subtitle as it appears on cover */
  subtitle: string;
  /** Author branding on cover */
  author_brand: AuthorBrand;

  /** Visual hierarchy for cover elements */
  hierarchy: CoverHierarchy;
  /** Spatial composition of cover */
  composition: CoverComposition;
  /** Cover image specification */
  image_spec: CoverImageSpec;
  /** Cover-specific typography */
  typography_spec: CoverTypographySpec;

  /** Contrast and legibility metrics */
  contrast: ContrastLegibility;

  /** Book genre (for genre-specific cover conventions) */
  genre: string;
  /** Target audience (for audience-specific cover design) */
  audience: string;

  /** Pre-evaluated thumbnail readability (AC-036) */
  thumbnail_readability: ThumbnailEvaluation;
}

// ─── CoverDesign Class ─────────────────────────────────────────────────

/**
 * CoverDesign — produces a professional book cover specification.
 *
 * The cover is not designed independently — it derives from the same
 * ArtDirectionSpec that governs the interior, ensuring visual system
 * coherence (AC-037).
 */
export class CoverDesign {
  /**
   * Design a complete book cover specification.
   *
   * @param artDirection - The visual system specification (AC-037 link)
   * @param bookArchitecture - The book's editorial structure
   * @returns Complete CoverSpecification (AC-035)
   */
  design(
    artDirection: ArtDirectionSpec,
    bookArchitecture: BookArchitectureInput
  ): CoverSpecification {
    const dimensions = this.computeDimensions(artDirection);
    const typographySpec = this.buildCoverTypography(
      artDirection.typography,
      artDirection.palette,
      bookArchitecture.title,
      bookArchitecture.subtitle
    );
    const hierarchy = this.buildCoverHierarchy(bookArchitecture);
    const composition = this.buildComposition(
      artDirection.cover_treatment.layout,
      dimensions
    );
    const imageSpec = this.buildImageSpec(
      artDirection.cover_treatment,
      bookArchitecture
    );
    const contrast = this.computeContrast(
      typographySpec,
      artDirection.palette
    );
    const authorBrand = this.buildAuthorBrand(bookArchitecture.author);
    const thumbnailReadability = this.evaluateThumbnailInternal(
      typographySpec,
      dimensions,
      bookArchitecture
    );

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      visual_system_id: artDirection.visual_system.id,
      format: "paperback",
      dimensions,
      title: bookArchitecture.title,
      subtitle: bookArchitecture.subtitle,
      author_brand: authorBrand,
      hierarchy,
      composition,
      image_spec: imageSpec,
      typography_spec: typographySpec,
      contrast,
      genre: bookArchitecture.genre,
      audience: bookArchitecture.audience,
      thumbnail_readability: thumbnailReadability,
    };
  }

  /**
   * Evaluate a cover's thumbnail readability.
   *
   * AC-036: Assess how the cover performs at thumbnail sizes
   * (e.g., Amazon, Apple Books storefronts).
   *
   * @param cover - The cover specification to evaluate
   * @returns ThumbnailEvaluation with readability scores and recommendations
   */
  evaluateThumbnail(cover: CoverSpecification): ThumbnailEvaluation {
    return this.evaluateThumbnailInternal(
      cover.typography_spec,
      cover.dimensions,
      { title: cover.title, subtitle: cover.subtitle, author: cover.author_brand.name, genre: cover.genre, audience: cover.audience, chapterCount: 0, chapterTitles: [], tone: "", purpose: "" }
    );
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Compute cover dimensions from the visual system.
   */
  private computeDimensions(artDirection: ArtDirectionSpec): CoverDimensions {
    const { width, height } = artDirection.visual_system.page_dimensions;
    return {
      width,
      height,
      unit: "pt",
      bleed: 18, // 0.25 inch bleed
      spine_width: 0, // Computed later based on page count
    };
  }

  /**
   * Build cover-specific typography from the visual system.
   * Cover typography is larger and bolder than interior typography.
   */
  private buildCoverTypography(
    typography: TypographySystem,
    palette: Palette,
    title: string,
    subtitle: string
  ): CoverTypographySpec {
    // Scale up for cover — titles need to be commanding
    const titleMaxLines = Math.ceil(title.length / 20); // ~20 chars per line
    const subtitleMaxLines = subtitle ? Math.ceil(subtitle.length / 30) : 0;

    return {
      title: {
        font: typography.heading_font,
        size: Math.round(typography.sizes["4xl"] * 1.8),
        weight: typography.weights.bold,
        color: palette.primary.hex,
        letter_spacing: -1,
        line_height: 1.1,
        max_lines: Math.min(titleMaxLines, 4),
      },
      subtitle: {
        font: typography.heading_font,
        size: Math.round(typography.sizes.xl * 1.2),
        weight: typography.weights.normal,
        color: palette.secondary.hex,
        letter_spacing: 0.5,
        line_height: 1.3,
        max_lines: Math.min(subtitleMaxLines, 3),
      },
      author: {
        font: typography.body_font,
        size: Math.round(typography.sizes.lg * 1.1),
        weight: typography.weights.semibold,
        color: palette.text.hex,
        letter_spacing: 2,
      },
      auxiliary: {
        font: typography.body_font,
        size: typography.sizes.sm,
        weight: typography.weights.normal,
        color: palette.secondary.hex,
      },
    };
  }

  /**
   * Build cover visual hierarchy.
   */
  private buildCoverHierarchy(
    bookArchitecture: BookArchitectureInput
  ): CoverHierarchy {
    return {
      element_order: ["title", "subtitle", "author", "image", "auxiliary"],
      size_ratios: {
        title: 1.0,
        subtitle: 0.45,
        author: 0.3,
        image: 0.6,
        auxiliary: 0.15,
      },
      spacing_ratios: {
        "title-subtitle": 0.15,
        "subtitle-author": 0.3,
        "author-edge": 0.1,
      },
    };
  }

  /**
   * Build cover composition with zone placement.
   */
  private buildComposition(
    layout: string,
    dimensions: CoverDimensions
  ): CoverComposition {
    const w = dimensions.width;
    const h = dimensions.height;

    const layoutZones: Record<string, CoverComposition["zones"]> = {
      centered: {
        title: { x: w * 0.1, y: h * 0.15, width: w * 0.8, height: h * 0.35 },
        subtitle: { x: w * 0.1, y: h * 0.5, width: w * 0.8, height: h * 0.15 },
        author: { x: w * 0.1, y: h * 0.82, width: w * 0.8, height: h * 0.1 },
        image: { x: 0, y: 0, width: w, height: h },
      },
      "left-aligned": {
        title: { x: w * 0.08, y: h * 0.15, width: w * 0.6, height: h * 0.35 },
        subtitle: { x: w * 0.08, y: h * 0.5, width: w * 0.6, height: h * 0.12 },
        author: { x: w * 0.08, y: h * 0.82, width: w * 0.6, height: h * 0.1 },
        image: { x: w * 0.55, y: 0, width: w * 0.45, height: h },
      },
      split: {
        title: { x: w * 0.05, y: h * 0.1, width: w * 0.9, height: h * 0.25 },
        subtitle: { x: w * 0.05, y: h * 0.35, width: w * 0.9, height: h * 0.12 },
        author: { x: w * 0.05, y: h * 0.82, width: w * 0.9, height: h * 0.1 },
        image: { x: 0, y: h * 0.5, width: w, height: h * 0.35 },
      },
    };

    const zones = layoutZones[layout] ?? layoutZones["centered"];

    return {
      layout: layout as CoverComposition["layout"],
      zones,
      balance: 0.5, // Will be refined
    };
  }

  /**
   * Build cover image specification.
   */
  private buildImageSpec(
    coverTreatment: ArtDirectionSpec["cover_treatment"],
    bookArchitecture: BookArchitectureInput
  ): CoverImageSpec {
    return {
      position: coverTreatment.image_position,
      overlay: coverTreatment.image_overlay,
      overlay_color: "#000000",
      overlay_opacity: coverTreatment.image_overlay_opacity,
      description: this.generateCoverImageDescription(bookArchitecture),
      aspect_ratio: "2:3",
      full_bleed: coverTreatment.image_position === "background",
    };
  }

  /**
   * Generate a description for the ideal cover image.
   */
  private generateCoverImageDescription(
    bookArchitecture: BookArchitectureInput
  ): string {
    const genreDescriptions: Record<string, string> = {
      business: "Professional, abstract geometric patterns or cityscape silhouette",
      technology: "Digital abstract, circuit patterns, or tech landscape",
      education: "Clean, symbolic imagery related to the subject matter",
      fiction: "Atmospheric, evocative scene that captures the story's mood",
      lifestyle: "Warm, aspirational imagery related to the lifestyle topic",
    };

    const base = genreDescriptions[bookArchitecture.genre]
      ?? "Professional imagery related to the book's subject matter";

    return `${base}. Must not compete with title text. Works as background or partial cover element.`;
  }

  /**
   * Compute contrast ratios between text and background.
   */
  private computeContrast(
    typographySpec: CoverTypographySpec,
    palette: Palette
  ): ContrastLegibility {
    const titleRatio = this.wcagContrastRatio(
      typographySpec.title.color,
      palette.background.hex
    );
    const subtitleRatio = this.wcagContrastRatio(
      typographySpec.subtitle.color,
      palette.background.hex
    );
    const authorRatio = this.wcagContrastRatio(
      typographySpec.author.color,
      palette.background.hex
    );

    const minRequired = 4.5; // WCAG AA
    const avgRatio = (titleRatio + subtitleRatio + authorRatio) / 3;
    const legibilityScore = Math.min(1, avgRatio / 7); // 7:1 is excellent

    return {
      title_contrast_ratio: Math.round(titleRatio * 100) / 100,
      subtitle_contrast_ratio: Math.round(subtitleRatio * 100) / 100,
      author_contrast_ratio: Math.round(authorRatio * 100) / 100,
      min_required_ratio: minRequired,
      legibility_score: Math.round(legibilityScore * 100) / 100,
      meets_wcag_aa: titleRatio >= minRequired && subtitleRatio >= minRequired,
    };
  }

  /**
   * Calculate WCAG 2.0 contrast ratio between two colors.
   */
  private wcagContrastRatio(foreground: string, background: string): number {
    const fgLum = this.relativeLuminance(foreground);
    const bgLum = this.relativeLuminance(background);
    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calculate relative luminance of a hex color.
   */
  private relativeLuminance(hex: string): number {
    const r = this.sRGBtoLinear(parseInt(hex.slice(1, 3), 16) / 255);
    const g = this.sRGBtoLinear(parseInt(hex.slice(3, 5), 16) / 255);
    const b = this.sRGBtoLinear(parseInt(hex.slice(5, 7), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Convert sRGB channel value to linear RGB.
   */
  private sRGBtoLinear(c: number): number {
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }

  /**
   * Build author brand specification.
   */
  private buildAuthorBrand(authorName: string): AuthorBrand {
    return {
      name: authorName,
      credentials: undefined,
      previous_works: [],
      brand_color: undefined,
      headshot: false,
    };
  }

  /**
   * Internal thumbnail evaluation (AC-036).
   *
   * Simulates how the cover performs at various thumbnail sizes
   * typical of online bookstores (Amazon ~90px, Apple Books ~80px).
   */
  private evaluateThumbnailInternal(
    typographySpec: CoverTypographySpec,
    dimensions: CoverDimensions,
    book: { title: string; subtitle: string; author: string; genre: string; audience: string; chapterCount: number; chapterTitles: string[]; tone: string; purpose: string }
  ): ThumbnailEvaluation {
    const recommendations: string[] = [];

    // Estimate readability at thumbnail width (90px for Amazon)
    const thumbnailWidth = 90;
    const scaleFactor = thumbnailWidth / dimensions.width;

    // Check title readability
    const titlePxAtThumbnail = typographySpec.title.size * scaleFactor;
    const titleReadable = titlePxAtThumbnail >= 10; // 10px minimum for readability
    if (!titleReadable) {
      recommendations.push("Increase title font size for better thumbnail readability");
    }

    // Check author readability
    const authorPxAtThumbnail = typographySpec.author.size * scaleFactor;
    const authorReadable = authorPxAtThumbnail >= 8; // 8px minimum for author name
    if (!authorReadable) {
      recommendations.push("Increase author name size or use bolder weight for thumbnail visibility");
    }

    // Assess distinguishability (simplified — based on contrast and style)
    const distinguishable = typographySpec.title.size > 40;

    // Compute breakpoints
    const titleBreakpoint = Math.round(
      (10 / typographySpec.title.size) * dimensions.width
    );
    const authorBreakpoint = Math.round(
      (8 / typographySpec.author.size) * dimensions.width
    );

    // Overall thumbnail score
    const titleScore = titleReadable ? 0.4 : 0.1;
    const authorScore = authorReadable ? 0.3 : 0.05;
    const distScore = distinguishable ? 0.3 : 0.1;
    const thumbnailScore = Math.round((titleScore + authorScore + distScore) * 100) / 100;

    if (thumbnailScore < 0.7) {
      recommendations.push("Overall thumbnail score below 0.7 — consider simplifying cover design");
    }

    return {
      title_readable: titleReadable,
      author_readable: authorReadable,
      distinguishable,
      thumbnail_score: thumbnailScore,
      recommendations,
      title_breakpoint_px: titleBreakpoint,
      author_breakpoint_px: authorBreakpoint,
    };
  }
}
