/**
 * Credit Service — único sistema de créditos atómicos con reembolso para
 * TODAS las puertas de generación: /api/generate/*, /api/commercial/*,
 * /api/harness (execute-skill) y /api/product (produce/factory-execute).
 *
 * deductCredits (auth.ts) es atómico por construcción: updateMany con
 * condición credits >= amount — la carrera read-then-write es imposible.
 * refundCredits es best-effort con incremento atómico.
 *
 * TABLA DE COSTOS por capacidad (referencia del dueño: 1 crédito ≈ 1 generación
 * simple; capacidades multi-activo cobran por lote).
 */

import { getSessionUser, deductCredits, refundCredits } from "@/lib/auth";

export const CREDIT_COSTS = {
  // ── Producción creativa (/api/generate/*) — costos ya existentes ──
  "generate:prompt": 2,
  "generate:image": 3,
  "generate:text": 2,
  "generate:voice": 3,
  "generate:ebook": 8,
  "generate:subtitle": 2,

  // ── Motor comercial (/api/commercial/*) ──
  "commercial:logo": 3,
  "commercial:banner": 3,
  "commercial:email": 2,
  "commercial:catalog": 3,
  "commercial:ad": 2,
  "commercial:landing": 2,
  "commercial:mockup": 3,
  "commercial:variants": 2,
  "commercial:edit": 3,
  "commercial:batch": 5,
  "commercial:export": 1,

  // ── Product Factory (/api/product/*) — solo operaciones que llaman al
  // proveedor IA (verificado con grep: fit/architect/economics/specify vía
  // product-* libs; produce y factory-execute vía executeFactory). Las demás
  // (decide/commercial/offer/qa/packaging/readiness/versions/handoff/
  // launch-package/feedback) son DB pura y NO cobran.
  // Degradación honesta: si el motor devuelve evidence NOT_VERIFIED (fit/
  // architect/specify) o ESTIMATED-heurístico (economics), el proveedor no
  // contribuyó → la ruta reembolsa.
  "product:fit": 2,
  "product:architect": 2,
  "product:economics": 2,
  "product:specify": 2,
  "product:produce": 12,          // fábrica completa 10 pasos (texto multi-capítulo + portada IA + PDF)
  "product:factory-execute": 12,  // misma fábrica vía /api/product/factory/execute

  // ── Arnés de infoproductos (/api/harness execute-skill) ──
  // NOTA: recommend-format y build-index son puros (TS) y no cobran.
  "infoproductos:validate-demand": 2,
  "infoproductos:review-infoproduct": 2,
  "infoproductos:review-style": 2,
  "infoproductos:generate-cover": 3,
  "infoproductos:generate-sales-page": 3,
  "infoproductos:assemble-infoproduct": 8,
} as const;

export type Capability = keyof typeof CREDIT_COSTS;

export function costOf(capability: Capability): number {
  return CREDIT_COSTS[capability];
}

export interface ChargeResult {
  ok: true;
  userId: string;
  cost: number;
  creditsLeft: number;
}

export interface ChargeError {
  ok: false;
  status: 401 | 402;
  error: string;
}

/**
 * Valida sesión y cobra la capacidad de forma atómica.
 * En caso de fallo de la generación posterior, llamar refundCharge().
 */
export async function chargeForCapability(
  token: string | null,
  capability: Capability
): Promise<ChargeResult | ChargeError> {
  const user = await getSessionUser(token || "");
  if (!user) {
    return { ok: false, status: 401, error: "No autorizado" };
  }

  const cost = costOf(capability);
  const newBalance = await deductCredits(user.id, cost);
  if (newBalance === null) {
    return { ok: false, status: 402, error: "Créditos insuficientes" };
  }

  return { ok: true, userId: user.id, cost, creditsLeft: newBalance };
}

/** Reembolso best-effort tras un fallo de generación (mismo costo cobrado). */
export async function refundCharge(userId: string, capability: Capability): Promise<void> {
  await refundCredits(userId, costOf(capability));
}
