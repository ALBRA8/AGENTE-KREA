import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/fit
 * Run Product Fit evaluation.
 * Body: opportunityId (existing) OR opportunity data (domain, problem, audience, evidence)
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { opportunityId, domain, problem, audience, evidence } = body;

    let opportunityData: {
      domain: string;
      problem: string;
      audience?: string;
      evidence?: unknown;
    };

    // If opportunityId provided, fetch from DB
    if (opportunityId) {
      const opportunity = await db.productOpportunity.findUnique({
        where: { id: opportunityId },
        include: { dossier: true },
      });
      if (!opportunity) {
        return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
      }
      // Ownership check: if linked to a dossier, verify the user owns it
      if (opportunity.dossier?.userId && opportunity.dossier.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      // Mark as ANALYZING
      await db.productOpportunity.update({
        where: { id: opportunityId },
        data: { status: "ANALYZING" },
      });
      opportunityData = {
        domain: opportunity.domain,
        problem: opportunity.problem,
        audience: opportunity.audience || undefined,
        evidence: opportunity.evidence ? JSON.parse(opportunity.evidence) : undefined,
      };
    } else if (domain && problem) {
      opportunityData = { domain, problem, audience, evidence };
    } else {
      return NextResponse.json(
        { error: "Provide opportunityId or domain+problem" },
        { status: 400 }
      );
    }

    // ─── Product Fit Engine ──────────────────────────────────────────────
    // Evaluate the opportunity against product fit criteria:
    // 1. Problem clarity & severity
    // 2. Audience specificity & size
    // 3. Domain knowledge alignment
    // 4. Evidence strength
    // 5. Resource feasibility

    const scores: Record<string, number> = {};

    // Problem clarity (based on length and specificity)
    scores.problemClarity = Math.min(1, opportunityData.problem.length / 100);

    // Audience specificity
    scores.audienceSpecificity = opportunityData.audience ? Math.min(1, opportunityData.audience.length / 50) : 0.2;

    // Domain alignment
    const knownDomains = ["marketing", "productividad", "educación", "salud", "finanzas", "tecnología", "creatividad"];
    scores.domainAlignment = knownDomains.some(d => opportunityData.domain.toLowerCase().includes(d)) ? 0.8 : 0.4;

    // Evidence strength
    scores.evidenceStrength = opportunityData.evidence ? 0.7 : 0.3;

    // Resource feasibility (default moderate)
    scores.resourceFeasibility = 0.6;

    // Calculate overall fit score
    const weights: Record<string, number> = {
      problemClarity: 0.3,
      audienceSpecificity: 0.25,
      domainAlignment: 0.2,
      evidenceStrength: 0.15,
      resourceFeasibility: 0.1,
    };

    const fitScore = Object.entries(weights).reduce(
      (sum, [key, weight]) => sum + (scores[key] || 0) * weight,
      0
    );

    const verdict = fitScore >= 0.7 ? "STRONG_FIT" : fitScore >= 0.5 ? "MODERATE_FIT" : "WEAK_FIT";

    const fitResult = {
      scores,
      fitScore: Math.round(fitScore * 100) / 100,
      verdict,
      evaluatedAt: new Date().toISOString(),
      evaluatedBy: "krea",
    };

    // Update opportunity if from DB
    if (opportunityId) {
      await db.productOpportunity.update({
        where: { id: opportunityId },
        data: {
          status: "ANALYZED",
          confidence: fitScore,
        },
      });
    }

    return NextResponse.json({ fitResult, opportunityData });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running product fit";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
