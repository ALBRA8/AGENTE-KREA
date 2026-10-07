import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/qa
 * Run Visual QA on a product.
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

    // ─── Visual QA Engine ─────────────────────────────────────────────────
    // Inspect product artifacts before declaring them ready.

    const productionData = dossier.productionData ? JSON.parse(dossier.productionData) : null;
    const format = dossier.format || "guide";

    const qaChecks: Record<string, unknown>[] = [];

    // Format-specific QA checks
    if (format === "ebook" || format === "guide") {
      qaChecks.push(
        { check: "cover_exists", description: "Book cover image exists", weight: 0.2 },
        { check: "toc_valid", description: "Table of contents is well-structured", weight: 0.15 },
        { check: "chapters_complete", description: "All chapters have content", weight: 0.25 },
        { check: "formatting_consistent", description: "Formatting is consistent across chapters", weight: 0.15 },
        { check: "pdf_valid", description: "PDF export is valid and complete", weight: 0.15 },
        { check: "no_broken_links", description: "No broken internal links", weight: 0.1 }
      );
    } else if (format === "app" || format === "saas") {
      qaChecks.push(
        { check: "builds_successfully", description: "Application builds without errors", weight: 0.3 },
        { check: "tests_pass", description: "All automated tests pass", weight: 0.25 },
        { check: "no_accessibility_errors", description: "No critical accessibility issues", weight: 0.15 },
        { check: "responsive_design", description: "UI is responsive across breakpoints", weight: 0.15 },
        { check: "performance_acceptable", description: "Performance metrics within thresholds", weight: 0.15 }
      );
    } else {
      qaChecks.push(
        { check: "artifacts_exist", description: "Required artifacts are present", weight: 0.5 },
        { check: "quality_acceptable", description: "Overall quality meets threshold", weight: 0.5 }
      );
    }

    // Run simulated QA evaluation
    const results = qaChecks.map((check) => ({
      ...check,
      status: "PENDING" as const,
      score: null as number | null,
    }));

    const qaReport = {
      dossierId,
      format,
      checks: results,
      overallScore: null as number | null,
      verdict: "PENDING" as string,
      startedAt: new Date().toISOString(),
      completedAt: null as string | null,
      inspectedBy: "krea",
    };

    // Update dossier with QA results
    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        qaResults: JSON.stringify(qaReport),
        status: "QA",
      },
    });

    return NextResponse.json({ qaReport, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running QA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
