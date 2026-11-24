/**
 * FASE 2 — DINERO: pruebas de aceptación (D4 del encargo).
 *
 *  - Por CADA ruta comercial con proveedor que falla: 5xx + `refunded: true`
 *    + créditos restaurados en BD. Cero cobros sin entregable.
 *  - Adapter honesto: payload vacío → success:false (2.2).
 *  - Contenido vacío → fallo + reembolso (2.8).
 *  - Batch/variants: tope de entrada, 400 ANTES de cobrar (2.3).
 *  - Produce idempotente: doble POST → 1 ejecución, 12 créditos UNA vez (2.4).
 *  - refundCreditsOnce: doble llamada → UN reembolso (2.5/2.6).
 *  - Libro de créditos: cuadre inicial − cargos + reembolsos = saldo (2.6).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";
import { setProviderOverride, clearProviderOverrides } from "@/contracts/provider-registry";
import * as logoRoute from "@/app/api/commercial/logo/route";
import * as bannerRoute from "@/app/api/commercial/banner/route";
import * as emailRoute from "@/app/api/commercial/email/route";
import * as catalogRoute from "@/app/api/commercial/catalog/route";
import * as editRoute from "@/app/api/commercial/edit/route";
import * as batchRoute from "@/app/api/commercial/batch/route";
import * as variantsRoute from "@/app/api/commercial/variants/route";
import * as generateImageRoute from "@/app/api/generate/image/route";
import * as generateTextRoute from "@/app/api/generate/text/route";
import * as generatePromptRoute from "@/app/api/generate/prompt/route";
import * as produceRoute from "@/app/api/product/produce/route";

const ROUTES: Record<string, Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>> = {
  "/commercial/logo": logoRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/banner": bannerRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/email": emailRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/catalog": catalogRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/edit": editRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/batch": batchRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/commercial/variants": variantsRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/generate/image": generateImageRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/generate/text": generateTextRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/generate/prompt": generatePromptRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/product/produce": produceRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
};
import type { IGenerationProvider, ProviderResult, ProviderConfig } from "@/contracts/provider.interface";

vi.setConfig({ testTimeout: 20_000 });

/* ── proveedores de prueba ── */

function providerThat(type: "image" | "text", outcome: "fail" | "empty"): IGenerationProvider {
  const config: ProviderConfig = { id: `test-${type}-${outcome}`, name: "test", type, priority: 0, enabled: true, maxRetries: 1, timeoutMs: 1000 };
  return {
    config,
    async generate(): Promise<ProviderResult> {
      if (outcome === "fail") {
        return { success: false, error: "proveedor de prueba caído", data: null, providerId: config.id, cost: 0, latencyMs: 1, evidence: { truthLevel: "OBSERVED", timestamp: new Date().toISOString() } };
      }
      const empty = type === "image" ? { base64: "", url: undefined } : { content: "" };
      return { success: true, data: empty, providerId: config.id, cost: 0, latencyMs: 1, evidence: { truthLevel: "OBSERVED", timestamp: new Date().toISOString() } };
    },
    async isAvailable() { return true; },
    getCapabilities() { return [type]; },
    estimateCost() { return 0; },
  };
}

beforeAll(() => {
  setProviderOverride("image", providerThat("image", "fail"));
  setProviderOverride("image-edit", providerThat("image", "fail"));
  setProviderOverride("text", providerThat("text", "fail"));
});
afterAll(() => {
  // restaurar proveedores reales para las suites siguientes del mismo worker
  clearProviderOverrides();
});

/* ── usuario y helpers ── */

let userId = "", token = "";

beforeAll(async () => {
  const u = await db.user.create({ data: { name: "Money T", email: `money-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 500, plan: "starter" } });
  userId = u.id;
  token = await security.generateToken(u.id);
});
afterAll(async () => {
  await db.creditTransaction.deleteMany({ where: { userId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
});

function post(apiPath: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api${apiPath}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

function route(apiPath: string): Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>> {
  const mod = ROUTES[apiPath];
  if (!mod) throw new Error(`ruta no mapeada en el test: ${apiPath}`);
  return mod;
}

async function credits(): Promise<number> {
  const u = await db.user.findUnique({ where: { id: userId } });
  return u?.credits ?? -1;
}

/* ── D4: cada ruta comercial con proveedor caído → 5xx + refunded + saldo intacto ── */

describe("FASE 2.1 — cada ruta comercial: proveedor caído → 5xx + reembolso", () => {
  const cases: Array<{ path: string; body: Record<string, unknown>; cap: string }> = [
    { path: "/commercial/logo", body: { brandName: "Marca Prueba", industry: "retail", style: "minimal" }, cap: "commercial:logo" },
    { path: "/commercial/banner", body: { productInfo: { name: "Producto de prueba", description: "Descripción del producto de prueba" }, bannerFormat: "leaderboard" }, cap: "commercial:banner" },
    { path: "/commercial/email", body: { productInfo: { name: "Producto de prueba", description: "Descripción del producto de prueba" }, creativeType: "product-showcase" }, cap: "commercial:email" },
    { path: "/commercial/catalog", body: { products: [{ name: "Producto 1", price: 10, description: "Producto uno" }], catalogFormat: "digital-catalog" }, cap: "commercial:catalog" },
    { path: "/commercial/edit", body: { originalImage: "aGVsbG8=", editInstruction: "cambia el fondo a azul" }, cap: "commercial:edit" },
    { path: "/generate/image", body: { prompt: "imagen de prueba" }, cap: "generate:image" },
    { path: "/generate/text", body: { prompt: "texto de prueba" }, cap: "generate:text" },
    { path: "/generate/prompt", body: { description: "descripción del negocio de prueba para el prompt" }, cap: "generate:prompt" },
  ];

  for (const c of cases) {
    it(`${c.path} con proveedor caído → 5xx, refunded:true y saldo restaurado`, async () => {
      const before = await credits();
      const mod = await route(c.path);
      const res = await mod.POST(post(c.path, c.body));
      const status = res.status;
      const json = await res.json();
      expect(status).toBeGreaterThanOrEqual(500);
      expect(json.success).toBe(false);
      expect(json.refunded).toBe(true);
      const after = await credits();
      expect(after).toBe(before); // saldo restaurado EXACTAMENTE
    });
  }

  it("adapter de texto con contenido VACÍO → success:false (2.2)", async () => {
    const { ZAITextAdapter } = await import("@/contracts/zai.adapter");
    vi.mock("z-ai-web-dev-sdk", () => ({
      default: {
        create: async () => ({
          chat: { completions: { create: async () => ({ choices: [{ message: { content: "" } }] }) } },
        }),
      },
    }));
    const adapter = new ZAITextAdapter();
    const result = await adapter.generate({ messages: [{ role: "user", content: "devuelve vacío" }] });
    expect(result.success).toBe(false);
    expect((result as { error?: string }).error).toContain("vacía");
  });
});

/* ── 2.3: tope de entrada ANTES de cobrar ── */

describe("FASE 2.3 — validación de entrada en batch/variants (400 sin cobrar)", () => {
  it("batch con concurrency 0 → 400 y saldo intacto", async () => {
    const before = await credits();
    const mod = await route("/commercial/batch");
    const res = await mod.POST(post("/commercial/batch", { items: [{ name: "x" }], concurrency: 0 }));
    expect(res.status).toBe(400);
    expect(await credits()).toBe(before);
  });

  it("batch con concurrency negativa → 400", async () => {
    const mod = await route("/commercial/batch");
    const res = await mod.POST(post("/commercial/batch", { items: [{ name: "x" }], concurrency: -2 }));
    expect(res.status).toBe(400);
  });

  it("batch con más de 12 items → 400", async () => {
    const mod = await route("/commercial/batch");
    const items = Array.from({ length: 13 }, (_, i) => ({ name: `p${i}` }));
    const res = await mod.POST(post("/commercial/batch", { items, concurrency: 2 }));
    expect(res.status).toBe(400);
  });

  it("variants con count=1000 → 400", async () => {
    const mod = await route("/commercial/variants");
    const res = await mod.POST(post("/commercial/variants", { baseAd: { headline: "x" }, angles: ["urgencia"], count: 1000 }));
    expect(res.status).toBe(400);
  });

  it("variants con count × angles > 12 → 400", async () => {
    const mod = await route("/commercial/variants");
    const res = await mod.POST(post("/commercial/variants", { baseAd: { headline: "x" }, angles: ["a","b","c","d","e","f"], count: 6 }));
    expect(res.status).toBe(400);
  });
});

/* ── 2.4: produce idempotente ── */

describe("FASE 2.4 — produce: doble POST → 1 ejecución y 12 créditos UNA vez", () => {
  it("segundo POST mientras hay run activo → 409 y reembolso del propio cobro", async () => {
    const dossier = await db.productDossier.create({
      data: { userId, title: "Dossier dinero", description: "Descripción del dossier dinero", domain: "ebook", status: "IDEA" },
    });
    try {
      // restaurar proveedores reales→mock pasable para que el primer run arranque
      const { setProviderOverride: spo } = (await import("@/contracts/provider-registry")) as typeof import("@/contracts/provider-registry");
      const { createDeterministicMockProvider } = (await import("@/test/mock-provider")) as typeof import("@/test/mock-provider");
      spo("text", createDeterministicMockProvider("text"));
      spo("image", createDeterministicMockProvider("image"));

      const before = await credits();
      const mod = await route("/product/produce");
      const r1 = await mod.POST(post("/product/produce", { dossierId: dossier.id }));
      expect([202, 201]).toContain(r1.status);
      const r1json = await r1.json();

      const r2 = await mod.POST(post("/product/produce", { dossierId: dossier.id }));
      expect(r2.status).toBe(409);
      const r2json = await r2.json();
      expect(r2json.refunded).toBe(true);

      // UNA sola ejecución creada para el producto (el 409 no creó otra)
      const runs = await db.factoryExecution.findMany({ where: { productId: dossier.id } });
      expect(runs.length).toBe(1);
      expect(runs[0].executionId).toBe(r1json.executionId);

      // neto: 12 créditos UNA vez (el 409 reembolsa su propio cobro)
      const net = before - (await credits());
      expect(net).toBe(12);
    } finally {
      await db.productDossier.delete({ where: { id: dossier.id } }).catch(() => {});
    }
  });
});

/* ── 2.5/2.6: reembolso idempotente y cuadre del libro ── */

describe("FASE 2.5/2.6 — refundCreditsOnce y libro de créditos", () => {
  it("doble refundCreditsOnce → UN solo incremento y UNA fila del libro", async () => {
    const { refundCreditsOnce } = await import("@/lib/auth");
    const before = await credits();
    const reference = `test-refund-${Date.now()}`;
    const r1 = await refundCreditsOnce(userId, 12, "product:produce", reference);
    const r2 = await refundCreditsOnce(userId, 12, "product:produce", reference);
    expect(r1).toBe(true);
    expect(r2).toBe(false); // idempotente
    expect(await credits()).toBe(before + 12); // UNA vez
    const rows = await db.creditTransaction.findMany({ where: { userId, reference, kind: "REFUND" } });
    expect(rows.length).toBe(1);
    await db.creditTransaction.deleteMany({ where: { userId, reference } });
  });

  it("cuadre del libro: saldo = inicial − cargos + reembolsos", async () => {
    // Usuario AISLADO: el usuario compartido tiene un run en background de la
    // prueba 2.4 que podría reembolsar a mitad del cuadre (race honesto).
    const { deductCredits, refundCreditsOnce } = await import("@/lib/auth");
    const u2 = await db.user.create({ data: { name: "Cuadre", email: `cuadre-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 100 } });
    const initial = u2.credits;
    const ref = `cuadre-${Date.now()}`;
    const c1 = await deductCredits(u2.id, 3, { capability: "generate:image" });
    const c2 = await deductCredits(u2.id, 2, { capability: "generate:text" });
    await refundCreditsOnce(u2.id, 2, "generate:text", ref);

    const charges = await db.creditTransaction.aggregate({ where: { userId: u2.id, kind: "CHARGE" }, _sum: { amount: true } });
    // TODOS los reembolsos del libro (con y sin reference): el cuadre es contra
    // el total movido, no solo los idempotentes por referencia.
    const refunds = await db.creditTransaction.aggregate({ where: { userId: u2.id, kind: "REFUND" }, _sum: { amount: true } });

    const expected = initial - (charges._sum.amount ?? 0) + (refunds._sum.amount ?? 0);
    const u2after = await db.user.findUnique({ where: { id: u2.id } });
    const saldo = u2after?.credits ?? -1;
    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();
    expect(saldo).toBe(expected); // cuadre exacto del libro
    await db.creditTransaction.deleteMany({ where: { userId: u2.id } }).catch(() => {});
    await db.user.delete({ where: { id: u2.id } }).catch(() => {});
  });
});
