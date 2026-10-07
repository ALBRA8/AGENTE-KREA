import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/decide
 * Run Product Decision based on dossier and fit result.
 * Body: dossierId, fitResult
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { dossierId, fitResult } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }
    if (dossier.userId && dossier.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ─── Product Decision Engine ──────────────────────────────────────────
    // Decide whether to BUILD, DELEGATE, or KILL based on:
    // 1. Fit result (provided or from dossier)
    // 2. Product format (content products = build ourselves, software = delegate)
    // 3. Priority level
    // 4. Economics estimate

    const fit = fitResult || (dossier.fitResult ? JSON.parse(dossier.fitResult) : null);
    const fitScore = fit?.fitScore ?? 0.5;
    const verdict = fit?.verdict ?? "MODERATE_FIT";
    const format = dossier.format || "guide";

    let decision: string;
    let constructor: string | null = null;
    let reasoning: string;

    // Content formats KREA builds directly
    const contentFormats = ["ebook", "guide", "template"];

    if (fitScore < 0.3) {
      decision = "KILL";
      reasoning = "Fit score too low — opportunity does not warrant investment";
    } else if (contentFormats.includes(format)) {
      decision = "BUILD_DIRECTLY";
      constructor = "krea";
      reasoning = `Content product (${format}) — KREA builds directly via Book Factory`;
    } else if (format === "app" || format === "saas") {
      decision = "DELEGATE";
      constructor = "codex";
      reasoning = `Software product (${format}) — delegate to Codex for construction`;
    } else {
      // Hybrid or unknown — decide based on fit score
      if (fitScore >= 0.7) {
        decision = "BUILD_DIRECTLY";
        constructor = "krea";
        reasoning = "Strong fit with hybrid format — KREA leads with selective delegation";
      } else {
        decision = "DELEGATE";
        constructor = "codex";
        reasoning = "Moderate fit — delegate for construction, KREA provides specification";
      }
    }

    const productDecision = {
      decision,
      constructor,
      reasoning,
      fitScore,
      fitVerdict: verdict,
      format,
      decidedAt: new Date().toISOString(),
      decidedBy: "krea",
    };

    // Update dossier with decision and advance status
    const newStatus = decision === "KILL" ? "KILLED" : "APPROVED";
    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        decision: JSON.stringify(productDecision),
        fitResult: fit ? JSON.stringify(fit) : dossier.fitResult,
        status: newStatus,
      },
    });

    return NextResponse.json({ productDecision, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running product decision";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
