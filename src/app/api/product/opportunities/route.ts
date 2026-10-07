import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/opportunities
 * List product opportunities.
 * Query params: status, domain, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const domain = searchParams.get("domain") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (domain) where.domain = domain;

    const opportunities = await db.productOpportunity.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ opportunities, total: opportunities.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing opportunities";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/opportunities
 * Create a product opportunity from an external signal.
 * Body: domain, problem, audience, evidence, sourceAgent
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");

    const body = await req.json();
    const { domain, problem, audience, evidence, sourceAgent } = body;

    if (!domain || !problem) {
      return NextResponse.json(
        { error: "domain and problem are required" },
        { status: 400 }
      );
    }

    const opportunity = await db.productOpportunity.create({
      data: {
        agentId: "krea",
        sourceAgent: sourceAgent || null,
        domain,
        problem,
        audience: audience || null,
        evidence: evidence ? JSON.stringify(evidence) : null,
        confidence: 0.5,
        status: "DETECTED",
      },
    });

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating opportunity";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
