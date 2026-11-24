import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { CREDIT_COSTS } from "@/lib/credit-service";

/**
 * GET /api/product/credit-costs
 * Expone SOLO las capacidades product:* de la tabla CREDIT_COSTS (fuente
 * única en credit-service) para que la UI muestre el costo antes de confirmar.
 * No cobra, no muta: lectura pura. 401 sin sesión válida.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const costs = Object.fromEntries(
    Object.entries(CREDIT_COSTS).filter(([capability]) => capability.startsWith("product:"))
  );

  return NextResponse.json({ costs });
}
