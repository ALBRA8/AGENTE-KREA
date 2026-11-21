/**
 * Product Content Engine — KREA V2.1
 *
 * Extensible content generation engine supporting multiple product types.
 * Each product type has a default template structure that can be customized.
 * Content generation uses the ZAI SDK — all LLM output is tagged INFERRED.
 *
 * Supported types:
 *   ebook, guide, manual, workbook, checklist, template_pack,
 *   digital_kit, resource_pack, specialized_document, hybrid_content
 *
 * Extensibility: New product types can be registered without modifying core code
 * via registerContentType().
 */

import ZAI from "z-ai-web-dev-sdk";
import type { EvidenceTag } from "@/lib/product-fit";

// ─── Type Definitions ────────────────────────────────────────────────

export type ContentType =
  | "ebook"
  | "guide"
  | "manual"
  | "workbook"
  | "checklist"
  | "template_pack"
  | "digital_kit"
  | "resource_pack"
  | "specialized_document"
  | "hybrid_content";

export type SectionType =
  | "chapter"
  | "appendix"
  | "front_matter"
  | "back_matter"
  | "bonus"
  | "worksheet"
  | "checklist"
  | "template"
  | "reference";

export interface ContentSection {
  id: string;
  title: string;
  type: SectionType;
  order: number;
  content: string;
  subsections: ContentSection[];
  requirements: string[];
}

export interface ContentStyle {
  tone: string; // "professional" | "friendly" | "academic" | "conversational" | "instructional"
  language: string; // "es" | "en"
  depth: string; // "beginner" | "intermediate" | "advanced" | "mixed"
  format: string; // "prose" | "structured" | "step_by_step" | "reference"
}

export interface ContentMetadata {
  estimatedWords: number;
  estimatedReadTime: string; // "30 min" etc
  targetAudience: string;
  purpose: string;
}

export interface ContentSpec {
  type: ContentType;
  title: string;
  sections: ContentSection[];
  style: ContentStyle;
  metadata: ContentMetadata;
}

export interface AssembledContent {
  title: string;
  type: ContentType;
  sections: ContentSection[];
  style: ContentStyle;
  metadata: ContentMetadata;
  totalWords: number;
  completenessScore: number; // 0-1, how many requirements are satisfied
  evidence: EvidenceTag;
  assembledAt: Date;
}

export interface ContentTypeInfo {
  name: string;
  description: string;
  defaultStructure: SectionType[];
  typicalWordRange: { min: number; max: number };
}

// ─── Content Type Registry ───────────────────────────────────────────

const contentTypeRegistry = new Map<ContentType, ContentTypeInfo>();

/**
 * Default content type definitions.
 * These are registered at module load time.
 */
const DEFAULT_CONTENT_TYPES: Record<ContentType, ContentTypeInfo> = {
  ebook: {
    name: "eBook",
    description: "Long-form digital book with chapters, front matter, and back matter",
    defaultStructure: ["front_matter", "chapter", "chapter", "chapter", "chapter", "chapter", "back_matter"],
    typicalWordRange: { min: 15000, max: 50000 },
  },
  guide: {
    name: "Guide",
    description: "Step-by-step instructional guide with tips and resources",
    defaultStructure: ["front_matter", "chapter", "chapter", "chapter", "bonus", "reference"],
    typicalWordRange: { min: 5000, max: 20000 },
  },
  manual: {
    name: "Manual",
    description: "Technical manual with setup, usage, and troubleshooting",
    defaultStructure: ["front_matter", "chapter", "chapter", "chapter", "chapter", "appendix", "reference"],
    typicalWordRange: { min: 8000, max: 30000 },
  },
  workbook: {
    name: "Workbook",
    description: "Interactive workbook with exercises, worksheets, and solutions",
    defaultStructure: ["front_matter", "chapter", "worksheet", "worksheet", "worksheet", "bonus", "back_matter"],
    typicalWordRange: { min: 5000, max: 15000 },
  },
  checklist: {
    name: "Checklist Pack",
    description: "Collection of actionable checklists with tips",
    defaultStructure: ["front_matter", "checklist", "checklist", "checklist", "bonus"],
    typicalWordRange: { min: 2000, max: 8000 },
  },
  template_pack: {
    name: "Template Pack",
    description: "Collection of ready-to-use templates with instructions",
    defaultStructure: ["front_matter", "template", "template", "template", "bonus", "reference"],
    typicalWordRange: { min: 3000, max: 10000 },
  },
  digital_kit: {
    name: "Digital Kit",
    description: "Complete digital product kit with components and assembly guide",
    defaultStructure: ["front_matter", "chapter", "template", "template", "chapter", "reference"],
    typicalWordRange: { min: 5000, max: 20000 },
  },
  resource_pack: {
    name: "Resource Pack",
    description: "Curated collection of resources with usage instructions",
    defaultStructure: ["front_matter", "reference", "reference", "chapter", "bonus"],
    typicalWordRange: { min: 3000, max: 12000 },
  },
  specialized_document: {
    name: "Specialized Document",
    description: "Domain-specific document with custom structure",
    defaultStructure: ["front_matter", "chapter", "chapter", "chapter", "appendix"],
    typicalWordRange: { min: 5000, max: 25000 },
  },
  hybrid_content: {
    name: "Hybrid Content",
    description: "Multi-format content combining different section types",
    defaultStructure: ["front_matter", "chapter", "worksheet", "checklist", "template", "reference", "back_matter"],
    typicalWordRange: { min: 8000, max: 35000 },
  },
};

// Register all default content types
for (const [type, info] of Object.entries(DEFAULT_CONTENT_TYPES)) {
  contentTypeRegistry.set(type as ContentType, info);
}

// ─── ZAI Adapter ──────────────────────────────────────────────────────

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Core Functions ───────────────────────────────────────────────────

/**
 * Register a new content type (or override an existing one).
 * This is the extensibility mechanism — new product types can be added
 * without modifying core code.
 */
export function registerContentType(type: ContentType, info: ContentTypeInfo): void {
  contentTypeRegistry.set(type, info);
}

/**
 * Get information about a content type.
 * Returns name, description, default structure, and typical word range.
 */
export function getContentTypeInfo(type: ContentType): ContentTypeInfo {
  const info = contentTypeRegistry.get(type);
  if (!info) {
    // Fallback for unregistered types
    return {
      name: type,
      description: "Custom content type",
      defaultStructure: ["front_matter", "chapter", "back_matter"],
      typicalWordRange: { min: 3000, max: 15000 },
    };
  }
  return info;
}

/**
 * Get a content template (ContentSpec) for a given product type.
 * The template provides the default structure with empty sections
 * ready to be filled with content.
 */
export function getContentTemplate(type: ContentType): ContentSpec {
  const info = getContentTypeInfo(type);
  const sections: ContentSection[] = [];

  let sectionCounter = 0;
  for (const sectionType of info.defaultStructure) {
    sectionCounter++;
    const sectionId = `sec_${crypto.randomUUID().replace(/-/g, "").substring(0, 12)}`;

    sections.push({
      id: sectionId,
      title: getDefaultSectionTitle(sectionType, sectionCounter, type),
      type: sectionType,
      order: sectionCounter,
      content: "",
      subsections: [],
      requirements: getDefaultRequirements(sectionType, type),
    });
  }

  // Estimate metadata from type info
  const estimatedWords = Math.round((info.typicalWordRange.min + info.typicalWordRange.max) / 2);
  const estimatedReadTime = `${Math.round(estimatedWords / 250)} min`;

  return {
    type,
    title: "",
    sections,
    style: {
      tone: "professional",
      language: "es",
      depth: "intermediate",
      format: "structured",
    },
    metadata: {
      estimatedWords,
      estimatedReadTime,
      targetAudience: "",
      purpose: "",
    },
  };
}

/**
 * Generate content for a specific section using the ZAI SDK.
 *
 * The generated content is based on the section's requirements,
 * the overall context, and the desired style.
 *
 * IMPORTANT: All generated content is tagged as INFERRED (LLM-derived).
 * Never tag LLM output as VERIFIED.
 */
export async function generateSectionContent(
  section: ContentSection,
  context: string,
  style: ContentStyle
): Promise<{ content: string; evidence: EvidenceTag; wordCount: number }> {
  const zai = await getZAI();

  const systemPrompt = buildSystemPrompt(style);
  const userPrompt = buildSectionPrompt(section, context, style);

  try {
    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";

    return {
      content,
      evidence: "INFERRED", // LLM-derived — never VERIFIED
      wordCount: countWords(content),
    };
  } catch (error) {
    // On failure, return empty content with error note
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    return {
      content: `[Content generation failed: ${errorMsg}]`,
      evidence: "NOT_VERIFIED",
      wordCount: 0,
    };
  }
}

/**
 * Assemble all sections into a final content structure.
 * Validates completeness against requirements and calculates totals.
 */
export function assembleContent(spec: ContentSpec): AssembledContent {
  // Calculate total words
  const totalWords = countSectionsWords(spec.sections);

  // Validate completeness — check how many requirements are satisfied
  const completenessScore = calculateCompleteness(spec.sections);

  return {
    title: spec.title,
    type: spec.type,
    sections: spec.sections,
    style: spec.style,
    metadata: spec.metadata,
    totalWords,
    completenessScore,
    evidence: "INFERRED", // Content is LLM-generated
    assembledAt: new Date(),
  };
}

/**
 * List all registered content types.
 */
export function listContentTypes(): ContentType[] {
  return Array.from(contentTypeRegistry.keys());
}

/**
 * Check if a content type is registered.
 */
export function isContentTypeRegistered(type: ContentType): boolean {
  return contentTypeRegistry.has(type);
}

// ─── Private Helpers ──────────────────────────────────────────────────

/**
 * Get default title for a section based on its type and position.
 */
function getDefaultSectionTitle(
  sectionType: SectionType,
  order: number,
  contentType: ContentType
): string {
  const titles: Record<SectionType, string> = {
    chapter: `Section ${order}`,
    appendix: `Appendix ${String.fromCharCode(64 + order)}`,
    front_matter: "Introduction",
    back_matter: "Conclusion",
    bonus: "Bonus Material",
    worksheet: `Worksheet ${order}`,
    checklist: `Checklist ${order}`,
    template: `Template ${order}`,
    reference: "References & Resources",
  };

  // Type-specific overrides
  if (contentType === "ebook") {
    if (sectionType === "chapter") return `Chapter ${order - 1}`;
    if (sectionType === "front_matter") return "Preface";
    if (sectionType === "back_matter") return "Afterword";
  }

  if (contentType === "guide") {
    if (sectionType === "chapter" && order === 2) return "Getting Started";
    if (sectionType === "bonus") return "Pro Tips";
  }

  if (contentType === "manual") {
    if (sectionType === "chapter" && order === 2) return "Overview";
    if (sectionType === "chapter" && order === 3) return "Setup & Installation";
    if (sectionType === "chapter" && order === 4) return "Usage";
  }

  if (contentType === "workbook") {
    if (sectionType === "chapter" && order === 2) return "How to Use This Workbook";
  }

  return titles[sectionType] || `Section ${order}`;
}

/**
 * Get default requirements for a section based on its type.
 */
function getDefaultRequirements(sectionType: SectionType, contentType: ContentType): string[] {
  const baseRequirements: Record<SectionType, string[]> = {
    chapter: ["Clear heading", "Substance and depth", "Key takeaways"],
    appendix: ["Supplementary information", "Cross-references"],
    front_matter: ["Purpose statement", "Target audience description", "How to use this content"],
    back_matter: ["Summary of key points", "Next steps", "Call to action"],
    bonus: ["Additional value beyond core content", "Actionable advice"],
    worksheet: ["Clear instructions", "Space for answers/notes", "Examples"],
    checklist: ["Actionable items", "Logical order", "Completion indicators"],
    template: ["Fill-in-the-blank structure", "Instructions for use", "Examples"],
    reference: ["Categorized resources", "Descriptions", "Access information"],
  };

  const requirements = [...(baseRequirements[sectionType] || [])];

  // Type-specific additions
  if (contentType === "ebook" && sectionType === "chapter") {
    requirements.push("Narrative flow", "Engaging opening", "Chapter summary");
  }

  if (contentType === "manual" && sectionType === "chapter") {
    requirements.push("Step-by-step instructions", "Screenshots/diagrams reference", "Troubleshooting tips");
  }

  return requirements;
}

/**
 * Build the system prompt for content generation.
 */
function buildSystemPrompt(style: ContentStyle): string {
  const toneInstructions: Record<string, string> = {
    professional: "Use a professional, authoritative tone. Be precise and thorough.",
    friendly: "Use a warm, approachable tone. Be encouraging and supportive.",
    academic: "Use a scholarly, evidence-based tone. Cite reasoning and logic.",
    conversational: "Use a natural, conversational tone. Write as if speaking to the reader.",
    instructional: "Use a clear, directive tone. Focus on step-by-step guidance.",
  };

  const depthInstructions: Record<string, string> = {
    beginner: "Assume no prior knowledge. Explain all concepts from scratch.",
    intermediate: "Assume basic familiarity. Build on foundational concepts.",
    advanced: "Assume strong familiarity. Focus on nuanced and complex aspects.",
    mixed: "Layer content from basics to advanced. Use progressive disclosure.",
  };

  const formatInstructions: Record<string, string> = {
    prose: "Write in flowing paragraphs with natural transitions.",
    structured: "Use headings, bullet points, and structured formatting.",
    step_by_step: "Use numbered steps with clear action items.",
    reference: "Use a reference format with categorized, scannable entries.",
  };

  const tone = toneInstructions[style.tone] || toneInstructions.professional;
  const depth = depthInstructions[style.depth] || depthInstructions.intermediate;
  const format = formatInstructions[style.format] || formatInstructions.structured;

  return `You are a professional content writer creating content for a digital product.

${tone}
${depth}
${format}

Language: Write in ${style.language === "es" ? "Spanish" : "English"}.

Important rules:
- Produce original, valuable content
- Be specific and actionable
- Include examples where appropriate
- Maintain consistent terminology throughout
- Do not use filler content or placeholder text`;
}

/**
 * Build the user prompt for section content generation.
 */
function buildSectionPrompt(
  section: ContentSection,
  context: string,
  style: ContentStyle
): string {
  const requirementsList = section.requirements.length > 0
    ? `\n\nRequirements for this section:\n${section.requirements.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    : "";

  const subsectionsInfo = section.subsections.length > 0
    ? `\n\nThis section has ${section.subsections.length} subsection(s): ${section.subsections.map((s) => s.title).join(", ")}`
    : "";

  return `Generate content for the following section of a digital product:

Section Title: ${section.title}
Section Type: ${section.type}
Overall Product Context: ${context}
${requirementsList}
${subsectionsInfo}

Write the complete content for this section. Make it substantial and valuable — aim for at least 500 words of meaningful content.`;
}

/**
 * Count words in a text string.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Recursively count words across all sections and subsections.
 */
function countSectionsWords(sections: ContentSection[]): number {
  let total = 0;
  for (const section of sections) {
    total += countWords(section.content);
    if (section.subsections.length > 0) {
      total += countSectionsWords(section.subsections);
    }
  }
  return total;
}

/**
 * Calculate completeness score based on requirements satisfaction.
 * A requirement is considered satisfied if the section has non-empty content.
 * Returns a value between 0 and 1.
 */
function calculateCompleteness(sections: ContentSection[]): number {
  let totalRequirements = 0;
  let satisfiedRequirements = 0;

  for (const section of sections) {
    totalRequirements += section.requirements.length;

    if (section.content.trim().length > 0) {
      // If content exists, consider all requirements satisfied for this section
      satisfiedRequirements += section.requirements.length;
    }

    // Check subsections recursively
    if (section.subsections.length > 0) {
      const subResult = calculateCompleteness(section.subsections);
      totalRequirements += subResult > 0 ? 1 : 0; // Normalized
      satisfiedRequirements += subResult;
    }
  }

  if (totalRequirements === 0) return 0;
  return Math.min(1, satisfiedRequirements / totalRequirements);
}
