import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/opportunities
 * List product opportunities.
 * Query params: status, domain, limit
 * Requires authentication — only returns opportunities for the user's dossiers.
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const domain = searchParams.get("domain") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (domain) where.domain = domain;
    // Only return opportunities linked to the user's dossiers
    where.dossier = { userId: user.id };

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
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { domain, problem, audience, evidence, sourceAgent, dossierId } = body;

    if (!domain || !problem) {
      return NextResponse.json(
        { error: "domain and problem are required" },
        { status: 400 }
      );
    }

    // If linking to a dossier, verify ownership
    if (dossierId) {
      const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
      if (!dossier) return NextResponse.json({ error: "Dossier no encontrado" }, { status: 404 });
      if (dossier.userId && dossier.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
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
        dossierId: dossierId || null,
      },
    });

    return NextResponse.json({ opportunity }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating opportunity";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
