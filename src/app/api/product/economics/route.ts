import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { analyzeProductEconomics } from "@/lib/product-economics";
import type { ProductArchitecture } from "@/lib/product-architecture";

// POST /api/product/economics — Analyze economics
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { productId, architecture } = body;

    if (!productId || !architecture) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: productId, architecture" },
        { status: 400 }
      );
    }

    // Analyze economics
    const economics = await analyzeProductEconomics(
      productId,
      architecture as ProductArchitecture
    );

    return NextResponse.json({ data: economics });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al analizar economía";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
