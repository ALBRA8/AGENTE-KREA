/**
 * Product Specification — Product Brain Module
 *
 * Creates detailed specification from product architecture.
 * Extends the architecture with concrete acceptance criteria,
 * chapter/module specifications, and constraints.
 *
 * Uses ZAI SDK for specification generation with structured parsing.
 * All LLM-derived data is marked as INFERRED.
 */

import ZAI from "z-ai-web-dev-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";
import { parseStructuredResponse } from "@/lib/structured-output";
import type { EvidenceTag } from "@/lib/product-fit";
import type {
  ProductArchitecture,
  BookArchitecture,
  SoftwareArchitecture,
  ChapterOutline,
} from "@/lib/product-architecture";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AcceptanceCriterion {
  id: string;
  description: string;
  priority: "MUST" | "SHOULD" | "NICE_TO_HAVE";
  verificationMethod: string;
  status: "PENDING" | "MET" | "PARTIALLY_MET" | "NOT_MET";
}

export interface ChapterSpec {
  chapterNumber: number;
  title: string;
  description: string;
  targetWordCount: number;
  keyTopics: string[];
  outline: string[];
  acceptanceCriteria: string[];
}

export interface ModuleSpec {
  name: string;
  responsibility: string;
  interfaces: string[];
  dependencies: string[];
  acceptanceCriteria: string[];
  testStrategy: string;
}

export interface ProductSpecification {
  productId: string;
  version: string;
  architecture: ProductArchitecture;
  chapters?: ChapterSpec[];
  modules?: ModuleSpec[];
  acceptanceCriteria: AcceptanceCriterion[];
  constraints: string[];
  evidence: EvidenceTag;
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

/**
 * Flexible string-or-object schema that normalizes to string.
 * LLMs may return structured objects where the schema expects strings.
 * This accepts both and JSON.stringifies objects for consistency.
 */
const stringOrObjectToString = z
  .union([z.string(), z.record(z.any())])
  .transform((val) => (typeof val === "string" ? val : JSON.stringify(val)));

const acceptanceCriterionSchema = z.object({
  description: z.string(),
  priority: z.enum(["MUST", "SHOULD", "NICE_TO_HAVE"]),
  verificationMethod: z.string(),
});

const chapterSpecSchema = z.object({
  chapterNumber: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  targetWordCount: z.number().int().positive(),
  keyTopics: z.array(z.string()),
  outline: z.array(z.string()),
  acceptanceCriteria: z.array(stringOrObjectToString),
});

const moduleSpecSchema = z.object({
  name: z.string(),
  responsibility: z.string(),
  interfaces: z.array(z.string()),
  dependencies: z.array(z.string()),
  acceptanceCriteria: z.array(stringOrObjectToString),
  testStrategy: z.string(),
});

const specificationResponseSchema = z.object({
  constraints: z.array(z.string()),
  acceptanceCriteria: z.array(acceptanceCriterionSchema),
  chapters: z.array(chapterSpecSchema).optional(),
  modules: z.array(moduleSpecSchema).optional(),
});

// ─── ZAI Adapter ──────────────────────────────────────────────────────────────

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Create a detailed product specification from architecture.
 *
 * For ebooks/guides: generates chapter specifications with outlines
 * For software/saas: generates module specifications with test strategies
 * For templates/kits: generates component specifications
 */
export async function createProductSpecification(
  architecture: ProductArchitecture,
  existingConstraints?: string[]
): Promise<ProductSpecification> {
  const productId = generateProductId();
  const version = "1.0.0";

  try {
    const zai = await getZAI();
    const prompt = buildSpecificationPrompt(architecture, existingConstraints);

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: SPECIFICATION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parseResult = parseStructuredResponse(content, specificationResponseSchema);

    if (!parseResult.success) {
      console.error("[ProductSpecification] Parse failed:", parseResult.error);
      return createFallbackSpecification(productId, version, architecture, parseResult.error);
    }

    const data = parseResult.data;

    // Build acceptance criteria with IDs and status
    const acceptanceCriteria: AcceptanceCriterion[] = data.acceptanceCriteria.map((ac) => ({
      id: generateCriterionId(),
      description: ac.description,
      priority: ac.priority,
      verificationMethod: ac.verificationMethod,
      status: "PENDING" as const,
    }));

    // Combine constraints
    const constraints = [
      ...(architecture.constraints || []),
      ...data.constraints,
      ...(existingConstraints || []),
    ];

    return {
      productId,
      version,
      architecture,
      chapters: data.chapters,
      modules: data.modules,
      acceptanceCriteria,
      constraints,
      evidence: "INFERRED",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ProductSpecification] Creation error:", message);
    return createFallbackSpecification(productId, version, architecture, message);
  }
}

/**
 * Create specification from a BookArchitecture with enhanced chapter specs.
 */
export async function createBookSpecification(
  architecture: BookArchitecture,
  existingConstraints?: string[]
): Promise<ProductSpecification> {
  const spec = await createProductSpecification(architecture, existingConstraints);

  // Enhance with chapter outlines from architecture
  if (architecture.chapters && architecture.chapters.length > 0) {
    const enhancedChapters: ChapterSpec[] = architecture.chapters.map((chapter) => ({
      chapterNumber: chapter.number,
      title: chapter.title,
      description: chapter.description,
      targetWordCount: chapter.estimatedWords,
      keyTopics: chapter.keyTopics,
      outline: chapter.keyTopics.map((topic) => `Section on ${topic}`),
      acceptanceCriteria: [
        `Chapter ${chapter.number} covers all key topics: ${chapter.keyTopics.join(", ")}`,
        `Word count within 20% of target (${chapter.estimatedWords})`,
        `Content aligns with problem statement and target audience`,
      ],
    }));

    spec.chapters = enhancedChapters;
  }

  return spec;
}

/**
 * Create specification from a SoftwareArchitecture with module specs.
 */
export async function createSoftwareSpecification(
  architecture: SoftwareArchitecture,
  existingConstraints?: string[]
): Promise<ProductSpecification> {
  const spec = await createProductSpecification(architecture, existingConstraints);

  // Enhance with module specifications from architecture
  if (architecture.modules && architecture.modules.length > 0) {
    const enhancedModules: ModuleSpec[] = architecture.modules.map((mod) => ({
      name: mod.name,
      responsibility: mod.responsibility,
      interfaces: mod.interfaces,
      dependencies: mod.dependencies,
      acceptanceCriteria: [
        `Module ${mod.name} implements all defined interfaces`,
        `All dependencies are resolved and available`,
        `Module passes unit and integration tests`,
      ],
      testStrategy: `Unit tests for ${mod.name} with mocked dependencies: ${mod.dependencies.join(", ") || "none"}`,
    }));

    spec.modules = enhancedModules;
  }

  return spec;
}

/**
 * Update an acceptance criterion's status.
 */
export function updateCriterionStatus(
  spec: ProductSpecification,
  criterionId: string,
  status: AcceptanceCriterion["status"]
): ProductSpecification {
  return {
    ...spec,
    acceptanceCriteria: spec.acceptanceCriteria.map((ac) =>
      ac.id === criterionId ? { ...ac, status } : ac
    ),
  };
}

/**
 * Check if all MUST acceptance criteria are met.
 */
export function areAllMustCriteriaMet(spec: ProductSpecification): boolean {
  return spec.acceptanceCriteria
    .filter((ac) => ac.priority === "MUST")
    .every((ac) => ac.status === "MET");
}

/**
 * Get specification completion percentage.
 */
export function getSpecificationCompletion(spec: ProductSpecification): number {
  if (spec.acceptanceCriteria.length === 0) return 0;
  const met = spec.acceptanceCriteria.filter((ac) => ac.status === "MET").length;
  return Math.round((met / spec.acceptanceCriteria.length) * 100);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPECIFICATION_SYSTEM_PROMPT = `You are a Product Specification Writer for KREA (Product Architect Agent).
Create a detailed specification from the product architecture.
Return a JSON object with:
- constraints: array of strings (additional constraints beyond architecture)
- acceptanceCriteria: array of {description, priority ("MUST"|"SHOULD"|"NICE_TO_HAVE"), verificationMethod}
- chapters: (for ebooks/guides) array of {chapterNumber, title, description, targetWordCount, keyTopics[], outline[], acceptanceCriteria[]}
- modules: (for software/saas) array of {name, responsibility, interfaces[], dependencies[], acceptanceCriteria[], testStrategy}

Rules:
- Be specific and measurable in acceptance criteria
- Do NOT invent capabilities not in the architecture
- Be realistic about what can be verified
- Return ONLY valid JSON`;

function buildSpecificationPrompt(
  architecture: ProductArchitecture,
  existingConstraints?: string[]
): string {
  const componentsSummary = architecture.components
    .map((c) => `  - ${c.name} (${c.type}): ${c.description}`)
    .join("\n");

  const constraintsStr = existingConstraints && existingConstraints.length > 0
    ? `Additional constraints: ${existingConstraints.join(", ")}`
    : "";

  return `Create a detailed specification for:

Product Type: ${architecture.productType}
Architecture: ${architecture.architecture}
Components:
${componentsSummary}
Dependencies: ${architecture.dependencies.join(", ") || "none"}
Existing Constraints: ${architecture.constraints.join("; ") || "none"}
${constraintsStr}

Provide a complete specification with acceptance criteria and detailed ${getSpecTypeHint(architecture.productType)}.`;
}

function getSpecTypeHint(productType: string): string {
  switch (productType) {
    case "ebook":
    case "guide":
      return "chapter specifications with outlines";
    case "software":
    case "saas":
      return "module specifications with test strategies";
    case "template":
      return "template file specifications";
    case "kit":
      return "kit component specifications";
    default:
      return "component specifications";
  }
}

function generateProductId(): string {
  return `prod_${randomUUID().replace(/-/g, "").substring(0, 20)}`;
}

function generateCriterionId(): string {
  return `ac_${randomUUID().replace(/-/g, "").substring(0, 12)}`;
}

function createFallbackSpecification(
  productId: string,
  version: string,
  architecture: ProductArchitecture,
  error: string
): ProductSpecification {
  return {
    productId,
    version,
    architecture,
    acceptanceCriteria: [],
    constraints: [...(architecture.constraints || []), `Specification generation failed: ${error}`],
    evidence: "NOT_VERIFIED",
  };
}
