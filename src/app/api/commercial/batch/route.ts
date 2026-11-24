import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/batch
 * Execute a batch of creative generation jobs in parallel.
 *
 * Body: { items: Array<{ type, params }>, concurrency? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { items, concurrency } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing or invalid: items (must be a non-empty array)" }, { status: 400 });
    }
    // Hallazgo 2.3: arrays sin tope por precio plano = gasto real ilimitado.
    if (items.length > 12) {
      return NextResponse.json({ error: "items: máximo 12 por lote" }, { status: 400 });
    }
    // Hallazgo 2.3: concurrency 0/negativo → bucle infinito tras cobrar.
    // Validación ANTES del cobro: int 1..5.
    const conc = Number(concurrency ?? 3);
    if (!Number.isInteger(conc) || conc < 1 || conc > 5) {
      return NextResponse.json({ error: "concurrency: entero entre 1 y 5" }, { status: 400 });
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:batch"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { executeBatch } = await import("@/lib/commercial/batch-pipeline");
    const result = await executeBatch(items, conc);

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:batch");
    const message = e instanceof Error ? e.message : "Error executing batch";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
