import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/dossiers
 * List product dossiers.
 * Query params: status, format, limit
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const format = searchParams.get("format") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (format) where.format = format;
    if (user) where.userId = user.id;

    const dossiers = await db.productDossier.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        opportunities: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({ dossiers, total: dossiers.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing dossiers";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/product/dossiers
 * Create a new product dossier.
 * Body: title, description, domain, format
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { title, description, domain, format } = body;

    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }

    const dossier = await db.productDossier.create({
      data: {
        agentId: "krea",
        userId: user.id,
        title,
        description,
        domain: domain || null,
        format: format || null,
        status: "IDEA",
        priority: "MEDIUM",
      },
    });

    return NextResponse.json({ dossier }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creating dossier";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
