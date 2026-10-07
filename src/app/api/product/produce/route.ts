import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/produce
 * List dossiers in PRODUCING status (production jobs).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const jobs = await db.productDossier.findMany({
      where: {
        userId: user.id,
        status: { in: ["PRODUCING", "QA", "PUBLISHED", "FAILED"] },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Map to production job format
    const productions = jobs.map((j) => {
      const timeline = j.timeline ? JSON.parse(j.timeline) as Array<{ step: string; timestamp: string }> : [];
      const progress = j.status === "PUBLISHED" ? 100 : j.status === "QA" ? 85 : j.status === "FAILED" ? 0 : 50;
      return {
        id: j.id,
        dossierId: j.id,
        productName: j.title,
        productType: j.domain,
        status: j.status,
        progress,
        currentStep: j.status === "PUBLISHED" ? "Complete" : j.status === "QA" ? "QA checks" : j.status === "FAILED" ? "Failed" : "Producing",
        createdAt: j.createdAt,
        updatedAt: j.updatedAt,
        timeline,
      };
    });

    return NextResponse.json({ jobs: productions });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error loading productions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/produce
 * Start production for a dossier (transition status to PRODUCING).
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { dossierId } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({
      where: { id: dossierId },
    });

    if (!dossier || dossier.userId !== user.id) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    // Transition to PRODUCING
    const updated = await db.productDossier.update({
      where: { id: dossierId },
      data: {
        status: "PRODUCING",
        timeline: JSON.stringify([
          ...(dossier.timeline ? JSON.parse(dossier.timeline) as unknown[] : []),
          { step: "PRODUCING", timestamp: new Date().toISOString() },
        ]),
      },
    });

    return NextResponse.json({
      id: updated.id,
      dossierId: updated.id,
      productName: updated.title,
      productType: updated.domain,
      status: "PRODUCING",
      progress: 0,
      currentStep: "Initializing pipeline",
      createdAt: updated.createdAt,
    }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error starting production";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
