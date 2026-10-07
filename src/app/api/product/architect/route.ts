import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/product/architect
 * Run Product Architecture definition.
 * Body: dossierId, decision
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { dossierId, decision } = body;

    if (!dossierId) {
      return NextResponse.json({ error: "dossierId is required" }, { status: 400 });
    }

    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    if (dossier.status === "KILLED" || dossier.status === "KILLED") {
      return NextResponse.json({ error: "Cannot architect a killed dossier" }, { status: 400 });
    }

    // ─── Product Architecture Engine ──────────────────────────────────────
    // Define the architecture based on format and decision:
    // - Content products: Book architecture (chapters, design, production pipeline)
    // - Software products: App architecture (stack, components, APIs, data model)
    // - Hybrid: Both

    const productDecision = decision || (dossier.decision ? JSON.parse(dossier.decision) : null);
    const format = dossier.format || "guide";

    let architecture: Record<string, unknown>;

    if (format === "ebook" || format === "guide") {
      // Book Architecture
      architecture = {
        type: "book",
        format,
        structure: {
          cover: { type: "image", purpose: "book_cover" },
          toc: { type: "generated", purpose: "table_of_contents" },
          chapters: { type: "generated", minCount: 5, maxCount: 15, purpose: "content" },
          appendix: { type: "optional", purpose: "references" },
        },
        production: {
          contentEngine: "krea-book-factory",
          designEngine: "krea-art-direction",
          outputFormat: "pdf",
          qaRequired: true,
        },
        pipeline: [
          "outline",
          "chapter_generation",
          "cover_design",
          "layout",
          "pdf_export",
          "visual_qa",
        ],
      };
    } else if (format === "app" || format === "saas") {
      // Software Architecture
      architecture = {
        type: "application",
        format,
        stack: {
          framework: "next.js",
          language: "typescript",
          database: "sqlite",
          orm: "prisma",
          styling: "tailwind-css",
        },
        components: [],
        apis: [],
        dataModel: [],
        deployment: {
          target: "vercel",
          region: "auto",
        },
      };
    } else {
      // Template / Hybrid
      architecture = {
        type: format,
        format,
        structure: {},
        production: {
          contentEngine: "krea",
          outputFormat: format === "template" ? "zip" : "pdf",
          qaRequired: true,
        },
        pipeline: ["design", "content", "assembly", "qa"],
      };
    }

    architecture.architectedAt = new Date().toISOString();
    architecture.architectedBy = "krea";

    // Update dossier with architecture and advance status
    await db.productDossier.update({
      where: { id: dossierId },
      data: {
        architecture: JSON.stringify(architecture),
        status: "ARCHITECTING",
      },
    });

    return NextResponse.json({ architecture, dossierId });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running product architecture";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
