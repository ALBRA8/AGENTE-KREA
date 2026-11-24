import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createId } from "@paralleldrive/cuid2";

/**
 * POST /api/product/launch-package
 * Generate a launch package for a product.
 */
export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await req.json();
    const {
      productId, version, product, offer, positioning, targetCustomer,
      corePromise, benefits, included, bonuses, price, delivery,
      faq, objections, cta, assets, proofStatus, disclaimers,
    } = body;

    if (!productId || !corePromise || !cta) {
      return NextResponse.json(
        { error: "productId, corePromise y cta son obligatorios" },
        { status: 400 }
      );
    }

    // Verify ownership via dossier
    const dossier = await db.productDossier.findFirst({
      where: { id: productId, userId: user.id },
    });
    if (!dossier) {
      return NextResponse.json({ error: "Dossier no encontrado o sin permisos" }, { status: 404 });
    }

    // Hallazgo 3.2: el paquete se valida SERVER-SIDE (validateLaunchPackage +
    // getIntegrityIssues) y el resultado se persiste en integrityCheck.
    // Paquete inválido o con patrones deshonestos → 422 y NO se persiste.
    const { getIntegrityIssues, validateLaunchPackage } = await import("@/lib/launch-package");
    type LP = Parameters<typeof validateLaunchPackage>[0];
    const parsed = <T>(raw: unknown, fallback: T): T => {
      try { return (typeof raw === "string" ? JSON.parse(raw) : raw) as T; } catch { return fallback; }
    };
    const pkgForCheck = {
      productId,
      version: version || "1.0.0",
      product: parsed(product || "{}", {}),
      offer: parsed(offer || "{}", {}),
      positioning: positioning || "",
      targetCustomer: parsed(targetCustomer || "{}", {}),
      corePromise,
      benefits: parsed(benefits || "[]", []),
      included: parsed(included || "[]", []),
      bonuses: parsed(bonuses || "[]", []),
      price: parsed(price || "{}", {}),
      delivery: parsed(delivery || "{}", {}),
      faq: parsed(faq || "[]", []),
      objections: parsed(objections || "[]", []),
      cta,
      assets: parsed(assets || "[]", []),
      proofStatus: parsed(proofStatus || "[]", []),
      disclaimers: parsed(disclaimers || "[]", []),
    } as unknown as LP;

    // El validator espera pkg.integrityCheck pre-poblado: primero integridad
    // (patrones deshonestos), luego validación completa con ese resultado.
    const integrityIssues = getIntegrityIssues(pkgForCheck);
    (pkgForCheck as { integrityCheck: { passes: boolean; issues: string[] } }).integrityCheck = {
      passes: integrityIssues.length === 0,
      issues: integrityIssues,
    };
    const validation = validateLaunchPackage(pkgForCheck);
    const integrityCheck = JSON.stringify({
      valid: validation.valid && integrityIssues.length === 0,
      issues: validation.issues,
      integrityIssues,
      checkedAt: new Date().toISOString(),
    });

    if (!validation.valid || integrityIssues.length > 0) {
      return NextResponse.json(
        {
          error: "El launch package no pasa la validación de integridad — NO se persiste",
          validation,
          integrityIssues,
        },
        { status: 422 }
      );
    }

    // Los campos JSON aceptan objeto o string: se normalizan a string para la BD.
    const asJson = (v: unknown, fallback: string): string => {
      if (v === undefined || v === null) return fallback;
      if (typeof v === "string") return v;
      try { return JSON.stringify(v); } catch { return fallback; }
    };

    const launchPackage = await db.launchPackage.create({
      data: {
        userId: user.id,
        integrityCheck,
        packageId: createId(),
        productId,
        version: version || "1.0.0",
        product: asJson(product, "{}"),
        offer: asJson(offer, "{}"),
        positioning: positioning || "",
        targetCustomer: asJson(targetCustomer, "{}"),
        corePromise,
        benefits: asJson(benefits, "[]"),
        included: asJson(included, "[]"),
        bonuses: asJson(bonuses, "[]"),
        price: asJson(price, "{}"),
        delivery: asJson(delivery, "{}"),
        faq: asJson(faq, "[]"),
        objections: asJson(objections, "[]"),
        cta,
        assets: asJson(assets, "[]"),
        proofStatus: asJson(proofStatus, "[]"),
        disclaimers: asJson(disclaimers, "[]"),
      },
    });

    return NextResponse.json(launchPackage, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error creando launch package";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
