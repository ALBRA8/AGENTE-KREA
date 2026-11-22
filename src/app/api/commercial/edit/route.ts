import { NextRequest, NextResponse } from "next/server";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/edit
 * Edit an existing creative using natural language instructions.
 *
 * Body: { originalImage, editInstruction, language? }
 */
export async function POST(req: NextRequest) {
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { originalImage, editInstruction, language } = body;

    if (!originalImage) {
      return NextResponse.json({ error: "Missing required field: originalImage" }, { status: 400 });
    }
    if (!editInstruction) {
      return NextResponse.json({ error: "Missing required field: editInstruction" }, { status: 400 });
    }

    // Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:edit"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    const { editCreativeWithNL } = await import("@/lib/commercial/nl-editor");
    const result = await editCreativeWithNL({
      originalImage,
      editInstruction,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:edit");
    const message = e instanceof Error ? e.message : "Error editing creative";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
