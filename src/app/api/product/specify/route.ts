import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { createProductSpecification } from "@/lib/product-specification";
import type { ProductArchitecture } from "@/lib/product-architecture";

// POST /api/product/specify — Create product specification
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const { architecture } = body;

    if (!architecture) {
      return NextResponse.json(
        { error: "Falta campo requerido: architecture" },
        { status: 400 }
      );
    }

    // Create specification from architecture
    const specification = await createProductSpecification(
      architecture as ProductArchitecture
    );

    return NextResponse.json({ data: specification });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al crear especificación";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
