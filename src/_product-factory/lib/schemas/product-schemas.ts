import { z } from "zod";

// Base evidence tag enum
export const EvidenceTagSchema = z.enum([
  "VERIFIED",
  "INFERRED",
  "ESTIMATED",
  "NOT_VERIFIED",
  "UNKNOWN",
]);

// Product Fit Score
export const FitScoreSchema = z.object({
  overall: z.number().min(0).max(1),
  marketExistence: z.number().min(0).max(1),
  audienceClarity: z.number().min(0).max(1),
  problemValidity: z.number().min(0).max(1),
  differentiation: z.number().min(0).max(1),
  feasibility: z.number().min(0).max(1),
  evidence: EvidenceTagSchema,
  reasoning: z.string().min(10),
  recommendation: z.enum(["PROCEED", "EXPLORE", "SKIP", "RESEARCH_MORE"]),
});

// Product Decision
export const ProductDecisionSchema = z.object({
  decision: z.enum(["GO", "NO_GO", "CONDITIONAL_GO"]),
  conditions: z.array(z.string()),
  rationale: z.string().min(10),
  fitScore: FitScoreSchema,
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  estimatedEffort: z.string(),
  evidence: EvidenceTagSchema,
});

// Architecture Component
export const ArchitectureComponentSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  dependencies: z.array(z.string()),
});

// Product Architecture
export const ProductArchitectureSchema = z.object({
  productType: z.enum(["ebook", "software", "saas", "guide", "template", "kit"]),
  architecture: z.string(),
  components: z.array(ArchitectureComponentSchema),
  dependencies: z.array(z.string()),
  constraints: z.array(z.string()),
  estimatedDuration: z.string(),
  technologyStack: z.array(z.string()),
  evidence: EvidenceTagSchema,
});

// Chapter Specification (for eBooks)
export const ChapterSpecSchema = z.object({
  index: z.number().int().min(0),
  title: z.string(),
  synopsis: z.string(),
  targetWords: z.number().int().positive(),
  content: z.string().optional(),
});

// Acceptance Criterion
export const AcceptanceCriterionSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(["functional", "non_functional", "quality", "performance"]),
  measurable: z.boolean(),
  threshold: z.string().optional(),
});

// Product Specification
export const ProductSpecificationSchema = z.object({
  productId: z.string(),
  version: z.string(),
  productType: z.enum(["ebook", "software", "saas", "guide", "template", "kit"]),
  architecture: ProductArchitectureSchema,
  chapters: z.array(ChapterSpecSchema).optional(),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  constraints: z.array(z.string()),
  evidence: EvidenceTagSchema,
});

// Risk Factor
export const RiskFactorSchema = z.object({
  description: z.string(),
  probability: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
  mitigation: z.string(),
});

// Cost Estimate
export const CostEstimateSchema = z.object({
  development: z.number().nonnegative(),
  production: z.number().nonnegative(),
  marketing: z.number().nonnegative(),
  total: z.number().nonnegative(),
  currency: z.string().default("USD"),
  evidence: EvidenceTagSchema,
});

// Revenue Estimate
export const RevenueEstimateSchema = z.object({
  pricePerUnit: z.number().positive(),
  estimatedUnits: z.number().positive(),
  estimatedTotal: z.number().positive(),
  currency: z.string().default("USD"),
  evidence: EvidenceTagSchema,
});

// Product Economics
export const ProductEconomicsSchema = z.object({
  productId: z.string(),
  estimatedCost: CostEstimateSchema,
  estimatedRevenue: RevenueEstimateSchema,
  estimatedTimeline: z.string(),
  riskFactors: z.array(RiskFactorSchema),
  evidence: EvidenceTagSchema,
});

// Handoff Status
export const HandoffStatusSchema = z.enum([
  "CREATED",
  "READY",
  "SENT",
  "ACKNOWLEDGED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

// Handoff Contract
export const HandoffContractSchema = z.object({
  handoffId: z.string(),
  sourceAgent: z.literal("KREA"),
  targetProvider: z.string(),
  objective: z.string(),
  productId: z.string(),
  productVersion: z.string(),
  specification: ProductSpecificationSchema,
  constraints: z.array(z.string()),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema),
  dependencies: z.array(z.string()),
  risk: z.array(RiskFactorSchema),
  autonomy: z.enum(["SUPERVISED", "SEMI_AUTONOMOUS", "AUTONOMOUS"]),
  status: HandoffStatusSchema,
  deliveryAttempts: z.number().int().nonnegative(),
  error: z.string().nullable(),
  externalSendStatus: z
    .enum(["VERIFIED", "NOT_VERIFIED", "NOT_AVAILABLE"])
    .default("NOT_VERIFIED"),
});

// Dossier Status
export const DossierStatusSchema = z.enum([
  "IDEA",
  "RESEARCHING",
  "EVALUATING",
  "DECIDING",
  "ARCHITECTING",
  "SPECIFYING",
  "PRODUCING",
  "QA",
  "REVISION",
  "PUBLISHED",
  "ARCHIVED",
  "FAILED",
]);

// Type exports
export type EvidenceTag = z.infer<typeof EvidenceTagSchema>;
export type FitScore = z.infer<typeof FitScoreSchema>;
export type ProductDecision = z.infer<typeof ProductDecisionSchema>;
export type ArchitectureComponent = z.infer<typeof ArchitectureComponentSchema>;
export type ProductArchitecture = z.infer<typeof ProductArchitectureSchema>;
export type ChapterSpec = z.infer<typeof ChapterSpecSchema>;
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;
export type ProductSpecification = z.infer<typeof ProductSpecificationSchema>;
export type RiskFactor = z.infer<typeof RiskFactorSchema>;
export type CostEstimate = z.infer<typeof CostEstimateSchema>;
export type RevenueEstimate = z.infer<typeof RevenueEstimateSchema>;
export type ProductEconomics = z.infer<typeof ProductEconomicsSchema>;
export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;
export type HandoffContract = z.infer<typeof HandoffContractSchema>;
export type DossierStatus = z.infer<typeof DossierStatusSchema>;
