import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/produce
 * Start Product Production — routes to BookFactory (content) or Handoff (software).
 * Body: dossierId
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { dossierId } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    if (!dossier.specification) {
      return NextResponse.json(
        { error: "Dossier must be specified before production" },
        { status: 400 }
      );
    }

    const format = dossier.format || "guide";
    const decision = dossier.decision ? JSON.parse(dossier.decision) : null;
    const specification = JSON.parse(dossier.specification);

    // ─── Production Router ────────────────────────────────────────────────
    // Content products → Book Factory (KREA builds directly)
    // Software products → Handoff (delegate to constructor)

    const contentFormats = ["ebook", "guide", "template"];
    const isContentProduct = contentFormats.includes(format);

    let productionResult: Record<string, unknown>;

    if (isContentProduct) {
      // ── Book Factory Pipeline ─────────────────────────────────────────
      productionResult = {
        route: "book_factory",
        constructor: "krea",
        pipeline: [
          { step: "outline", status: "PENDING" },
          { step: "chapter_generation", status: "PENDING" },
          { step: "cover_design", status: "PENDING" },
          { step: "layout", status: "PENDING" },
          { step: "pdf_export", status: "PENDING" },
          { step: "visual_qa", status: "PENDING" },
        ],
        currentStep: 0,
        status: "PRODUCING",
        startedAt: new Date().toISOString(),
      };
    } else {
      // ── Handoff to Constructor ────────────────────────────────────────
      const targetConstructor = decision?.constructor || "codex";

      productionResult = {
        route: "handoff",
        constructor: targetConstructor,
        handoffRequired: true,
        status: "HANDOFF_PENDING",
        startedAt: new Date().toISOString(),
      };
    }

    productionResult.dossierId = dossierId;
    productionResult.format = format;
    productionResult.producedBy = "krea";

    // Update dossier with production data
    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        productionData: JSON.stringify(productionResult),
        status: "BUILDING",
      },
    });

    return NextResponse.json({ productionResult, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error starting production";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
