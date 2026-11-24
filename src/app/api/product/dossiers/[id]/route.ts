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

/**
 * PATCH /api/product/dossiers/[id] — transición de estado EXPLÍCITA (hallazgo 3.4).
 * Publicar es una transición con puertas: readiness READY_FOR_SALE + versión
 * registrada con QA pasado. El QA (route.ts de qa) ya NO publica por sí solo.
 */
const DOSSIER_TRANSITIONS: Record<string, string[]> = {
  IDEA: ["ARCHITECTING", "ARCHIVED"],
  ARCHITECTING: ["SPECIFYING", "IDEA"],
  SPECIFYING: ["ECONOMICS", "ARCHITECTING"],
  ECONOMICS: ["READY_FOR_PRODUCING", "SPECIFYING"],
  READY_FOR_PRODUCING: ["PRODUCING", "ARCHIVED"],
  PRODUCING: ["QA", "FAILED"],
  QUEUED: ["PRODUCING", "ARCHIVED"],
  QA: ["PUBLISHED", "REVISION"],
  REVISION: ["QA", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED"], // una vez publicado, solo archivar
  FAILED: ["READY_FOR_PRODUCING", "ARCHIVED"],
  ARCHIVED: [],
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const dossier = await db.productDossier.findFirst({
      where: { id, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    const body = await req.json();
    const { status: toStatus } = body;
    if (!toStatus) {
      return NextResponse.json({ error: "status es obligatorio" }, { status: 400 });
    }

    const allowed = DOSSIER_TRANSITIONS[dossier.status] ?? [];
    if (!allowed.includes(toStatus)) {
      return NextResponse.json(
        { error: `Transición ilegal: ${dossier.status} → ${toStatus}` },
        { status: 409 }
      );
    }

    // Puertas de PUBLICACIÓN (hallazgo 3.4): readiness READY_FOR_SALE +
    // versión registrada con QA pasado. Sin eso → 409.
    if (toStatus === "PUBLISHED") {
      const product = await db.commercialProduct.findFirst({
        where: { productId: id, userId: user.id },
      });
      const readiness = product?.commercialReadiness
        ? (JSON.parse(product.commercialReadiness) as { state?: string })
        : null;
      if (!readiness || readiness.state !== "READY_FOR_SALE") {
        return NextResponse.json(
          { error: "Publicar exige readiness READY_FOR_SALE (evalua /api/product/readiness)", state: readiness?.state ?? null },
          { status: 409 }
        );
      }
      const version = await db.productVersionRecord.findFirst({
        where: { productId: id, userId: user.id, qaPassed: true },
      });
      if (!version) {
        return NextResponse.json(
          { error: "Publicar exige una versión registrada con QA pasado" },
          { status: 409 }
        );
      }
    }

    const updated = await db.productDossier.update({
      where: { id },
      data: {
        status: toStatus,
        timeline: JSON.stringify([
          ...(dossier.timeline ? (JSON.parse(dossier.timeline) as unknown[]) : []),
          { step: toStatus, timestamp: new Date().toISOString() },
        ]),
      },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error en la transición";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
