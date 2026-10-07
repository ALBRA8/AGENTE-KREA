/**
 * Art Direction — KREA Book Factory Layer
 *
 * Defines the complete visual system before production begins.
 * Every visual decision is made here so that production steps are deterministic.
 *
 * Satisfies:
 *   AC-033 — ArtDirectionSpec with full visual vocabulary
 *   AC-034 — Design System coherence: all pages use same visual system
 *
 * No content generation here — this is pure design specification.
 */

import { randomUUID } from "crypto";

// ─── Color System ──────────────────────────────────────────────────────

/** A color expressed in hex, RGB, or CSS variable */
export interface ColorSpec {
  hex: string;
  rgb: { r: number; g: number; b: number };
  name: string;
}

/** Complete palette for the visual system */
export interface Palette {
  primary: ColorSpec;
  secondary: ColorSpec;
  accent: ColorSpec;
  background: ColorSpec;
  text: ColorSpec;
  /** Additional named colors for extended palette */
  extended?: Record<string, ColorSpec>;
}

// ─── Typography System ─────────────────────────────────────────────────

export interface TypographySystem {
  heading_font: string;
  body_font: string;
  mono_font: string;
  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
    "4xl": number;
  };
  weights: {
    light: number;
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
    black: number;
  };
  line_heights: {
    tight: number;
    normal: number;
    relaxed: number;
    loose: number;
  };
}

// ─── Hierarchy System ──────────────────────────────────────────────────

export interface HeadingStyle {
  font: string;
  size: number;
  weight: number;
  line_height: number;
  color: string;
  margin_top: number;
  margin_bottom: number;
  letter_spacing: number;
  text_transform: "none" | "uppercase" | "capitalize" | "lowercase";
}

export interface VisualHierarchy {
  h1: HeadingStyle;
  h2: HeadingStyle;
  h3: HeadingStyle;
  h4: HeadingStyle;
  h5: HeadingStyle;
  h6: HeadingStyle;
}

// ─── Composition & Visual Rules ────────────────────────────────────────

export interface CompositionRule {
  name: string;
  description: string;
  constraint: string;
}

export interface ConsistencyRule {
  element: string;
  property: string;
  value: string;
  scope: "global" | "chapter" | "section" | "page";
}

// ─── Image & Cover Treatment ───────────────────────────────────────────

export interface ImageTreatment {
  style: "photographic" | "illustration" | "abstract" | "minimal" | "mixed";
  border_radius: number;
  shadow: "none" | "subtle" | "medium" | "strong";
  overlay: boolean;
  overlay_opacity: number;
  caption_position: "below" | "overlay-bottom" | "overlay-center" | "side";
  max_width_percent: number;
}

export interface CoverTreatment {
  layout: "centered" | "left-aligned" | "right-aligned" | "split" | "custom";
  title_position: "top" | "center" | "bottom" | "upper-third";
  subtitle_position: "below-title" | "above-title" | "bottom";
  author_position: "bottom" | "bottom-third" | "below-subtitle";
  image_position: "background" | "top-half" | "bottom-half" | "left" | "right" | "none";
  image_overlay: boolean;
  image_overlay_opacity: number;
}

// ─── Visual System ─────────────────────────────────────────────────────

export interface VisualSystem {
  id: string;
  name: string;
  version: number;
  base_unit: number; // base grid unit in points
  page_dimensions: { width: number; height: number };
  dpi: number;
}

// ─── Art Direction Specification (AC-033) ──────────────────────────────

/**
 * Complete Art Direction specification produced by the ArtDirection class.
 *
 * AC-033: Defines style, audience_visual, mood, palette, typography,
 * hierarchy, composition_rules, visual_system, image_treatment,
 * cover_treatment, consistency_rules.
 *
 * AC-034: All pages MUST use this same visual system throughout the book.
 */
export interface ArtDirectionSpec {
  /** Unique specification ID */
  id: string;
  /** Timestamp of creation */
  createdAt: string;

  /** Visual style name (e.g., "professional", "minimalist", "editorial") */
  style: string;
  /** Visual audience description (e.g., "business executives", "creative professionals") */
  audience_visual: string;
  /** Overall mood (e.g., "authoritative", "warm", "playful", "serious") */
  mood: string;

  /** Complete color palette */
  palette: Palette;
  /** Complete typography system */
  typography: TypographySystem;
  /** Visual heading hierarchy (h1-h6) */
  hierarchy: VisualHierarchy;

  /** Rules for composition and layout */
  composition_rules: CompositionRule[];
  /** The visual system this specification belongs to */
  visual_system: VisualSystem;

  /** How images are treated throughout the book */
  image_treatment: ImageTreatment;
  /** How the cover is treated */
  cover_treatment: CoverTreatment;

  /** Consistency rules ensuring AC-034 (same visual system throughout) */
  consistency_rules: ConsistencyRule[];
}

// ─── Book Architecture (input from BookFactory step 1) ────────────────

export interface BookArchitectureInput {
  title: string;
  subtitle: string;
  author: string;
  genre: string;
  audience: string;
  chapterCount: number;
  chapterTitles: string[];
  tone: string;
  purpose: string;
}

// ─── Architecture Input ────────────────────────────────────────────────

export interface ArchitectureInput {
  productType: string;
  format: "ebook" | "guide" | "template" | "report";
  complexity: "simple" | "moderate" | "complex";
  targetMarket: string;
}

// ─── Style Presets ─────────────────────────────────────────────────────

const STYLE_PRESETS: Record<string, {
  style: string;
  mood: string;
  palette: Palette;
  typography: TypographySystem;
}> = {
  professional: {
    style: "professional",
    mood: "authoritative",
    palette: {
      primary: { hex: "#1a1a2e", rgb: { r: 26, g: 26, b: 46 }, name: "deep-navy" },
      secondary: { hex: "#16213e", rgb: { r: 22, g: 33, b: 62 }, name: "dark-blue" },
      accent: { hex: "#e94560", rgb: { r: 233, g: 69, b: 96 }, name: "coral-accent" },
      background: { hex: "#ffffff", rgb: { r: 255, g: 255, b: 255 }, name: "white" },
      text: { hex: "#2d2d2d", rgb: { r: 45, g: 45, b: 45 }, name: "dark-gray" },
    },
    typography: {
      heading_font: "Georgia",
      body_font: "Merriweather",
      mono_font: "JetBrains Mono",
      sizes: { xs: 10, sm: 12, base: 14, lg: 16, xl: 18, "2xl": 22, "3xl": 28, "4xl": 36 },
      weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 },
      line_heights: { tight: 1.2, normal: 1.5, relaxed: 1.7, loose: 2.0 },
    },
  },
  minimalist: {
    style: "minimalist",
    mood: "clean",
    palette: {
      primary: { hex: "#000000", rgb: { r: 0, g: 0, b: 0 }, name: "black" },
      secondary: { hex: "#555555", rgb: { r: 85, g: 85, b: 85 }, name: "medium-gray" },
      accent: { hex: "#ff6b35", rgb: { r: 255, g: 107, b: 53 }, name: "orange-accent" },
      background: { hex: "#fafafa", rgb: { r: 250, g: 250, b: 250 }, name: "off-white" },
      text: { hex: "#333333", rgb: { r: 51, g: 51, b: 51 }, name: "charcoal" },
    },
    typography: {
      heading_font: "Inter",
      body_font: "Source Sans Pro",
      mono_font: "Fira Code",
      sizes: { xs: 10, sm: 12, base: 14, lg: 16, xl: 20, "2xl": 24, "3xl": 32, "4xl": 40 },
      weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 },
      line_heights: { tight: 1.15, normal: 1.45, relaxed: 1.65, loose: 1.9 },
    },
  },
  editorial: {
    style: "editorial",
    mood: "sophisticated",
    palette: {
      primary: { hex: "#2c3e50", rgb: { r: 44, g: 62, b: 80 }, name: "midnight-blue" },
      secondary: { hex: "#7f8c8d", rgb: { r: 127, g: 140, b: 141 }, name: "asphalt-gray" },
      accent: { hex: "#c0392b", rgb: { r: 192, g: 57, b: 43 }, name: "pomegranate" },
      background: { hex: "#fdf6e3", rgb: { r: 253, g: 246, b: 227 }, name: "cream" },
      text: { hex: "#3d3d3d", rgb: { r: 61, g: 61, b: 61 }, name: "anthracite" },
    },
    typography: {
      heading_font: "Playfair Display",
      body_font: "Lora",
      mono_font: "Source Code Pro",
      sizes: { xs: 9, sm: 11, base: 13, lg: 15, xl: 17, "2xl": 21, "3xl": 27, "4xl": 34 },
      weights: { light: 300, normal: 400, medium: 500, semibold: 600, bold: 700, black: 900 },
      line_heights: { tight: 1.25, normal: 1.55, relaxed: 1.75, loose: 2.0 },
    },
  },
};

// ─── ArtDirection Class ────────────────────────────────────────────────

/**
 * ArtDirection — defines the complete visual system before production.
 *
 * All visual decisions are centralized here. Production steps (content,
 * layout, PDF) reference this specification rather than making independent
 * visual choices, ensuring AC-034 coherence.
 */
export class ArtDirection {
  /**
   * Define the complete Art Direction specification for a book.
   *
   * @param architecture - Product architecture context
   * @param bookArchitecture - Book's editorial structure
   * @returns Complete ArtDirectionSpec (AC-033)
   */
  define(
    architecture: ArchitectureInput,
    bookArchitecture: BookArchitectureInput
  ): ArtDirectionSpec {
    const preset = this.selectPreset(architecture, bookArchitecture);

    const visualSystem: VisualSystem = {
      id: randomUUID(),
      name: `${preset.style}-${bookArchitecture.genre}`,
      version: 1,
      base_unit: 8, // 8pt grid
      page_dimensions: this.getPageDimensions(architecture.format),
      dpi: architecture.format === "ebook" ? 150 : 300,
    };

    const hierarchy = this.buildHierarchy(
      preset.typography,
      preset.palette,
      bookArchitecture.chapterCount
    );

    const compositionRules = this.buildCompositionRules(preset.style);
    const consistencyRules = this.buildConsistencyRules(preset.style);
    const imageTreatment = this.buildImageTreatment(preset.style);
    const coverTreatment = this.buildCoverTreatment(
      preset.style,
      bookArchitecture.audience
    );

    return {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      style: preset.style,
      audience_visual: this.inferAudienceVisual(bookArchitecture.audience, bookArchitecture.genre),
      mood: preset.mood,
      palette: preset.palette,
      typography: preset.typography,
      hierarchy,
      composition_rules: compositionRules,
      visual_system: visualSystem,
      image_treatment: imageTreatment,
      cover_treatment: coverTreatment,
      consistency_rules: consistencyRules,
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Select the best style preset based on architecture and book context.
   */
  private selectPreset(
    architecture: ArchitectureInput,
    bookArchitecture: BookArchitectureInput
  ): typeof STYLE_PRESETS["professional"] {
    // Map genre + format to style
    const genreStyleMap: Record<string, string> = {
      business: "professional",
      technology: "minimalist",
      education: "editorial",
      fiction: "editorial",
      lifestyle: "minimalist",
      reference: "professional",
    };

    const styleKey = genreStyleMap[bookArchitecture.genre] ?? "professional";

    // Override based on complexity
    if (architecture.complexity === "simple" && styleKey === "editorial") {
      return STYLE_PRESETS["minimalist"] ?? STYLE_PRESETS["professional"];
    }

    return STYLE_PRESETS[styleKey] ?? STYLE_PRESETS["professional"];
  }

  /**
   * Get page dimensions based on product format.
   */
  private getPageDimensions(format: string): { width: number; height: number } {
    const dimensions: Record<string, { width: number; height: number }> = {
      ebook: { width: 432, height: 648 },     // 6×9 inches in points
      guide: { width: 432, height: 648 },
      template: { width: 595, height: 842 },   // A4 in points
      report: { width: 595, height: 842 },
    };
    return dimensions[format] ?? { width: 432, height: 648 };
  }

  /**
   * Build the visual heading hierarchy from typography + palette.
   */
  private buildHierarchy(
    typography: TypographySystem,
    palette: Palette,
    chapterCount: number
  ): VisualHierarchy {
    const baseHeading: Omit<HeadingStyle, "size" | "margin_top" | "margin_bottom"> = {
      font: typography.heading_font,
      weight: typography.weights.bold,
      line_height: typography.line_heights.tight,
      color: palette.primary.hex,
      letter_spacing: 0,
      text_transform: "none",
    };

    // Scale sizes based on chapter count to maintain visual rhythm
    const scaleFactor = chapterCount > 10 ? 0.9 : 1.0;

    return {
      h1: {
        ...baseHeading,
        size: Math.round(typography.sizes["4xl"] * scaleFactor),
        margin_top: 48,
        margin_bottom: 24,
        letter_spacing: -0.5,
      },
      h2: {
        ...baseHeading,
        size: Math.round(typography.sizes["3xl"] * scaleFactor),
        margin_top: 36,
        margin_bottom: 18,
        letter_spacing: -0.3,
      },
      h3: {
        ...baseHeading,
        size: Math.round(typography.sizes["2xl"] * scaleFactor),
        weight: typography.weights.semibold,
        margin_top: 28,
        margin_bottom: 14,
      },
      h4: {
        ...baseHeading,
        size: Math.round(typography.sizes.xl * scaleFactor),
        weight: typography.weights.semibold,
        margin_top: 24,
        margin_bottom: 12,
      },
      h5: {
        ...baseHeading,
        size: Math.round(typography.sizes.lg * scaleFactor),
        weight: typography.weights.medium,
        margin_top: 20,
        margin_bottom: 10,
        color: palette.secondary.hex,
      },
      h6: {
        ...baseHeading,
        size: Math.round(typography.sizes.base * scaleFactor),
        weight: typography.weights.medium,
        margin_top: 16,
        margin_bottom: 8,
        color: palette.secondary.hex,
        text_transform: "uppercase",
        letter_spacing: 1,
      },
    };
  }

  /**
   * Build composition rules based on style.
   */
  private buildCompositionRules(style: string): CompositionRule[] {
    const base: CompositionRule[] = [
      {
        name: "vertical-rhythm",
        description: "All vertical spacing must be multiples of the base unit",
        constraint: "spacing % base_unit === 0",
      },
      {
        name: "golden-ratio",
        description: "Heading-to-body ratio follows golden ratio",
        constraint: "heading_size / body_size ≈ 1.618",
      },
      {
        name: "optical-alignment",
        description: "Text is optically aligned, not mathematically aligned",
        constraint: "left_margin adjusted for optical alignment",
      },
    ];

    if (style === "minimalist") {
      base.push({
        name: "whitespace-dominance",
        description: "Whitespace occupies at least 40% of page area",
        constraint: "whitespace_ratio >= 0.4",
      });
    }

    if (style === "editorial") {
      base.push({
        name: "serif-requirement",
        description: "Body text must use serif font for long-form reading",
        constraint: "body_font.category === 'serif'",
      });
    }

    return base;
  }

  /**
   * Build consistency rules ensuring AC-034 design system coherence.
   */
  private buildConsistencyRules(style: string): ConsistencyRule[] {
    return [
      {
        element: "heading",
        property: "font-family",
        value: "Must use hierarchy heading_font across all chapters",
        scope: "global",
      },
      {
        element: "body",
        property: "font-family",
        value: "Must use typography body_font across all chapters",
        scope: "global",
      },
      {
        element: "color",
        property: "primary",
        value: "Must use palette.primary for all primary elements",
        scope: "global",
      },
      {
        element: "spacing",
        property: "vertical",
        value: "Must use base_unit multiples for all vertical spacing",
        scope: "global",
      },
      {
        element: "margin",
        property: "page",
        value: "Same margin configuration on every page",
        scope: "page",
      },
      {
        element: "chapter",
        property: "opening",
        value: "Every chapter starts with the same opening pattern",
        scope: "chapter",
      },
    ];
  }

  /**
   * Build image treatment specification.
   */
  private buildImageTreatment(style: string): ImageTreatment {
    const treatments: Record<string, ImageTreatment> = {
      professional: {
        style: "photographic",
        border_radius: 0,
        shadow: "subtle",
        overlay: false,
        overlay_opacity: 0,
        caption_position: "below",
        max_width_percent: 85,
      },
      minimalist: {
        style: "minimal",
        border_radius: 4,
        shadow: "none",
        overlay: false,
        overlay_opacity: 0,
        caption_position: "below",
        max_width_percent: 100,
      },
      editorial: {
        style: "mixed",
        border_radius: 0,
        shadow: "medium",
        overlay: true,
        overlay_opacity: 0.15,
        caption_position: "overlay-bottom",
        max_width_percent: 90,
      },
    };

    return treatments[style] ?? treatments["professional"];
  }

  /**
   * Build cover treatment specification.
   */
  private buildCoverTreatment(style: string, audience: string): CoverTreatment {
    const treatments: Record<string, CoverTreatment> = {
      professional: {
        layout: "left-aligned",
        title_position: "upper-third",
        subtitle_position: "below-title",
        author_position: "bottom",
        image_position: "right",
        image_overlay: false,
        image_overlay_opacity: 0,
      },
      minimalist: {
        layout: "centered",
        title_position: "center",
        subtitle_position: "below-title",
        author_position: "bottom",
        image_position: "none",
        image_overlay: false,
        image_overlay_opacity: 0,
      },
      editorial: {
        layout: "split",
        title_position: "top",
        subtitle_position: "below-title",
        author_position: "bottom-third",
        image_position: "top-half",
        image_overlay: true,
        image_overlay_opacity: 0.3,
      },
    };

    const treatment = treatments[style] ?? treatments["professional"];

    // Adjust for specific audiences
    if (audience.toLowerCase().includes("technical")) {
      treatment.image_position = "background";
      treatment.image_overlay = true;
      treatment.image_overlay_opacity = 0.5;
    }

    return treatment;
  }

  /**
   * Infer audience visual characteristics from audience + genre.
   */
  private inferAudienceVisual(audience: string, genre: string): string {
    const audienceMap: Record<string, string> = {
      executives: "clean, authoritative, data-driven",
      developers: "dark-mode friendly, monospace-friendly, diagram-heavy",
      creatives: "expressive, bold colors, generous whitespace",
      students: "approachable, clear hierarchy, scannable",
      general: "balanced, readable, professional",
    };

    for (const [key, value] of Object.entries(audienceMap)) {
      if (audience.toLowerCase().includes(key)) return value;
    }

    return audienceMap["general"];
  }
}
