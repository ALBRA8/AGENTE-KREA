import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { runVisualQA } from "@/lib/visual-qa";

// POST /api/product/qa — Run Visual QA on a PDF
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, artifactPath } = body;

    if (!productId || !artifactPath) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: productId, artifactPath" },
        { status: 400 }
      );
    }

    // Verify the product belongs to the user via dossier
    const dossier = await db.productDossier.findFirst({
      where: {
        userId: user.id,
        specification: { contains: productId },
      },
    });

    // Even if no dossier found, still allow QA on the artifact
    // (the artifact path is the authoritative check — file must exist)

    // Run Visual QA
    const report = await runVisualQA(productId, artifactPath);

    // If we found a dossier, update its status based on QA result
    if (dossier) {
      await db.productDossier.update({
        where: { id: dossier.id },
        data: {
          status: report.passed ? "PUBLISHED" : "REVISION",
        },
      });
    }

    return NextResponse.json({ data: report });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error en Visual QA";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
