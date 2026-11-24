/**
 * FASE 3 — GATES HONESTOS: pruebas de aceptación.
 *
 * 3.1  Handoff `send` sin proveedor → 409, queda READY, evidencia NOT_VERIFIED.
 * 3.2  Launch package con testimonio inventado → 422 y NO se persiste;
 *      paquete válido → 201 con integrityCheck válido persistido.
 * 3.3  Readiness sin QA y con QA crítico → NUNCA READY_FOR_SALE.
 * 3.4  Publicar sin puertas → 409; transición ilegal → 409.
 * 3.5  Versiones: semver estricto, status DRAFT obligatorio, propiedad, 409 duplicado.
 * 3.6  visual-qa: los checks NOT_VERIFIED NO cuentan como pasa.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";

vi.setConfig({ testTimeout: 20_000 });

let userId = "", token = "";
let dossierId = "";
let handoffId = "";

const handlers: Record<string, Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>> = {};
function route(path: string, mod: unknown) {
  handlers[path] = mod as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>;
  return handlers[path];
}

import * as handoffRoute from "@/app/api/product/handoff/[id]/route";
import * as launchPackageRoute from "@/app/api/product/launch-package/route";
import * as readinessRoute from "@/app/api/product/readiness/route";
import * as versionsRoute from "@/app/api/product/versions/route";
import * as dossierPatchRoute from "@/app/api/product/dossiers/[id]/route";
route("/handoff/:id", handoffRoute);
route("/launch-package", launchPackageRoute);
route("/readiness", readinessRoute);
route("/versions", versionsRoute);
route("/dossiers/:id", dossierPatchRoute);

function req(method: "GET" | "POST" | "PATCH", path: string, body?: unknown, params?: Record<string, string>) {
  const url = `http://localhost:3000/api${path}`;
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const init = method === "GET" ? { method, headers } : { method, headers, body: JSON.stringify(body ?? {}) };
  return [new NextRequest(url, init), { params: Promise.resolve(params ?? {}) }] as const;
}

beforeAll(async () => {
  const u = await db.user.create({ data: { name: "Gates T", email: `gates-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 100 } });
  userId = u.id;
  token = await security.generateToken(u.id);

  const dossier = await db.productDossier.create({
    data: { userId, title: "Dossier gates", description: "Descripción del dossier gates", domain: "ebook", status: "QA" },
  });
  dossierId = dossier.id;

  const handoff = await db.handoff.create({
    data: { dossierId, targetProvider: "inexistente", objective: "Objetivo de prueba del handoff", productId: dossierId, status: "READY" },
  });
  handoffId = handoff.id;
});

afterAll(async () => {
  await db.handoff.deleteMany({ where: { dossierId } }).catch(() => {});
  await db.launchPackage.deleteMany({ where: { userId } }).catch(() => {});
  await db.productVersionRecord.deleteMany({ where: { userId } }).catch(() => {});
  await db.commercialProduct.deleteMany({ where: { userId } }).catch(() => {});
  await db.productDossier.deleteMany({ where: { id: dossierId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("FASE 3.1 — handoff send sin proveedor NO llega a SENT", () => {
  it("send con proveedor inexistente → 409 y la fila queda READY con evidencia NOT_VERIFIED", async () => {
    const [r, ctx] = req("POST", `/product/handoff/${handoffId}`, { action: "send" }, { id: handoffId });
    const mod = handlers["/handoff/:id"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(409);
    const row = await db.handoff.findUnique({ where: { id: handoffId } });
    expect(row?.status).toBe("READY"); // nunca SENT simulado
    const evidence = JSON.parse(row?.evidence ?? "{}");
    expect(evidence.externalSend).toBe("NOT_VERIFIED");
  });

  it("send desde CREATED → 400 (transición inválida, sin saltos)", async () => {
    const d2 = await db.productDossier.create({
      data: { userId, title: "Dossier gates 2", description: "Descripción del dossier gates 2", domain: "ebook", status: "IDEA" },
    });
    const h = await db.handoff.create({
      data: { dossierId: d2.id, targetProvider: "inexistente", objective: "Objetivo dos del handoff", productId: d2.id, status: "CREATED" },
    });
    const [r, ctx] = req("POST", `/product/handoff/${h.id}`, { action: "send" }, { id: h.id });
    const mod = handlers["/handoff/:id"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(400);
    await db.handoff.delete({ where: { id: h.id } });
  });
});

describe("FASE 3.2 — launch package con integridad", () => {
  const validBody = {
    product: { name: "Manual de ventas", type: "ebook", description: "Guía práctica para ordenar ventas por chat", version: "1.0.0" },
    offer: { problem: "El chat desordenado pierde ventas", promise: "Un sistema simple para responder rápido", mechanism: "Plantillas y pasos verificados" },
    positioning: "El manual práctico para vender en el chat sin herramientas de pago",
    targetCustomer: { description: "Pequeños vendedores que usan WhatsApp a diario" },
    corePromise: "Ordena tu catálogo y responde en segundos",
    cta: "Descarga el manual hoy",
    price: { amount: 19, currency: "USD" },
    benefits: ["Ordena tu catálogo en minutos", "Responde con plantillas listas", "Cobra sin fricción"],
    delivery: { method: "descarga directa", access: "email" },
  };

  it("paquete con testimonio inventado → 422 y NO se persiste", async () => {
    const [r, ctx] = req("POST", "/product/launch-package", {
      ...validBody,
      productId: dossierId,
      disclaimers: ["This product changed my life, funciona como magia"],
    });
    const mod = handlers["/launch-package"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.integrityIssues.length).toBeGreaterThanOrEqual(1);
    const rows = await db.launchPackage.findMany({ where: { userId, productId: dossierId } });
    expect(rows.length).toBe(0); // NO se persiste como válido
  });

  it("paquete con campos requeridos vacíos → 422", async () => {
    const [r, ctx] = req("POST", "/product/launch-package", { productId: dossierId, corePromise: "", cta: "" });
    const mod = handlers["/launch-package"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect([400, 422]).toContain(res.status);
  });

  it("paquete válido → 201 con integrityCheck válido persistido", async () => {
    const [r, ctx] = req("POST", "/product/launch-package", { productId: dossierId, ...validBody, version: "1.0.0" });
    const mod = handlers["/launch-package"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(201);
    const row = await db.launchPackage.findFirst({ where: { userId, productId: dossierId } });
    expect(row).toBeTruthy();
    const check = JSON.parse(row!.integrityCheck);
    expect(check.valid).toBe(true);
    expect(check.integrityIssues.length).toBe(0);
  });
});

describe("FASE 3.3 — readiness fail-closed", () => {
  it("sin QA ejecutado y sin artefactos → estado NUNCA READY_FOR_SALE", async () => {
    await db.commercialProduct.create({
      data: {
        userId,
        productId: dossierId,
        productName: "Manual de ventas",
        productType: "ebook",
        targetCustomer: JSON.stringify({ description: "vendedores" }),
        problem: "chat desordenado",
        jobToBeDone: "responder rápido con orden",
        desiredOutcome: "más ventas por semana",
        valueProposition: "El sistema simple para vender en el chat",
        differentiation: "Plantillas probadas en ventas reales",
        format: "pdf",
        priceStrategy: JSON.stringify({ model: "one-time" }),
        priceRange: JSON.stringify({ min: 9, max: 29 }),
        monetizationModel: "one-time",
        distributionStrategy: "direct",
        positioning: "El manual práctico para vender en el chat",
        keyBenefits: JSON.stringify(["Orden en minutos", "Respuestas listas"]),
        objections: JSON.stringify([]),
        proofRequirements: JSON.stringify([]),
        launchRequirements: JSON.stringify([]),
        risks: JSON.stringify([]),
      },
    });
    const [r, ctx] = req("POST", "/product/readiness", { productId: dossierId });
    const mod = handlers["/readiness"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.readiness.state).not.toBe("READY_FOR_SALE");
    // requisitos críticos visibles: QA pasado + artefacto producido
    const criticals = json.readiness.blockers as string[];
    expect(criticals.length).toBeGreaterThanOrEqual(2);
  });
});

describe("FASE 3.4 — publicar exige puertas", () => {
  it("PUBLISHED sin readiness → 409", async () => {
    const [r, ctx] = req("PATCH", `/product/dossiers/${dossierId}`, { status: "PUBLISHED" }, { id: dossierId });
    const mod = handlers["/dossiers/:id"];
    const res = await mod.PATCH(r as NextRequest, ctx);
    expect(res.status).toBe(409);
  });

  it("transición ilegal → 409", async () => {
    const [r, ctx] = req("PATCH", `/product/dossiers/${dossierId}`, { status: "IDEA" }, { id: dossierId });
    const mod = handlers["/dossiers/:id"];
    const res = await mod.PATCH(r as NextRequest, ctx);
    expect(res.status).toBe(409); // QA → IDEA no está en la whitelist
  });
});

describe("FASE 3.5 — versiones honestas", () => {
  it("versión no-semver → 400", async () => {
    const [r, ctx] = req("POST", "/product/versions", { productId: dossierId, version: "v1", status: "PUBLISHED" });
    const mod = handlers["/versions"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(400);
  });

  it("status del cliente se IGNORA → siempre DRAFT", async () => {
    const [r, ctx] = req("POST", "/product/versions", { productId: dossierId, version: "1.0.0", status: "PUBLISHED" });
    const mod = handlers["/versions"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(201);
    const row = await db.productVersionRecord.findFirst({ where: { userId, productId: dossierId, version: "1.0.0" } });
    expect(row?.status).toBe("DRAFT");
  });

  it("productId ajeno → 404", async () => {
    const otherUser = await db.user.create({
      data: { name: "Otro F3", email: `other-f3-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 5 },
    });
    const other = await db.productDossier.create({
      data: { userId: otherUser.id, title: "Ajeno", description: "Dossier de otro usuario", domain: "ebook", status: "IDEA" },
    });
    const [r, ctx] = req("POST", "/product/versions", { productId: other.id, version: "1.0.0" });
    const mod = handlers["/versions"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(404);
    await db.productDossier.delete({ where: { id: other.id } });
    await db.user.delete({ where: { id: otherUser.id } });
  });

  it("duplicado → 409", async () => {
    const [r, ctx] = req("POST", "/product/versions", { productId: dossierId, version: "1.0.0" });
    const mod = handlers["/versions"];
    const res = await mod.POST(r as NextRequest, ctx);
    expect(res.status).toBe(409);
  });
});

describe("FASE 3.6 — visual-qa: NOT_VERIFIED no cuenta como pasa", () => {
  it("runVisualQA devuelve unverifiedCount y los checks 8/9 no están en passed", async () => {
    const { runVisualQA } = await import("@/lib/visual-qa");
    // PDF mínimo real generado con pdf-lib para ejercitar la ruta completa
    const { PDFDocument } = await import("pdf-lib");
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage([300, 400]);
    const bytes = await pdfDoc.save();
    const os = await import("node:os");
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fase3-qa-"));
    const pdfPath = path.join(dir, "min.pdf");
    await fs.writeFile(pdfPath, bytes);

    const report = await runVisualQA("fase3-product", pdfPath);
    expect(report.unverifiedCount).toBeGreaterThanOrEqual(2); // rendering + image quality
    const names = report.checks.map((c) => c.name);
    const rendering = report.checks.find((c) => c.name === "visual_rendering_quality");
    const imgq = report.checks.find((c) => c.name === "image_quality");
    expect(rendering?.passed).toBe(false);
    expect(imgq?.passed).toBe(false);
    await fs.rm(dir, { recursive: true, force: true });
  });
});
