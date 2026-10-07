/**
 * Product Economics — KREA V2 Product Brain
 *
 * Financial analysis and economic viability assessment for products.
 * Economics must influence the BUILD/VALIDATE/DO_NOT_BUILD decision.
 *
 * Acceptance Criteria satisfied:
 *   AC-047: Economics must influence BUILD/VALIDATE/DO_NOT_BUILD decision
 *
 * Provides:
 *   - Cost estimation (production, tools, providers)
 *   - Margin calculation
 *   - Risk assessment (economic risks)
 *   - Decision influence (economic_recommendation)
 */

import { ProductArchitecture, MoscowItem } from "./product-architecture";
import { ProductDecision, ProductDecisionType } from "./product-decision";
import { FitResult, FitDecision } from "./product-fit";
import { ProductEvidence } from "./product-intelligence";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Complete economics estimate */
export interface EconomicsEstimate {
  /** One-time estimated cost to produce */
  estimated_cost: number;
  /** Ongoing monthly production cost */
  production_cost: number;
  /** Monthly tools/services cost */
  tools_cost: number;
  /** Monthly provider/API cost */
  provider_cost: number;
  /** Suggested price (one-time or monthly) */
  suggested_price: number;
  /** Profit margin (0-1) */
  margin: number;
  /** Monetization potential (0-1) */
  monetization_potential: number;
  /** Price sensitivity (0-1, higher = more sensitive = harder to charge) */
  price_sensitivity: number;
  /** Economic risks */
  economic_risks: EconomicRisk[];
  /** Currency */
  currency: string;
  /** Pricing model */
  pricing_model: PricingModel;
  /** Break-even estimate */
  break_even: {
    /** Units needed to break even */
    units: number;
    /** Time to break even */
    time: string;
    /** Assumptions */
    assumptions: string[];
  };
}

/** Economic risk */
export interface EconomicRisk {
  /** Risk description */
  description: string;
  /** Severity (0-1) */
  severity: number;
  /** Probability (0-1) */
  probability: number;
  /** Impact (severity * probability) */
  impact: number;
  /** Mitigation */
  mitigation: string;
}

/** Pricing model */
export type PricingModel =
  | "one_time"
  | "subscription_monthly"
  | "subscription_annual"
  | "freemium"
  | "usage_based"
  | "marketplace"
  | "ad_supported"
  | "unknown";

/** Economic recommendation for the decision */
export interface EconomicRecommendation {
  /** Recommended decision influenced by economics (AC-047) */
  recommendation: "BUILD" | "VALIDATE_FIRST" | "DO_NOT_BUILD";
  /** Why economics suggests this (AC-010 — no magic numbers) */
  reason: string;
  /** Economic score (0-1) */
  economicScore: number;
  /** Key factors that influenced the recommendation */
  factors: {
    name: string;
    value: number;
    weight: number;
    contribution: string;
  }[];
}

// ─── Cost Benchmarks ─────────────────────────────────────────────────────────

/**
 * Estimated costs by product format.
 * These are NOT magic numbers — they represent typical market costs
 * for producing digital products of each type.
 */
const FORMAT_COSTS: Record<string, {
  production: number;     // One-time production cost
  monthlyTools: number;   // Monthly tool/service costs
  monthlyProvider: number; // Monthly provider/API costs
  suggestedPrice: number;  // Typical market price
  pricingModel: PricingModel;
}> = {
  // Content products
  ebook:       { production: 200, monthlyTools: 20, monthlyProvider: 0, suggestedPrice: 29, pricingModel: "one_time" },
  guía:        { production: 200, monthlyTools: 20, monthlyProvider: 0, suggestedPrice: 29, pricingModel: "one_time" },
  guide:       { production: 200, monthlyTools: 20, monthlyProvider: 0, suggestedPrice: 29, pricingModel: "one_time" },
  workbook:    { production: 300, monthlyTools: 20, monthlyProvider: 0, suggestedPrice: 39, pricingModel: "one_time" },
  template:    { production: 150, monthlyTools: 20, monthlyProvider: 0, suggestedPrice: 19, pricingModel: "one_time" },
  checklist:   { production: 100, monthlyTools: 10, monthlyProvider: 0, suggestedPrice: 9, pricingModel: "one_time" },
  course:      { production: 500, monthlyTools: 50, monthlyProvider: 20, suggestedPrice: 97, pricingModel: "one_time" },
  curso:       { production: 500, monthlyTools: 50, monthlyProvider: 20, suggestedPrice: 97, pricingModel: "one_time" },

  // Software products
  app:         { production: 5000, monthlyTools: 100, monthlyProvider: 50, suggestedPrice: 19, pricingModel: "subscription_monthly" },
  "web app":   { production: 5000, monthlyTools: 100, monthlyProvider: 50, suggestedPrice: 19, pricingModel: "subscription_monthly" },
  saas:        { production: 10000, monthlyTools: 200, monthlyProvider: 100, suggestedPrice: 29, pricingModel: "subscription_monthly" },
  platform:    { production: 20000, monthlyTools: 500, monthlyProvider: 200, suggestedPrice: 49, pricingModel: "subscription_monthly" },
  api:         { production: 8000, monthlyTools: 100, monthlyProvider: 150, suggestedPrice: 0.01, pricingModel: "usage_based" },

  // Hybrid products
  "landing page": { production: 500, monthlyTools: 30, monthlyProvider: 10, suggestedPrice: 0, pricingModel: "ad_supported" },
  tool:       { production: 3000, monthlyTools: 50, monthlyProvider: 30, suggestedPrice: 9, pricingModel: "freemium" },

  // Default
  default:    { production: 1000, monthlyTools: 50, monthlyProvider: 20, suggestedPrice: 19, pricingModel: "unknown" },
};

// ─── Product Economics ────────────────────────────────────────────────────────

/**
 * ProductEconomics — Financial analysis and economic viability.
 *
 * AC-047: Economics MUST influence the BUILD/VALIDATE/DO_NOT_BUILD decision.
 *%         This is not a passive calculation — the economic recommendation
 *         directly modifies the product decision.
 */
export class ProductEconomics {
  /**
   * estimate — Generate a complete economics estimate.
   *
   * Uses product format, architecture scope, and evidence to estimate
   * costs, pricing, margins, and economic risks.
   */
  estimate(
    architecture: ProductArchitecture,
    decision: ProductDecision,
    evidence: ProductEvidence[] = []
  ): EconomicsEstimate {
    const format = architecture.format.toLowerCase();

    // Get format-specific cost benchmarks
    const benchmarks = this.getFormatBenchmarks(format);

    // Adjust production cost based on MUST items
    const mustCount = architecture.MUST.length;
    const shouldCount = architecture.SHOULD.length;
    const productionCostAdjustment = 1 + (mustCount - 1) * 0.15 + shouldCount * 0.05;

    const estimated_cost = Math.round(benchmarks.production * productionCostAdjustment);
    const tools_cost = benchmarks.monthlyTools;
    const provider_cost = benchmarks.monthlyProvider;
    const production_cost = tools_cost + provider_cost;

    // Pricing estimation
    const suggested_price = this.estimatePricing(benchmarks, evidence);
    const pricing_model = benchmarks.pricingModel;

    // Margin calculation
    const margin = this.calculateMargin(estimated_cost, suggested_price, pricing_model);

    // Monetization potential
    const monetization_potential = this.assessMonetizationPotential(
      suggested_price, margin, pricing_model, evidence
    );

    // Price sensitivity
    const price_sensitivity = this.assessPriceSensitivity(
      suggested_price, pricing_model, evidence
    );

    // Economic risks
    const economic_risks = this.assessRisk({
      estimated_cost,
      production_cost,
      suggested_price,
      margin,
      monetization_potential,
      price_sensitivity,
      pricing_model,
      currency: "USD",
      economic_risks: [],
      break_even: { units: 0, time: "", assumptions: [] },
    });

    // Break-even analysis
    const break_even = this.calculateBreakEven(
      estimated_cost, suggested_price, production_cost, pricing_model
    );

    return {
      estimated_cost,
      production_cost,
      tools_cost,
      provider_cost,
      suggested_price,
      margin,
      monetization_potential,
      price_sensitivity,
      economic_risks,
      currency: "USD",
      pricing_model,
      break_even,
    };
  }

  /**
   * calculateMargin — Calculate profit margin.
   *
   * For one-time products: margin = (price - cost) / price
   * For subscription: margin considers monthly revenue vs monthly cost over 12 months
   */
  calculateMargin(
    cost: number,
    price: number,
    pricingModel: PricingModel = "one_time"
  ): number {
    if (price <= 0) return 0;

    switch (pricingModel) {
      case "one_time":
        // Simple margin: (price - cost) / price
        return Math.max(0, (price - cost) / price);

      case "subscription_monthly":
      case "subscription_annual": {
        // Subscription margin: assume 12-month customer lifetime minimum
        const annualRevenue = pricingModel === "subscription_annual" ? price : price * 12;
        const annualCost = cost * 0.3; // Ongoing cost is ~30% of initial production
        return Math.max(0, (annualRevenue - annualCost) / annualRevenue);
      }

      case "freemium": {
        // Freemium: assume 5% conversion rate
        const effectiveRevenue = price * 0.05 * 12; // 5% pay monthly for 12 months
        const annualCost = cost * 0.3 + (cost * 0.7 / 20); // Spread initial + per-user cost
        return effectiveRevenue > 0 ? Math.max(0, (effectiveRevenue - annualCost) / effectiveRevenue) : 0;
      }

      case "usage_based":
        // Usage-based: assume 1000 API calls at price per call
        return Math.max(0, (price * 1000 - cost) / (price * 1000));

      default:
        return price > cost ? (price - cost) / price : 0;
    }
  }

  /**
   * assessRisk — Identify and assess economic risks.
   *
   * Returns risks with severity, probability, impact, and mitigation.
   */
  assessRisk(economics: EconomicsEstimate): EconomicRisk[] {
    const risks: EconomicRisk[] = [];

    // Low margin risk
    if (economics.margin < 0.2) {
      risks.push({
        description: `Low profit margin (${(economics.margin * 100).toFixed(1)}%) — vulnerable to cost overruns`,
        severity: 0.8,
        probability: 0.6,
        impact: 0.48,
        mitigation: "Reduce production cost or increase price; validate willingness to pay at higher price point",
      });
    }

    // High production cost risk
    if (economics.estimated_cost > 5000) {
      risks.push({
        description: `High production cost ($${economics.estimated_cost}) — significant investment at risk`,
        severity: 0.7,
        probability: 0.4,
        impact: 0.28,
        mitigation: "Phase the build to reduce upfront investment; validate demand before committing full budget",
      });
    }

    // High price sensitivity risk
    if (economics.price_sensitivity > 0.7) {
      risks.push({
        description: `High price sensitivity — audience may resist paying $${economics.suggested_price}`,
        severity: 0.6,
        probability: 0.7,
        impact: 0.42,
        mitigation: "Consider freemium model or lower entry price with upsells; validate pricing with conjoint analysis",
      });
    }

    // Low monetization potential
    if (economics.monetization_potential < 0.4) {
      risks.push({
        description: `Low monetization potential (${(economics.monetization_potential * 100).toFixed(1)}%) — may not generate sufficient revenue`,
        severity: 0.8,
        probability: 0.5,
        impact: 0.4,
        mitigation: "Explore alternative revenue models; consider product as lead magnet for higher-value offering",
      });
    }

    // Ongoing cost risk
    if (economics.production_cost > 100) {
      risks.push({
        description: `Significant ongoing costs ($${economics.production_cost}/month) — requires sustained revenue`,
        severity: 0.5,
        probability: 0.6,
        impact: 0.3,
        mitigation: "Minimize ongoing costs; negotiate provider pricing; consider serverless to reduce idle costs",
      });
    }

    // No pricing evidence
    risks.push({
      description: "Pricing estimates are based on benchmarks, not validated market data",
      severity: 0.4,
      probability: 0.8,
      impact: 0.32,
      mitigation: "Validate pricing with target audience through pre-orders, surveys, or A/B testing",
    });

    // Sort by impact (highest first)
    return risks.sort((a, b) => b.impact - a.impact);
  }

  /**
   * influenceDecision — Provide economic recommendation for the product decision.
   *
   * AC-047: Economics MUST influence the BUILD/VALIDATE/DO_NOT_BUILD decision.
   *         This method produces an economic recommendation that should be
   *         factored into the final product decision.
   */
  influenceDecision(
    economics: EconomicsEstimate,
    fitResult: FitResult
  ): EconomicRecommendation {
    // Calculate economic score from multiple factors
    const factors: EconomicRecommendation["factors"] = [];

    // Factor 1: Margin (weight: 0.30)
    const marginWeight = 0.30;
    const marginContribution = economics.margin >= 0.5
      ? "Healthy margin supports building"
      : economics.margin >= 0.2
        ? "Acceptable margin but watch costs"
        : "Thin margin — high risk";
    factors.push({
      name: "profit_margin",
      value: economics.margin,
      weight: marginWeight,
      contribution: marginContribution,
    });

    // Factor 2: Monetization potential (weight: 0.25)
    const monetWeight = 0.25;
    factors.push({
      name: "monetization_potential",
      value: economics.monetization_potential,
      weight: monetWeight,
      contribution: economics.monetization_potential >= 0.6
        ? "Strong monetization potential"
        : "Weak monetization — may need alternative model",
    });

    // Factor 3: Cost vs fit score (weight: 0.20)
    const costRiskValue = Math.max(0, 1 - (economics.estimated_cost / 20000));
    const costWeight = 0.20;
    factors.push({
      name: "cost_risk",
      value: costRiskValue,
      weight: costWeight,
      contribution: `Cost $${economics.estimated_cost} vs threshold $20,000: ${costRiskValue >= 0.5 ? "acceptable" : "high risk"}`,
    });

    // Factor 4: Price sensitivity (weight: 0.15, inverse)
    const priceValue = 1 - economics.price_sensitivity;
    const priceWeight = 0.15;
    factors.push({
      name: "price_acceptance",
      value: priceValue,
      weight: priceWeight,
      contribution: economics.price_sensitivity <= 0.3
        ? "Low price sensitivity — audience likely to pay"
        : "High price sensitivity — pricing will be challenging",
    });

    // Factor 5: Risk exposure (weight: 0.10)
    const totalRiskImpact = economics.economic_risks.reduce((sum, r) => sum + r.impact, 0);
    const riskValue = Math.max(0, 1 - totalRiskImpact);
    const riskWeight = 0.10;
    factors.push({
      name: "risk_exposure",
      value: riskValue,
      weight: riskWeight,
      contribution: `Total risk impact: ${totalRiskImpact.toFixed(2)} (${economics.economic_risks.length} risks identified)`,
    });

    // Calculate weighted economic score
    const economicScore = factors.reduce((sum, f) => sum + f.value * f.weight, 0);

    // Determine recommendation (AC-047)
    let recommendation: EconomicRecommendation["recommendation"];
    let reason: string;

    if (economicScore >= 0.55 && economics.margin >= 0.2) {
      recommendation = "BUILD";
      reason = `Economic score ${economicScore.toFixed(2)} supports building. Margin ${(economics.margin * 100).toFixed(1)}% is ${economics.margin >= 0.4 ? "healthy" : "acceptable"}. ${economics.monetization_potential >= 0.5 ? "Monetization potential is strong." : "Monetization needs validation."}`;
    } else if (economicScore >= 0.35 || (economicScore >= 0.25 && economics.monetization_potential >= 0.4)) {
      recommendation = "VALIDATE_FIRST";
      reason = `Economic score ${economicScore.toFixed(2)} is promising but uncertain. Key risks: ${economics.economic_risks.slice(0, 2).map((r) => r.description).join("; ") || "none"}. Validate pricing and demand before committing.`;
    } else {
      recommendation = "DO_NOT_BUILD";
      reason = `Economic score ${economicScore.toFixed(2)} does not support investment. Margin ${(economics.margin * 100).toFixed(1)}% is ${economics.margin < 0.1 ? "critically low" : "too low"}. Monetization potential is weak. Recommend exploring alternatives or different pricing model.`;
    }

    return {
      recommendation,
      reason,
      economicScore: Math.round(economicScore * 100) / 100,
      factors,
    };
  }

  // ─── Private Helpers ───────────────────────────────────────────────────

  /** Get cost benchmarks for a product format */
  private getFormatBenchmarks(format: string): typeof FORMAT_COSTS[string] {
    const lower = format.toLowerCase();

    // Direct match
    if (FORMAT_COSTS[lower]) return FORMAT_COSTS[lower];

    // Partial match
    for (const [key, value] of Object.entries(FORMAT_COSTS)) {
      if (lower.includes(key) || key.includes(lower)) return value;
    }

    return FORMAT_COSTS.default;
  }

  /** Estimate pricing based on benchmarks and evidence */
  private estimatePricing(
    benchmarks: typeof FORMAT_COSTS[string],
    evidence: ProductEvidence[]
  ): number {
    // Check if pricing evidence exists
    const pricingEvidence = evidence.filter((e) => e.type === "PRICING");

    if (pricingEvidence.length > 0) {
      // Use pricing evidence if available (average of high-confidence items)
      const highConfPricing = pricingEvidence.filter((e) => e.confidence >= 0.6);
      if (highConfPricing.length > 0) {
        // Try to extract numeric prices from evidence content
        const prices: number[] = [];
        for (const e of highConfPricing) {
          const matches = e.content.match(/\$?(\d+(?:\.\d+)?)/g);
          if (matches) {
            for (const match of matches) {
              const price = parseFloat(match.replace("$", ""));
              if (price > 0 && price < 10000) prices.push(price);
            }
          }
        }
        if (prices.length > 0) {
          return Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
        }
      }
    }

    return benchmarks.suggestedPrice;
  }

  /** Assess monetization potential */
  private assessMonetizationPotential(
    price: number,
    margin: number,
    pricingModel: PricingModel,
    evidence: ProductEvidence[]
  ): number {
    // Base potential from pricing model
    let potential: number;
    switch (pricingModel) {
      case "subscription_monthly":
      case "subscription_annual":
        potential = 0.7; // Recurring revenue
        break;
      case "one_time":
        potential = 0.5; // One-time revenue
        break;
      case "freemium":
        potential = 0.4; // Depends on conversion
        break;
      case "usage_based":
        potential = 0.6; // Scales with usage
        break;
      case "marketplace":
        potential = 0.5; // Depends on volume
        break;
      case "ad_supported":
        potential = 0.2; // Typically low
        break;
      default:
        potential = 0.3;
    }

    // Adjust for margin
    potential *= (0.5 + 0.5 * margin);

    // Adjust for demand evidence
    const demandEvidence = evidence.filter((e) => e.type === "DEMAND");
    if (demandEvidence.length > 0) {
      const avgConfidence = demandEvidence.reduce((s, e) => s + e.confidence, 0) / demandEvidence.length;
      potential *= (0.7 + 0.3 * avgConfidence);
    }

    return Math.max(0, Math.min(1, potential));
  }

  /** Assess price sensitivity */
  private assessPriceSensitivity(
    price: number,
    pricingModel: PricingModel,
    evidence: ProductEvidence[]
  ): number {
    // Base sensitivity from price point
    let sensitivity: number;

    if (price === 0) sensitivity = 0.9; // Free = very hard to charge
    else if (price < 10) sensitivity = 0.7; // Very cheap — hard to justify higher
    else if (price < 30) sensitivity = 0.5; // Moderate
    else if (price < 100) sensitivity = 0.3; // Premium — audience expects to pay
    else sensitivity = 0.2; // Enterprise — price is less of an objection

    // Subscription reduces sensitivity (habitual spending)
    if (pricingModel === "subscription_monthly" && price < 50) {
      sensitivity *= 0.8;
    }

    // Demand evidence reduces sensitivity (proven willingness to pay)
    const demandEvidence = evidence.filter((e) => e.type === "DEMAND" && e.confidence >= 0.6);
    if (demandEvidence.length > 0) {
      sensitivity *= 0.85;
    }

    return Math.max(0, Math.min(1, sensitivity));
  }

  /** Calculate break-even analysis */
  private calculateBreakEven(
    estimatedCost: number,
    price: number,
    monthlyCost: number,
    pricingModel: PricingModel
  ): { units: number; time: string; assumptions: string[] } {
    if (price <= 0) {
      return {
        units: Infinity,
        time: "Never (no revenue model)",
        assumptions: ["No revenue model identified"],
      };
    }

    const assumptions = [
      `Production cost: $${estimatedCost}`,
      `Monthly operating cost: $${monthlyCost}`,
      `Price: $${price} per ${pricingModel === "subscription_monthly" ? "month" : "unit"}`,
    ];

    switch (pricingModel) {
      case "one_time": {
        const units = Math.ceil(estimatedCost / price);
        const months = Math.max(1, Math.ceil(units / 50)); // Assume 50 sales/month
        return { units, time: `~${months} month(s) at 50 sales/month`, assumptions };
      }

      case "subscription_monthly": {
        const monthlyProfit = price - monthlyCost;
        if (monthlyProfit <= 0) {
          return { units: Infinity, time: "Never (monthly cost exceeds revenue)", assumptions };
        }
        const subscribers = Math.ceil((estimatedCost + monthlyCost) / monthlyProfit);
        const months = Math.max(1, Math.ceil(estimatedCost / (subscribers * monthlyProfit)));
        return {
          units: subscribers,
          time: `~${months} month(s) with ${subscribers} subscribers`,
          assumptions: [...assumptions, `Assumes ${subscribers} subscribers at $${price}/month`],
        };
      }

      case "freemium": {
        // Assume 5% conversion rate
        const conversionRate = 0.05;
        const payingUsers = Math.ceil(estimatedCost / (price * 12 * conversionRate));
        const totalUsers = Math.ceil(payingUsers / conversionRate);
        return {
          units: totalUsers,
          time: `~12 months with ${totalUsers} users (${payingUsers} paying)`,
          assumptions: [...assumptions, `Assumes ${conversionRate * 100}% conversion rate`],
        };
      }

      default: {
        const units = Math.ceil(estimatedCost / price);
        return { units, time: `~${Math.ceil(units / 30)} month(s)`, assumptions };
      }
    }
  }
}
