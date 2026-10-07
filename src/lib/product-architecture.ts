/**
 * Product Architecture — Product Brain Module
 *
 * Designs the product architecture for the chosen product type.
 * Uses ZAI SDK to generate architecture with structured output parsing.
 *
 * Product types:
 *   ebook     → BookArchitecture (chapters, structure, word count, art direction)
 *   software  → SoftwareArchitecture (modules, APIs, data models, integrations) — marked for HANDOFF
 *   saas      → SoftwareArchitecture with SaaS-specific patterns
 *   guide     → BookArchitecture (simplified)
 *   template  → TemplateArchitecture (files, structure, customization points)
 *   kit       → KitArchitecture (components, instructions, assembly)
 */

import ZAI from "z-ai-web-dev-sdk";
import { z } from "zod";
import { randomUUID } from "crypto";
import { parseStructuredResponse } from "@/lib/structured-output";
import type { EvidenceTag } from "@/lib/product-fit";
import type { FitScore } from "@/lib/product-fit";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArchitectureComponent {
  name: string;
  type: string;
  description: string;
  dependencies: string[];
}

export interface ProductArchitecture {
  productType: "ebook" | "software" | "saas" | "guide" | "template" | "kit";
  architecture: string; // High-level description
  components: ArchitectureComponent[];
  dependencies: string[];
  constraints: string[];
  estimatedDuration: string;
  technologyStack: string[];
  evidence: EvidenceTag;
}

// ─── Specialized Architecture Types ───────────────────────────────────────────

export interface BookArchitecture extends ProductArchitecture {
  productType: "ebook" | "guide";
  chapters: ChapterOutline[];
  totalWordCount: number;
  artDirection: string;
  format: "pdf" | "epub" | "both";
}

export interface ChapterOutline {
  number: number;
  title: string;
  description: string;
  estimatedWords: number;
  keyTopics: string[];
}

export interface SoftwareArchitecture extends ProductArchitecture {
  productType: "software" | "saas";
  modules: SoftwareModule[];
  apis: ApiDefinition[];
  dataModels: DataModelDefinition[];
  integrations: string[];
  handoffReady: boolean; // Software products are marked for HANDOFF
}

export interface SoftwareModule {
  name: string;
  responsibility: string;
  interfaces: string[];
  dependencies: string[];
}

export interface ApiDefinition {
  name: string;
  method: string;
  path: string;
  description: string;
}

export interface DataModelDefinition {
  name: string;
  fields: string[];
  relationships: string[];
}

export interface TemplateArchitecture extends ProductArchitecture {
  productType: "template";
  files: TemplateFile[];
  customizationPoints: string[];
}

export interface TemplateFile {
  path: string;
  description: string;
  isRequired: boolean;
}

export interface KitArchitecture extends ProductArchitecture {
  productType: "kit";
  kitComponents: KitComponent[];
  assemblyInstructions: string[];
}

export interface KitComponent {
  name: string;
  type: string;
  description: string;
  files: string[];
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const architectureComponentSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
});

const baseArchitectureResponseSchema = z.object({
  architecture: z.string().min(10),
  components: z.array(architectureComponentSchema),
  dependencies: z.array(z.string()),
  constraints: z.array(z.string()),
  estimatedDuration: z.string(),
  technologyStack: z.array(z.string()),
});

const chapterOutlineSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  estimatedWords: z.number().int().positive(),
  keyTopics: z.array(z.string()),
});

const bookArchitectureResponseSchema = baseArchitectureResponseSchema.extend({
  chapters: z.array(chapterOutlineSchema).min(1),
  totalWordCount: z.number().int().positive(),
  artDirection: z.string(),
  format: z.enum(["pdf", "epub", "both"]),
});

const softwareModuleSchema = z.object({
  name: z.string(),
  responsibility: z.string(),
  interfaces: z.array(z.string()),
  dependencies: z.array(z.string()),
});

const apiDefinitionSchema = z.object({
  name: z.string(),
  method: z.string(),
  path: z.string(),
  description: z.string(),
});

const dataModelSchema = z.object({
  name: z.string(),
  fields: z.array(z.string()),
  relationships: z.array(z.string()),
});

const softwareArchitectureResponseSchema = baseArchitectureResponseSchema.extend({
  modules: z.array(softwareModuleSchema),
  apis: z.array(apiDefinitionSchema),
  dataModels: z.array(dataModelSchema),
  integrations: z.array(z.string()),
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
 * Design product architecture based on product type and fit score.
 *
 * Dispatches to specialized architecture generators based on domain.
 * All LLM-generated architecture data is marked as INFERRED.
 */
export async function designProductArchitecture(
  productType: string,
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): Promise<ProductArchitecture> {
  const validTypes = ["ebook", "software", "saas", "guide", "template", "kit"] as const;
  const type = validTypes.includes(productType as any)
    ? (productType as typeof validTypes[number])
    : null;

  if (!type) {
    return createFallbackArchitecture(productType, "Invalid product type", "NOT_VERIFIED");
  }

  try {
    switch (type) {
      case "ebook":
      case "guide":
        return await designBookArchitecture(type, title, description, fitScore, additionalContext);
      case "software":
      case "saas":
        return await designSoftwareArchitecture(type, title, description, fitScore, additionalContext);
      case "template":
        return await designTemplateArchitecture(title, description, fitScore, additionalContext);
      case "kit":
        return await designKitArchitecture(title, description, fitScore, additionalContext);
      default:
        return createFallbackArchitecture(type, "Unsupported product type", "NOT_VERIFIED");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ProductArchitecture] Design error:", message);
    return createFallbackArchitecture(type, `Architecture design failed: ${message}`, "NOT_VERIFIED");
  }
}

// ─── Specialized Architecture Generators ──────────────────────────────────────

async function designBookArchitecture(
  productType: "ebook" | "guide",
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): Promise<BookArchitecture> {
  const zai = await getZAI();
  const prompt = buildBookPrompt(productType, title, description, fitScore, additionalContext);

  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: BOOK_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const parseResult = parseStructuredResponse(content, bookArchitectureResponseSchema);

  if (!parseResult.success) {
    console.error("[ProductArchitecture] Book parse failed:", parseResult.error);
    return createFallbackBookArchitecture(productType, title, parseResult.error);
  }

  const data = parseResult.data;

  return {
    productType,
    architecture: data.architecture,
    components: data.components,
    dependencies: data.dependencies,
    constraints: [...data.constraints, `Fit score: ${fitScore.overall}`, `Evidence: ${fitScore.evidence}`],
    estimatedDuration: data.estimatedDuration,
    technologyStack: data.technologyStack,
    evidence: "INFERRED",
    chapters: data.chapters,
    totalWordCount: data.totalWordCount,
    artDirection: data.artDirection,
    format: data.format,
  };
}

async function designSoftwareArchitecture(
  productType: "software" | "saas",
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): Promise<SoftwareArchitecture> {
  const zai = await getZAI();
  const prompt = buildSoftwarePrompt(productType, title, description, fitScore, additionalContext);

  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: SOFTWARE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const parseResult = parseStructuredResponse(content, softwareArchitectureResponseSchema);

  if (!parseResult.success) {
    console.error("[ProductArchitecture] Software parse failed:", parseResult.error);
    return createFallbackSoftwareArchitecture(productType, title, parseResult.error);
  }

  const data = parseResult.data;

  return {
    productType,
    architecture: data.architecture,
    components: data.components,
    dependencies: data.dependencies,
    constraints: [
      ...data.constraints,
      `Fit score: ${fitScore.overall}`,
      `Evidence: ${fitScore.evidence}`,
      "MARKED_FOR_HANDOFF: Software products require handoff to implementation provider",
    ],
    estimatedDuration: data.estimatedDuration,
    technologyStack: data.technologyStack,
    evidence: "INFERRED",
    modules: data.modules,
    apis: data.apis,
    dataModels: data.dataModels,
    integrations: data.integrations,
    handoffReady: true, // Software products are always marked for handoff
  };
}

async function designTemplateArchitecture(
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): Promise<TemplateArchitecture> {
  const zai = await getZAI();
  const prompt = buildTemplatePrompt(title, description, fitScore, additionalContext);

  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: TEMPLATE_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const parseResult = parseStructuredResponse(content, baseArchitectureResponseSchema);

  if (!parseResult.success) {
    console.error("[ProductArchitecture] Template parse failed:", parseResult.error);
    return createFallbackTemplateArchitecture(title, parseResult.error);
  }

  const data = parseResult.data;

  // Template-specific files from components
  const files: TemplateFile[] = data.components.map((comp) => ({
    path: comp.name,
    description: comp.description,
    isRequired: true,
  }));

  const customizationPoints = data.constraints.filter((c) =>
    c.toLowerCase().includes("customiz")
  );

  return {
    productType: "template",
    architecture: data.architecture,
    components: data.components,
    dependencies: data.dependencies,
    constraints: [...data.constraints, `Fit score: ${fitScore.overall}`],
    estimatedDuration: data.estimatedDuration,
    technologyStack: data.technologyStack,
    evidence: "INFERRED",
    files,
    customizationPoints: customizationPoints.length > 0
      ? customizationPoints
      : ["Content customization", "Styling/theming"],
  };
}

async function designKitArchitecture(
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): Promise<KitArchitecture> {
  const zai = await getZAI();
  const prompt = buildKitPrompt(title, description, fitScore, additionalContext);

  const response = await zai.chat.completions.create({
    messages: [
      { role: "system", content: KIT_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const parseResult = parseStructuredResponse(content, baseArchitectureResponseSchema);

  if (!parseResult.success) {
    console.error("[ProductArchitecture] Kit parse failed:", parseResult.error);
    return createFallbackKitArchitecture(title, parseResult.error);
  }

  const data = parseResult.data;

  const kitComponents: KitComponent[] = data.components.map((comp) => ({
    name: comp.name,
    type: comp.type,
    description: comp.description,
    files: comp.dependencies,
  }));

  return {
    productType: "kit",
    architecture: data.architecture,
    components: data.components,
    dependencies: data.dependencies,
    constraints: [...data.constraints, `Fit score: ${fitScore.overall}`],
    estimatedDuration: data.estimatedDuration,
    technologyStack: data.technologyStack,
    evidence: "INFERRED",
    kitComponents,
    assemblyInstructions: data.dependencies.length > 0
      ? [`Assemble in order: ${data.dependencies.join(" → ")}`, "Test each component before integration"]
      : ["Follow component order in architecture"],
  };
}

// ─── System Prompts ───────────────────────────────────────────────────────────

const BOOK_SYSTEM_PROMPT = `You are a Product Architect specializing in books, ebooks, and guides.
Design the architecture for the given book/guide product.
Return a JSON object with:
- architecture: string (high-level architecture description)
- components: array of {name, type, description, dependencies}
- dependencies: array of strings
- constraints: array of strings
- estimatedDuration: string
- technologyStack: array of strings
- chapters: array of {number, title, description, estimatedWords, keyTopics[]}
- totalWordCount: number
- artDirection: string (visual style guidelines)
- format: "pdf" | "epub" | "both"

Rules:
- Design a complete chapter structure
- Be realistic about word counts (avg chapter: 2000-5000 words)
- Do NOT invent market data
- Return ONLY valid JSON`;

const SOFTWARE_SYSTEM_PROMPT = `You are a Product Architect specializing in software and SaaS products.
Design the architecture for the given software product.
Return a JSON object with:
- architecture: string (high-level architecture description)
- components: array of {name, type, description, dependencies}
- dependencies: array of strings
- constraints: array of strings
- estimatedDuration: string
- technologyStack: array of strings
- modules: array of {name, responsibility, interfaces[], dependencies[]}
- apis: array of {name, method, path, description}
- dataModels: array of {name, fields[], relationships[]}
- integrations: array of strings

Rules:
- Design modular, maintainable architecture
- Include clear API definitions
- Define data models with relationships
- Be realistic about timeline
- Do NOT invent market data
- Return ONLY valid JSON`;

const TEMPLATE_SYSTEM_PROMPT = `You are a Product Architect specializing in templates.
Design the architecture for the given template product.
Return a JSON object with:
- architecture: string
- components: array of {name, type, description, dependencies}
- dependencies: array of strings
- constraints: array of strings (include customization points)
- estimatedDuration: string
- technologyStack: array of strings

Rules:
- Define template file structure
- Include customization points in constraints
- Be realistic about scope
- Return ONLY valid JSON`;

const KIT_SYSTEM_PROMPT = `You are a Product Architect specializing in product kits and bundles.
Design the architecture for the given kit product.
Return a JSON object with:
- architecture: string
- components: array of {name, type, description, dependencies}
- dependencies: array of strings (assembly order)
- constraints: array of strings
- estimatedDuration: string
- technologyStack: array of strings

Rules:
- Define each kit component clearly
- Specify assembly order in dependencies
- Include all necessary parts
- Return ONLY valid JSON`;

// ─── Prompt Builders ──────────────────────────────────────────────────────────

function buildBookPrompt(
  type: string,
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): string {
  return `Design a ${type} architecture for:

Title: ${title}
Description: ${description}
Fit Score: ${fitScore.overall}
Problem: ${fitScore.reasoning}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Provide a complete book architecture with chapter structure, word counts, and art direction.`;
}

function buildSoftwarePrompt(
  type: string,
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): string {
  return `Design a ${type} architecture for:

Title: ${title}
Description: ${description}
Fit Score: ${fitScore.overall}
Problem: ${fitScore.reasoning}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Provide a complete software architecture with modules, APIs, and data models.`;
}

function buildTemplatePrompt(
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): string {
  return `Design a template architecture for:

Title: ${title}
Description: ${description}
Fit Score: ${fitScore.overall}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Provide a complete template architecture with file structure and customization points.`;
}

function buildKitPrompt(
  title: string,
  description: string,
  fitScore: FitScore,
  additionalContext?: string
): string {
  return `Design a kit architecture for:

Title: ${title}
Description: ${description}
Fit Score: ${fitScore.overall}
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Provide a complete kit architecture with components and assembly instructions.`;
}

// ─── Fallbacks ────────────────────────────────────────────────────────────────

function createFallbackArchitecture(
  productType: string,
  title: string,
  error: string
): ProductArchitecture {
  return {
    productType: productType as any,
    architecture: `Fallback architecture for ${title}`,
    components: [],
    dependencies: [],
    constraints: [`Architecture generation failed: ${error}`],
    estimatedDuration: "Unknown",
    technologyStack: [],
    evidence: "NOT_VERIFIED",
  };
}

function createFallbackBookArchitecture(
  productType: "ebook" | "guide",
  title: string,
  error: string
): BookArchitecture {
  return {
    ...createFallbackArchitecture(productType, title, error),
    productType,
    chapters: [],
    totalWordCount: 0,
    artDirection: "",
    format: "pdf",
  };
}

function createFallbackSoftwareArchitecture(
  productType: "software" | "saas",
  title: string,
  error: string
): SoftwareArchitecture {
  return {
    ...createFallbackArchitecture(productType, title, error),
    productType,
    modules: [],
    apis: [],
    dataModels: [],
    integrations: [],
    handoffReady: false,
  };
}

function createFallbackTemplateArchitecture(
  title: string,
  error: string
): TemplateArchitecture {
  return {
    ...createFallbackArchitecture("template", title, error),
    productType: "template",
    files: [],
    customizationPoints: [],
  };
}

function createFallbackKitArchitecture(
  title: string,
  error: string
): KitArchitecture {
  return {
    ...createFallbackArchitecture("kit", title, error),
    productType: "kit",
    kitComponents: [],
    assemblyInstructions: [],
  };
}
