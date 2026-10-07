import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/produce/[id]
 * Get a single production job status (for polling progress).
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
    });

    if (!dossier || dossier.userId !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const progress = dossier.status === "PUBLISHED" ? 100 : dossier.status === "QA" ? 85 : dossier.status === "FAILED" ? 0 : 50;

    return NextResponse.json({
      id: dossier.id,
      dossierId: dossier.id,
      productName: dossier.title,
      productType: dossier.domain,
      status: dossier.status,
      progress,
      currentStep: dossier.status === "PUBLISHED" ? "Complete" : dossier.status === "QA" ? "QA checks" : dossier.status === "FAILED" ? "Failed" : "Producing",
      createdAt: dossier.createdAt,
      updatedAt: dossier.updatedAt,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading job";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
