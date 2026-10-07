/**
 * Product Economics — Product Brain Module
 *
 * Economic analysis for products: cost estimates, revenue estimates,
 * timeline, and risk factors.
 *
 * CRITICAL: NEVER present estimated market data as VERIFIED.
 * All market benchmarks, revenue projections, and unit estimates
 * MUST be tagged as ESTIMATED or INFERRED.
 * Only directly observed costs (e.g., infrastructure bills) can be VERIFIED.
 *
 * Uses ZAI SDK for market-informed estimation, but always tags as ESTIMATED.
 */

import ZAI from "z-ai-web-dev-sdk";
import { z } from "zod";
import { parseStructuredResponse } from "@/lib/structured-output";
import type { EvidenceTag } from "@/lib/product-fit";
import type { ProductArchitecture } from "@/lib/product-architecture";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CostEstimate {
  development: number;
  production: number;
  marketing: number;
  total: number;
  currency: string;
  evidence: EvidenceTag;
}

export interface RevenueEstimate {
  pricePerUnit: number;
  estimatedUnits: number;
  estimatedTotal: number;
  currency: string;
  evidence: EvidenceTag; // ALWAYS ESTIMATED or INFERRED
}

export interface RiskFactor {
  description: string;
  probability: number; // 0-1
  impact: number; // 0-1
  mitigation: string;
}

export interface ProductEconomics {
  productId: string;
  estimatedCost: CostEstimate;
  estimatedRevenue: RevenueEstimate;
  estimatedTimeline: string;
  riskFactors: RiskFactor[];
  evidence: EvidenceTag; // MUST be ESTIMATED or INFERRED for market data
}

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const riskFactorSchema = z.object({
  description: z.string(),
  probability: z.number().min(0).max(1),
  impact: z.number().min(0).max(1),
  mitigation: z.string(),
});

const economicsResponseSchema = z.object({
  developmentCost: z.number().nonnegative(),
  productionCost: z.number().nonnegative(),
  marketingCost: z.number().nonnegative(),
  pricePerUnit: z.number().positive(),
  estimatedUnits: z.number().positive(),
  riskFactors: z.array(riskFactorSchema),
  timelineEstimate: z.string(),
});

// ─── ZAI Adapter ──────────────────────────────────────────────────────────────

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ─── Cost Benchmarks (Conservative Estimates) ─────────────────────────────────

/**
 * Conservative cost benchmarks by product type.
 * These are ESTIMATED values based on industry knowledge,
 * NOT verified market data.
 */
const COST_BENCHMARKS: Record<string, { devMin: number; devMax: number; prodMin: number; prodMax: number; mktMin: number; mktMax: number; priceMin: number; priceMax: number; unitsMin: number; unitsMax: number }> = {
  ebook: { devMin: 500, devMax: 3000, prodMin: 50, prodMax: 200, mktMin: 100, mktMax: 500, priceMin: 9, priceMax: 49, unitsMin: 50, unitsMax: 500 },
  guide: { devMin: 300, devMax: 1500, prodMin: 30, prodMax: 100, mktMin: 50, mktMax: 300, priceMin: 5, priceMax: 29, unitsMin: 30, unitsMax: 300 },
  software: { devMin: 3000, devMax: 50000, prodMin: 500, prodMax: 5000, mktMin: 500, mktMax: 5000, priceMin: 19, priceMax: 199, unitsMin: 10, unitsMax: 1000 },
  saas: { devMin: 5000, devMax: 100000, prodMin: 1000, prodMax: 10000, mktMin: 1000, mktMax: 10000, priceMin: 9, priceMax: 99, unitsMin: 10, unitsMax: 500 },
  template: { devMin: 100, devMax: 1000, prodMin: 10, prodMax: 50, mktMin: 20, mktMax: 200, priceMin: 5, priceMax: 49, unitsMin: 20, unitsMax: 500 },
  kit: { devMin: 500, devMax: 5000, prodMin: 100, prodMax: 1000, mktMin: 100, mktMax: 1000, priceMin: 19, priceMax: 99, unitsMin: 10, unitsMax: 200 },
};

const DEFAULT_CURRENCY = "USD";

// ─── Core Functions ───────────────────────────────────────────────────────────

/**
 * Analyze product economics based on architecture.
 *
 * IMPORTANT: All returned estimates are tagged as ESTIMATED or INFERRED.
 * We NEVER claim market data is VERIFIED unless we have actual receipts/data.
 */
export async function analyzeProductEconomics(
  productId: string,
  architecture: ProductArchitecture,
  currency?: string
): Promise<ProductEconomics> {
  const ccy = currency || DEFAULT_CURRENCY;

  try {
    const zai = await getZAI();
    const prompt = buildEconomicsPrompt(architecture);

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: ECONOMICS_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content || "";
    const parseResult = parseStructuredResponse(content, economicsResponseSchema);

    if (!parseResult.success) {
      console.error("[ProductEconomics] Parse failed:", parseResult.error);
      return createHeuristicEconomics(productId, architecture, ccy);
    }

    const data = parseResult.data;

    // Validate against benchmarks — if LLM returns unrealistic values, cap them
    const benchmark = COST_BENCHMARKS[architecture.productType] || COST_BENCHMARKS.ebook;
    const dev = capToBenchmark(data.developmentCost, benchmark.devMin, benchmark.devMax * 3);
    const prod = capToBenchmark(data.productionCost, benchmark.prodMin, benchmark.prodMax * 3);
    const mkt = capToBenchmark(data.marketingCost, benchmark.mktMin, benchmark.mktMax * 3);
    const price = capToBenchmark(data.pricePerUnit, benchmark.priceMin, benchmark.priceMax * 3);
    const units = Math.round(capToBenchmark(data.estimatedUnits, benchmark.unitsMin, benchmark.unitsMax * 3));

    const totalCost = dev + prod + mkt;

    return {
      productId,
      estimatedCost: {
        development: dev,
        production: prod,
        marketing: mkt,
        total: totalCost,
        currency: ccy,
        evidence: "ESTIMATED", // Never VERIFIED — these are LLM estimates
      },
      estimatedRevenue: {
        pricePerUnit: price,
        estimatedUnits: units,
        estimatedTotal: price * units,
        currency: ccy,
        evidence: "ESTIMATED", // ALWAYS ESTIMATED for market projections
      },
      estimatedTimeline: data.timelineEstimate,
      riskFactors: data.riskFactors,
      evidence: "INFERRED", // LLM-inferred, never VERIFIED
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ProductEconomics] Analysis error:", message);
    return createHeuristicEconomics(productId, architecture, ccy);
  }
}

/**
 * Quick heuristic economics estimate without LLM.
 * Based on product type benchmarks.
 * Returns ESTIMATED values — never VERIFIED.
 */
export function quickEconomicsEstimate(
  productId: string,
  productType: string,
  currency?: string
): ProductEconomics {
  const ccy = currency || DEFAULT_CURRENCY;
  const benchmark = COST_BENCHMARKS[productType] || COST_BENCHMARKS.ebook;

  // Use midpoints of benchmark ranges
  const dev = (benchmark.devMin + benchmark.devMax) / 2;
  const prod = (benchmark.prodMin + benchmark.prodMax) / 2;
  const mkt = (benchmark.mktMin + benchmark.mktMax) / 2;
  const price = (benchmark.priceMin + benchmark.priceMax) / 2;
  const units = (benchmark.unitsMin + benchmark.unitsMax) / 2;
  const totalCost = dev + prod + mkt;

  return {
    productId,
    estimatedCost: {
      development: Math.round(dev),
      production: Math.round(prod),
      marketing: Math.round(mkt),
      total: Math.round(totalCost),
      currency: ccy,
      evidence: "ESTIMATED",
    },
    estimatedRevenue: {
      pricePerUnit: Math.round(price * 100) / 100,
      estimatedUnits: Math.round(units),
      estimatedTotal: Math.round(price * units),
      currency: ccy,
      evidence: "ESTIMATED",
    },
    estimatedTimeline: "Estimated — run full analysis for details",
    riskFactors: [
      {
        description: "Revenue estimates are based on industry benchmarks, not verified market data",
        probability: 1.0,
        impact: 0.7,
        mitigation: "Validate with real market research before committing resources",
      },
    ],
    evidence: "ESTIMATED",
  };
}

/**
 * Calculate ROI from economics.
 * Returns undefined if cost is zero (avoid division by zero).
 */
export function calculateROI(economics: ProductEconomics): number | undefined {
  if (economics.estimatedCost.total === 0) return undefined;
  const roi = (economics.estimatedRevenue.estimatedTotal - economics.estimatedCost.total) / economics.estimatedCost.total;
  return Math.round(roi * 100) / 100;
}

/**
 * Calculate break-even units.
 * Returns undefined if price per unit is zero.
 */
export function calculateBreakEvenUnits(economics: ProductEconomics): number | undefined {
  if (economics.estimatedRevenue.pricePerUnit === 0) return undefined;
  return Math.ceil(economics.estimatedCost.total / economics.estimatedRevenue.pricePerUnit);
}

/**
 * Assess overall financial risk based on economics.
 */
export function assessFinancialRisk(economics: ProductEconomics): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const roi = calculateROI(economics);
  const riskScore = economics.riskFactors.reduce(
    (sum, rf) => sum + rf.probability * rf.impact,
    0
  );

  if (roi !== undefined && roi < -0.5) return "CRITICAL";
  if (riskScore > 1.5 || (roi !== undefined && roi < 0)) return "HIGH";
  if (riskScore > 0.8 || (roi !== undefined && roi < 0.5)) return "MEDIUM";
  return "LOW";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ECONOMICS_SYSTEM_PROMPT = `You are a Product Economics Analyst for KREA (Product Architect Agent).
Analyze the economics of the product based on its architecture.
Return a JSON object with:
- developmentCost: number (in USD, estimated)
- productionCost: number (in USD, per production run/hosting)
- marketingCost: number (in USD, estimated for launch)
- pricePerUnit: number (in USD, suggested price)
- estimatedUnits: number (estimated units sold in first year)
- riskFactors: array of {description, probability (0-1), impact (0-1), mitigation}
- timelineEstimate: string

CRITICAL RULES:
- ALL numbers are ESTIMATES, not verified data
- Be CONSERVATIVE with revenue estimates
- Be REALISTIC with cost estimates
- Include risk factors for market uncertainty
- Do NOT claim any market data is verified
- Return ONLY valid JSON`;

function buildEconomicsPrompt(architecture: ProductArchitecture): string {
  const componentsSummary = architecture.components
    .map((c) => `  - ${c.name} (${c.type})`)
    .join("\n");

  const benchmark = COST_BENCHMARKS[architecture.productType];
  const benchmarkHint = benchmark
    ? `\nConservative benchmark ranges for ${architecture.productType}:
  - Dev cost: $${benchmark.devMin}-$${benchmark.devMax}
  - Production: $${benchmark.prodMin}-$${benchmark.prodMax}
  - Marketing: $${benchmark.mktMin}-$${benchmark.mktMax}
  - Price: $${benchmark.priceMin}-$${benchmark.priceMax}
  - Units (first year): ${benchmark.unitsMin}-${benchmark.unitsMax}`
    : "";

  return `Analyze the economics for:

Product Type: ${architecture.productType}
Architecture: ${architecture.architecture}
Components:
${componentsSummary}
Dependencies: ${architecture.dependencies.join(", ") || "none"}
Estimated Duration: ${architecture.estimatedDuration}
Technology Stack: ${architecture.technologyStack.join(", ") || "none"}
${benchmarkHint}

Provide realistic economic estimates. Be conservative.`;
}

function capToBenchmark(value: number, min: number, max: number): number {
  // If value is wildly outside benchmark range (10x), cap it
  const upperCap = max * 5;
  if (value > upperCap) return max;
  if (value < min * 0.1) return min;
  return value;
}

function createHeuristicEconomics(
  productId: string,
  architecture: ProductArchitecture,
  currency: string
): ProductEconomics {
  const quick = quickEconomicsEstimate(productId, architecture.productType, currency);

  return {
    ...quick,
    riskFactors: [
      ...quick.riskFactors,
      {
        description: "Full LLM analysis failed — using heuristic estimates only",
        probability: 1.0,
        impact: 0.5,
        mitigation: "Re-run full analysis when LLM is available",
      },
    ],
    evidence: "ESTIMATED",
  };
}
