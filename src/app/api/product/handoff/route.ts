import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/handoff
 * List all handoffs for the authenticated user.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const handoffs = await db.handoff.findMany({
      where: { dossier: { userId: user.id } },
      orderBy: { updatedAt: "desc" },
      include: { dossier: { select: { id: true, title: true, domain: true } } },
    });

    return NextResponse.json({ handoffs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading handoffs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/handoff
 * Create a new handoff contract for a dossier.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { dossierId, provider, objective } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({
      where: { id: dossierId },
    });

    if (!dossier || dossier.userId !== user.id) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    const handoff = await db.handoff.create({
      data: {
        dossierId,
        targetProvider: provider || "generic",
        objective: objective || `Implement ${dossier.title}`,
        productId: dossier.title,
        status: "CREATED",
      },
    });

    // Link handoff to dossier
    await db.productDossier.update({
      where: { id: dossierId },
      data: { handoffId: handoff.id },
    });

    return NextResponse.json(handoff, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating handoff";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
