import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/dossiers/[id]
 * Get a full dossier by ID.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");

    const dossier = await db.productDossier.findUnique({
      where: { id },
      include: {
        opportunities: {
          orderBy: { createdAt: "desc" },
        },
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    if (dossier.userId && dossier.userId !== user?.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ dossier });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error fetching dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/product/dossiers/[id]
 * Update a dossier.
 * Body: status, architecture, specification, etc.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();

    // Build update data dynamically from allowed fields
    const allowedFields = [
      "status", "domain", "opportunity", "evidence", "fitResult",
      "decision", "architecture", "specification", "handoffs",
      "productionData", "qaResults", "feedback", "learnings",
      "economics", "format", "priority",
    ];

    const data: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // JSON fields need to be stringified
        const jsonFields = [
          "opportunity", "evidence", "fitResult", "decision",
          "architecture", "specification", "handoffs", "productionData",
          "qaResults", "feedback", "learnings", "economics",
        ];
        if (jsonFields.includes(field) && typeof body[field] === "object") {
          data[field] = JSON.stringify(body[field]);
        } else {
          data[field] = body[field];
        }
      }
    }

    // Track version changes
    if (Object.keys(data).length > 0) {
      const current = await db.productDossier.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
      }

      // Ownership check
      if (current.userId && current.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const changeEntry = {
        at: new Date().toISOString(),
        by: user.id,
        changes: Object.keys(data),
      };

      const existingChanges = current.changes ? JSON.parse(current.changes) : [];
      data.changes = JSON.stringify([...existingChanges, changeEntry]);

      const dossier = await db.productDossier.update({
        where: { id },
        data,
      });

      return NextResponse.json({ dossier });
    }

    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error updating dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/product/dossiers/[id]
 * Kill or archive a dossier.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const dossier = await db.productDossier.findUnique({ where: { id } });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier not found" }, { status: 404 });
    }

    // Ownership check
    if (dossier.userId && dossier.userId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Set status to KILLED (soft delete via status change)
    const updated = await db.productDossier.update({
      where: { id },
      data: {
        status: "KILLED",
        changes: JSON.stringify([
          ...(dossier.changes ? JSON.parse(dossier.changes) : []),
          { at: new Date().toISOString(), by: user.id, changes: ["status:KILLED"] },
        ]),
      },
    });

    return NextResponse.json({ dossier: updated });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error deleting dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
