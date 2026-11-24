import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { chargeForCapability, refundCharge, type ChargeResult, type ChargeError } from "@/lib/credit-service";

/**
 * POST /api/commercial/variants
 * Generate a pack of creative variants from a base ad, varying by angle.
 *
 * Body: { baseAd, angles, count? }
 */
export async function POST(req: NextRequest) {
  // Gate de auth ANTES de leer/validar el body (auditoría FASE 3: sin token → 401)
  const sessionUser = await getSessionUser(req.headers.get("authorization")?.replace("Bearer ", "") || "");
  if (!sessionUser) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  let charge: ChargeResult | ChargeError | null = null;
  try {
    const body = await req.json();
    const { baseAd, angles, count } = body;

    // Validate required fields
    if (!baseAd) {
      return NextResponse.json(
        { error: "Missing required field: baseAd" },
        { status: 400 }
      );
    }
    if (!angles || !Array.isArray(angles) || angles.length === 0) {
      return NextResponse.json(
        { error: "Missing or invalid required field: angles (must be a non-empty array)" },
        { status: 400 }
      );
    }

        // Hallazgo 2.3: count × angles sin tope = llamadas reales ilimitadas
    // por precio plano. Tope duro ANTES del cobro.
    const MAX_COMBINATIONS = 12;
    if (!Array.isArray(angles) || angles.length === 0 || angles.length > MAX_COMBINATIONS) {
      return NextResponse.json({ error: `angles: entre 1 y ${MAX_COMBINATIONS}` }, { status: 400 });
    }
    if (!Number.isInteger(count) || count < 1 || count > MAX_COMBINATIONS) {
      return NextResponse.json({ error: `count: entero entre 1 y ${MAX_COMBINATIONS}` }, { status: 400 });
    }
    if (count * angles.length > MAX_COMBINATIONS) {
      return NextResponse.json({ error: `count × angles no puede superar ${MAX_COMBINATIONS} activos` }, { status: 400 });
    }

// Cobro atómico único (reembolso en caso de fallo)
    charge = await chargeForCapability(
      req.headers.get("authorization")?.replace("Bearer ", "") ?? "",
      "commercial:variants"
    );
    if (!charge.ok) {
      return NextResponse.json({ error: charge.error }, { status: charge.status });
    }

    // Dynamic import to keep bundle lean
    const { CommercialCreativeEngine } = await import(
      "@/lib/commercial-creative-engine"
    );
    const engine = CommercialCreativeEngine.getInstance();

    const result = await engine.generateVariantPack({
      baseAd,
      angles,
      count,
    });

    // Hallazgo 2.1: pack sin variantes → reembolso + 502.
    const packVariants = (result as { variants?: unknown[] })?.variants ?? [];
    if (packVariants.length === 0) {
      if (charge?.ok) await refundCharge(charge.userId, "commercial:variants");
      return NextResponse.json(
        { success: false, error: "La generación no produjo variantes — créditos reembolsados", refunded: true, data: result },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, data: result, credits: charge.ok ? charge.creditsLeft : undefined });
  } catch (e: unknown) {
    if (charge?.ok) await refundCharge(charge.userId, "commercial:variants");
    const message =
      e instanceof Error ? e.message : "Error generating variants";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
