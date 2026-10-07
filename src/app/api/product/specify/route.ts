import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/specify
 * Run Product Specification — produce a constructor-neutral spec.
 * Body: dossierId, architecture, targetConstructor?
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { dossierId, architecture, targetConstructor } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    if (dossier.status === "KILLED") {
      return NextResponse.json({ error: "Cannot specify a killed dossier" }, { status: 400 });
    }

    // ─── Product Specification Engine ─────────────────────────────────────
    // Generate a constructor-neutral specification from architecture.

    const arch = architecture || (dossier.architecture ? JSON.parse(dossier.architecture) : null);
    const constructor = targetConstructor || (dossier.decision ? JSON.parse(dossier.decision!).constructor : "krea");
    const format = dossier.format || "guide";

    const specification: Record<string, unknown> = {
      productId: dossier.id,
      productTitle: dossier.title,
      productDescription: dossier.description,
      domain: dossier.domain,
      format,
      targetConstructor: constructor,

      // Requirements (derived from dossier fields)
      requirements: {
        functional: [],
        nonFunctional: [],
        constraints: [],
      },

      // Architecture reference
      architecture: arch,

      // Acceptance criteria
      acceptance: {
        qualityGates: ["specification_complete", "architecture_validated"],
        testCriteria: [],
        qaRequired: true,
      },

      // Metadata
      specifiedAt: new Date().toISOString(),
      specifiedBy: "krea",
      version: dossier.version,
    };

    // Format-specific specification enhancements
    if (format === "ebook" || format === "guide") {
      specification.contentSpec = {
        language: "es",
        tone: "professional",
        targetLength: "15000-30000 words",
        chapterFormat: "markdown",
        outputFormat: "pdf",
        designStyle: "modern-clean",
      };
      specification.acceptance.qualityGates.push(
        "cover_designed",
        "all_chapters_generated",
        "pdf_exported",
        "visual_qa_passed"
      );
    } else if (format === "app" || format === "saas") {
      specification.technicalSpec = {
        stack: arch?.stack || {},
        features: [],
        integrations: [],
        security: "standard",
      };
      specification.acceptance.qualityGates.push(
        "code_compiles",
        "tests_pass",
        "deploy_successful"
      );
    }

    // Update dossier with specification and advance status
    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        specification: JSON.stringify(specification),
        status: "SPECIFIED",
      },
    });

    return NextResponse.json({ specification, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running product specification";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
