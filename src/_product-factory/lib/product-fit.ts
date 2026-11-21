/**
 * Product Fit — Product Brain Module
 *
 * Evaluates whether a product opportunity is viable by analyzing
 * market existence, audience clarity, problem validity,
 * differentiation, and feasibility.
 *
 * Uses ZAI SDK for LLM-based analysis.
 * All LLM-derived data is tagged as INFERRED (never fake as VERIFIED).
 * Parse responses with structured validation (NOT regex).
 */

import ZAI from "z-ai-web-dev-sdk";
import { z } from "zod";
import { parseStructuredResponse } from "@/lib/structured-output";

// ─── Evidence Tag ─────────────────────────────────────────────────────────────

export type EvidenceTag = "VERIFIED" | "INFERRED" | "ESTIMATED" | "NOT_VERIFIED" | "UNKNOWN";

// ─── Input Types ──────────────────────────────────────────────────────────────

export interface ProductOpportunityInput {
  title: string;
  description: string;
  targetAudience: string;
  domain: string; // "ebook" | "software" | "saas" | "guide" | "template" | "kit"
  problemStatement: string;
  existingAlternatives?: string[];
}

// ─── Output Types ─────────────────────────────────────────────────────────────

export interface FitScore {
  overall: number; // 0-1
  marketExistence: number; // 0-1
  audienceClarity: number; // 0-1
  problemValidity: number; // 0-1
  differentiation: number; // 0-1
  feasibility: number; // 0-1
  evidence: EvidenceTag;
  reasoning: string;
  recommendation: "PROCEED" | "EXPLORE" | "SKIP" | "RESEARCH_MORE";
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const fitScoreResponseSchema = z.object({
  marketExistence: z.number().min(0).max(1),
  audienceClarity: z.number().min(0).max(1),
  problemValidity: z.number().min(0).max(1),
  differentiation: z.number().min(0).max(1),
  feasibility: z.number().min(0).max(1),
  reasoning: z.string().min(10),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const VALID_DOMAINS = ["ebook", "software", "saas", "guide", "template", "kit"] as const;

const RECOMMENDATION_THRESHOLDS = {
  PROCEED: 0.7,
  EXPLORE: 0.5,
  RESEARCH_MORE: 0.3,
  // Below 0.3 → SKIP
} as const;

const MINIMUM_INDIVIDUAL_SCORE_FOR_PROCEED = 0.4;

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
 * Evaluate product fit for a given opportunity.
 *
 * Uses ZAI SDK to analyze the opportunity across five dimensions.
 * Returns a FitScore with recommendation.
 *
 * IMPORTANT: LLM-derived scores are marked as INFERRED,
 * never as VERIFIED. We do not invent market data.
 */
export async function evaluateProductFit(
  input: ProductOpportunityInput
): Promise<FitScore> {
  // Validate input
  const validation = validateOpportunityInput(input);
  if (!validation.valid) {
    return createFallbackFitScore(validation.error || "Validation failed", "NOT_VERIFIED");
  }

  try {
    const zai = await getZAI();
    const prompt = buildAnalysisPrompt(input);

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.choices[0]?.message?.content || "";

    // Parse with structured validation (NOT regex)
    const parseResult = parseStructuredResponse(content, fitScoreResponseSchema);

    if (!parseResult.success) {
      console.error("[ProductFit] LLM response parse failed:", parseResult.error);
      return createFallbackFitScore(
        `LLM analysis failed: ${parseResult.error}`,
        "NOT_VERIFIED"
      );
    }

    const data = parseResult.data;

    // Compute overall score (weighted average)
    const overall = computeOverallScore(data);

    // Determine recommendation
    const recommendation = determineRecommendation(overall, data);

    return {
      overall: roundScore(overall),
      marketExistence: roundScore(data.marketExistence),
      audienceClarity: roundScore(data.audienceClarity),
      problemValidity: roundScore(data.problemValidity),
      differentiation: roundScore(data.differentiation),
      feasibility: roundScore(data.feasibility),
      evidence: "INFERRED", // LLM-derived, never VERIFIED for market data
      reasoning: data.reasoning,
      recommendation,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ProductFit] Evaluation error:", message);
    return createFallbackFitScore(`Evaluation error: ${message}`, "NOT_VERIFIED");
  }
}

/**
 * Quick heuristic fit check without LLM — for fast pre-screening.
 * Returns ESTIMATED scores based on input quality heuristics.
 */
export function quickFitCheck(input: ProductOpportunityInput): FitScore {
  const marketExistence = estimateFromInput(input.description, 0.3);
  const audienceClarity = estimateFromInput(input.targetAudience, 0.4);
  const problemValidity = estimateFromInput(input.problemStatement, 0.3);
  const differentiation = input.existingAlternatives && input.existingAlternatives.length > 0
    ? Math.min(0.7, 0.3 + input.existingAlternatives.length * 0.05)
    : 0.3;
  const feasibility = estimateFromInput(input.description, 0.4);

  const overall = computeOverallScore({
    marketExistence,
    audienceClarity,
    problemValidity,
    differentiation,
    feasibility,
  });

  const recommendation = determineRecommendation(overall, {
    marketExistence,
    audienceClarity,
    problemValidity,
    differentiation,
    feasibility,
  });

  return {
    overall: roundScore(overall),
    marketExistence: roundScore(marketExistence),
    audienceClarity: roundScore(audienceClarity),
    problemValidity: roundScore(problemValidity),
    differentiation: roundScore(differentiation),
    feasibility: roundScore(feasibility),
    evidence: "ESTIMATED",
    reasoning: "Quick heuristic estimate based on input quality. Run full evaluateProductFit() for accurate analysis.",
    recommendation,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a Product Fit Analyst for KREA (Product Architect Agent).
Analyze the product opportunity and return a JSON object with these fields:
- marketExistence: number 0-1 (does a real market exist for this?)
- audienceClarity: number 0-1 (is the target audience well-defined?)
- problemValidity: number 0-1 (is the problem real and worth solving?)
- differentiation: number 0-1 (can this product differentiate from alternatives?)
- feasibility: number 0-1 (is this feasible to build and deliver?)
- reasoning: string (detailed explanation of your analysis, minimum 10 characters)

IMPORTANT RULES:
- Base scores ONLY on the information provided
- Do NOT invent market data, statistics, or benchmarks
- If you lack information, score conservatively (lower)
- Be honest about uncertainty — it is better to score low than to guess high
- Return ONLY valid JSON, no markdown formatting around it`;

function buildAnalysisPrompt(input: ProductOpportunityInput): string {
  const alternatives = input.existingAlternatives && input.existingAlternatives.length > 0
    ? `Existing alternatives: ${input.existingAlternatives.join(", ")}`
    : "No existing alternatives specified.";

  return `Analyze this product opportunity:

Title: ${input.title}
Domain: ${input.domain}
Description: ${input.description}
Target Audience: ${input.targetAudience}
Problem Statement: ${input.problemStatement}
${alternatives}

Return your analysis as a JSON object with: marketExistence, audienceClarity, problemValidity, differentiation, feasibility, reasoning.`;
}

function validateOpportunityInput(input: ProductOpportunityInput): { valid: boolean; error?: string } {
  if (!input.title || input.title.trim().length < 3) {
    return { valid: false, error: "Title must be at least 3 characters" };
  }
  if (!input.description || input.description.trim().length < 10) {
    return { valid: false, error: "Description must be at least 10 characters" };
  }
  if (!input.targetAudience || input.targetAudience.trim().length < 3) {
    return { valid: false, error: "Target audience must be at least 3 characters" };
  }
  if (!VALID_DOMAINS.includes(input.domain as any)) {
    return { valid: false, error: `Domain must be one of: ${VALID_DOMAINS.join(", ")}` };
  }
  if (!input.problemStatement || input.problemStatement.trim().length < 5) {
    return { valid: false, error: "Problem statement must be at least 5 characters" };
  }
  return { valid: true };
}

function computeOverallScore(scores: {
  marketExistence: number;
  audienceClarity: number;
  problemValidity: number;
  differentiation: number;
  feasibility: number;
}): number {
  // Weighted average — problem validity and audience clarity matter most
  const weights = {
    marketExistence: 0.20,
    audienceClarity: 0.25,
    problemValidity: 0.25,
    differentiation: 0.15,
    feasibility: 0.15,
  };

  return (
    weights.marketExistence * scores.marketExistence +
    weights.audienceClarity * scores.audienceClarity +
    weights.problemValidity * scores.problemValidity +
    weights.differentiation * scores.differentiation +
    weights.feasibility * scores.feasibility
  );
}

function determineRecommendation(
  overall: number,
  scores: {
    marketExistence: number;
    audienceClarity: number;
    problemValidity: number;
    differentiation: number;
    feasibility: number;
  }
): FitScore["recommendation"] {
  const allScores = [
    scores.marketExistence,
    scores.audienceClarity,
    scores.problemValidity,
    scores.differentiation,
    scores.feasibility,
  ];

  const hasAnyBelowThreshold = allScores.some((s) => s < MINIMUM_INDIVIDUAL_SCORE_FOR_PROCEED);
  const hasAnyCritical = allScores.some((s) => s < 0.3);

  if (overall >= RECOMMENDATION_THRESHOLDS.PROCEED && !hasAnyBelowThreshold) {
    return "PROCEED";
  }

  if (hasAnyCritical) {
    return "SKIP";
  }

  if (overall >= RECOMMENDATION_THRESHOLDS.EXPLORE) {
    return "EXPLORE";
  }

  if (overall >= RECOMMENDATION_THRESHOLDS.RESEARCH_MORE) {
    return "RESEARCH_MORE";
  }

  return "SKIP";
}

function estimateFromInput(text: string, base: number): number {
  if (!text || text.trim().length === 0) return base * 0.5;
  // Simple heuristic: more detailed input → higher score
  const lengthFactor = Math.min(1, text.length / 200);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const specificityFactor = Math.min(1, wordCount / 50);
  return Math.min(0.8, base + lengthFactor * 0.3 + specificityFactor * 0.2);
}

function createFallbackFitScore(reason: string, evidence: EvidenceTag): FitScore {
  return {
    overall: 0,
    marketExistence: 0,
    audienceClarity: 0,
    problemValidity: 0,
    differentiation: 0,
    feasibility: 0,
    evidence,
    reasoning: `Evaluation could not be completed: ${reason}`,
    recommendation: "SKIP",
  };
}

function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}
