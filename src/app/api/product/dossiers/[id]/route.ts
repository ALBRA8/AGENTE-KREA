import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/dossiers/[id]
 * Get a single dossier with full detail.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const dossier = await db.productDossier.findUnique({
      where: { id },
      include: { opportunity: true, handoff: true },
    });

    if (!dossier || dossier.userId !== user.id) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    // Parse JSON fields for the client
    const parsed = {
      ...dossier,
      fitScore: dossier.opportunity?.fitScore ? JSON.parse(dossier.opportunity.fitScore) : null,
      decision: dossier.opportunity?.decision ? JSON.parse(dossier.opportunity.decision) : null,
      architecture: dossier.architecture ? JSON.parse(dossier.architecture) : null,
      specification: dossier.specification ? JSON.parse(dossier.specification) : null,
      economics: dossier.economics ? JSON.parse(dossier.economics) : null,
    };

    return NextResponse.json(parsed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
