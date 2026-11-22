import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/batch
 * Execute a batch of creative generation jobs in parallel.
 *
 * Body: { items: Array<{ type, params }>, concurrency? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { items, concurrency } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing or invalid: items (must be a non-empty array)" }, { status: 400 });
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
    const result = await executeBatch(items, concurrency ?? 3);

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:batch");
    const message = e instanceof Error ? e.message : "Error executing batch";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
