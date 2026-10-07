import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/product/launch-package/[id]
 * Get a launch package by ID (ownership enforced).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const { id } = await params;
    const launchPackage = await db.launchPackage.findFirst({
      where: { id, userId: user.id },
    });

    if (!launchPackage) {
      return NextResponse.json({ error: "Launch package no encontrado" }, { status: 404 });
    }

    return NextResponse.json(launchPackage);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error obteniendo launch package";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
