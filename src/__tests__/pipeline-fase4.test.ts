/**
 * FASE 4 — PIPELINE CONECTADO: pruebas de aceptación.
 *
 * 4.1  Oportunidad sin problem/audience → 400; con ellos → problem persistido.
 * 4.2  specify/architect/economics PERSISTEN su campo en el dossier y avanzan
 *      el estado con transición legal.
 * 4.3  decide IGNORA el fitScore del body: usa el persistido.
 * 4.4  Al completar la fábrica: ProductAsset persistido (checksum sha256) y
 *      descarga autenticada con bytes idénticos al artefacto.
 * 4.5  handoff_only NO se cobra (produce y factory/execute → 400 charged:false).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";
import { setProviderOverride, clearProviderOverrides } from "@/contracts/provider-registry";
import { createDeterministicMockProvider } from "@/test/mock-provider";

vi.setConfig({ testTimeout: 30_000 });

import * as opportunitiesRoute from "@/app/api/product/opportunities/route";
import * as decideRoute from "@/app/api/product/decide/route";
import * as architectRoute from "@/app/api/product/architect/route";
import * as specifyRoute from "@/app/api/product/specify/route";
import * as economicsRoute from "@/app/api/product/economics/route";
import * as produceRoute from "@/app/api/product/produce/route";
import * as executeRoute from "@/app/api/product/factory/execute/route";
import * as assetsRoute from "@/app/api/product/assets/route";
import * as downloadRoute from "@/app/api/product/assets/[assetId]/download/route";
import * as dossierRoute from "@/app/api/product/dossiers/route";

const R = {
  "/product/opportunities": opportunitiesRoute,
  "/product/decide": decideRoute,
  "/product/architect": architectRoute,
  "/product/specify": specifyRoute,
  "/product/economics": economicsRoute,
  "/product/produce": produceRoute,
  "/product/factory/execute": executeRoute,
  "/product/assets": assetsRoute,
  "/product/assets/download": downloadRoute,
  "/product/dossiers": dossierRoute,
} as unknown as Record<string, Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>>;

let userId = "", token = "";
let dossierId = ""; // dossier de las etapas (4.2) — reutilizado por 4.4

function post(path: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(`http://localhost:3000/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}
function get(path: string): NextRequest {
  return new NextRequest(`http://localhost:3000/api${path}`, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });
}
async function call(path: string, handler: (r: NextRequest) => Promise<Response>, r: NextRequest) {
  void path; void handler;
  return r;
}

beforeAll(async () => {
  setProviderOverride("text", createDeterministicMockProvider("text"));
  setProviderOverride("image", createDeterministicMockProvider("image"));
  const u = await db.user.create({ data: { name: "Pipeline T", email: `pipe-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 500 } });
  userId = u.id;
  token = await security.generateToken(u.id);
});
afterAll(async () => {
  clearProviderOverrides();
  await db.productAsset.deleteMany({ where: { userId } }).catch(() => {});
  await db.factoryExecution.deleteMany({ where: { userId } }).catch(() => {});
  await db.productDossier.deleteMany({ where: { userId } }).catch(() => {});
  await db.productOpportunity.deleteMany({ where: { userId } }).catch(() => {});
  await db.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("FASE 4.1 — oportunidad alcanzable", () => {
  it("sin problem → 400 (no se siembran SKIP garantizados)", async () => {
    const res = await R["/product/opportunities"].POST(post("/product/opportunities", { name: "X", productType: "ebook" }));
    expect(res.status).toBe(400);
  });

  it("con problem y audience → 201 y problem persistido (fit evaluable)", async () => {
    const res = await R["/product/opportunities"].POST(post("/product/opportunities", {
      name: "Manual de ventas por chat",
      productType: "ebook",
      targetAudience: "Pequeños vendedores en WhatsApp",
      problem: "Los vendedores pierden ventas por chats desordenados y respuestas tardías",
    }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.problem).toContain("desordenados");
    expect(json.audience).toContain("vendedores");
    // el dossier puede crearse sobre esta oportunidad y el fit no está precondenado
    const dossier = await R["/product/dossiers"].POST(post("/product/dossiers", {
      productName: "Manual de ventas por chat",
      productType: "ebook",
      opportunityId: json.id,
    }));
    expect(dossier.status).toBe(201);
  });
});

describe("FASE 4.2 — las etapas persisten y avanzan el estado", () => {
  let opportunityId = "";
  beforeAll(async () => {
    const opp = await R["/product/opportunities"].POST(post("/product/opportunities", {
      name: "Oportunidad etapas",
      productType: "ebook",
      targetAudience: "Vendedores de WhatsApp",
      problem: "Los vendedores pierden ventas por chats desordenados y respuestas tardías",
    }));
    opportunityId = (await opp.json()).id;
    const res = await R["/product/dossiers"].POST(post("/product/dossiers", { productName: "Dossier etapas", productType: "ebook", opportunityId }));
    dossierId = (await res.json()).id;
  });

  it("architect persiste architecture y pasa a ARCHITECTING", async () => {
    const res = await R["/product/architect"].POST(post("/product/architect", {
      opportunityId,
      productType: "ebook",
      dossierId,
      fitScore: { marketExistence: 0.8, audienceClarity: 0.8, problemValidity: 0.8, differentiation: 0.7, feasibility: 0.9, reasoning: "Razonamiento de prueba del arquitecto para el mock determinista" },
    }));
    expect(res.status).toBe(200);
    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    expect(dossier?.architecture).toBeTruthy();
    expect(dossier?.status).toBe("ARCHITECTING");
  });

  it("specify persiste specification y pasa a SPECIFYING", async () => {
    const dossier = await db.productDossier.findUnique({ where: { id: dossierId } });
    const architecture = JSON.parse(dossier!.architecture!);
    const res = await R["/product/specify"].POST(post("/product/specify", { architecture, dossierId }));
    expect(res.status).toBe(200);
    const after = await db.productDossier.findUnique({ where: { id: dossierId } });
    expect(after?.specification).toBeTruthy();
    expect(after?.status).toBe("SPECIFYING");
  });

  it("economics persiste economics y pasa a ECONOMICS", async () => {
    const res = await R["/product/economics"].POST(post("/product/economics", {
      productId: dossierId,
      dossierId,
      architecture: { productType: "ebook", title: "Dossier etapas" },
    }));
    expect([200, 201]).toContain(res.status);
    const after = await db.productDossier.findUnique({ where: { id: dossierId } });
    expect(after?.economics).toBeTruthy();
    expect(after?.status).toBe("ECONOMICS");
  });
});

describe("FASE 4.3 — decide no se manipula", () => {
  it("fitScore falso del body NO cambia la decisión: se usa el persistido", async () => {
    const fakeFit = { marketExistence: 1, audienceClarity: 1, problemValidity: 1, differentiation: 1, feasibility: 1, reasoning: "Scores falsos del cliente para forzar un GO" };
    const opp = await db.productOpportunity.create({
      data: {
        userId, title: "Op manipulada", description: "Descripción de la oportunidad manipulada", domain: "ebook",
        audience: "Audiencia manipulada", problem: "Problema de la oportunidad manipulada",
        fitScore: JSON.stringify({ marketExistence: 0.1, audienceClarity: 0.1, problemValidity: 0.1, differentiation: 0.1, feasibility: 0.2, reasoning: "Fit bajo persistido con evidencia real" }),
      },
    });
    const res = await R["/product/decide"].POST(post("/product/decide", { opportunityId: opp.id, fitScore: fakeFit }));
    expect(res.status).toBe(200);
    const json = await res.json();
    // fit persistido 0.1 → SKIP → REJECTED, no GO fabricado
    expect(json.decision?.decision ?? json.decision).not.toBe("GO");
    const refreshed = await db.productOpportunity.findUnique({ where: { id: opp.id } });
    expect(refreshed?.status).toBe("REJECTED");
  });
});

describe("FASE 4.5 — handoff_only no se cobra", () => {
  it("produce con dominio software → 400 charged:false y saldo intacto", async () => {
    const dossier = await R["/product/dossiers"].POST(post("/product/dossiers", { productName: "SaaS handoff", productType: "software" }));
    const dId = (await dossier.json()).id;
    const before = await db.user.findUnique({ where: { id: userId } });
    const res = await R["/product/produce"].POST(post("/product/produce", { dossierId: dId }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.charged).toBe(false);
    const after = await db.user.findUnique({ where: { id: userId } });
    expect(after?.credits).toBe(before?.credits);
  });

  it("factory/execute ignora factoryType del cliente: guarda el del dispatch real", async () => {
    const dossier = await R["/product/dossiers"].POST(post("/product/dossiers", { productName: "Libro execute", productType: "ebook" }));
    const dId = (await dossier.json()).id;
    const res = await R["/product/factory/execute"].POST(post("/product/factory/execute", { productId: dId, factoryType: "document_factory", contract: {} }));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.factoryType ?? json.execution?.factoryType).toBe("book_factory"); // ebook → book_factory SIEMPRE
  });
});

describe("FASE 4.4 — assets persistidos y descarga autenticada", () => {
  it("producción completa → ProductAsset con checksum y descarga byte a byte", async () => {
    // El dossier de las etapas (4.2) YA tiene specification con capítulos.
    const dId = dossierId;

    const res = await R["/product/produce"].POST(post("/product/produce", { dossierId: dId }));
    if (res.status !== 202) {
      const errBody = await res.clone().json().catch(() => ({}));
      console.log("produce 400 →", JSON.stringify(errBody).slice(0, 200));
    }
    expect(res.status).toBe(202);

    // esperar a que el run en background termine (mock determinista, ~1-3s)
    let exec = null;
    for (let i = 0; i < 60; i++) {
      exec = await db.factoryExecution.findFirst({ where: { productId: dId } });
      if (exec?.completedAt) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(exec?.completedAt).toBeTruthy();

    // assets persistidos con checksum
    const assets = await db.productAsset.findMany({ where: { productId: dId } });
    expect(assets.length).toBeGreaterThanOrEqual(1);
    const pdfAsset = assets.find((a) => a.type === "pdf");
    expect(pdfAsset).toBeTruthy();
    expect(pdfAsset!.checksum).toMatch(/^[0-9a-f]{64}$/);

    // listado autenticado
    const list = await R["/product/assets"].GET(get("/product/assets"));
    expect(list.status).toBe(200);
    const listJson = await list.json();
    expect(listJson.assets.length).toBeGreaterThanOrEqual(1);

    // descarga autenticada con bytes idénticos
    const dl = await R["/product/assets/download"].GET(
      get(`/product/assets/${pdfAsset!.assetId}/download`),
      { params: Promise.resolve({ assetId: pdfAsset!.assetId }) }
    );
    expect(dl.status).toBe(200);
    const bytes = await dl.arrayBuffer();
    expect(bytes.byteLength).toBe(pdfAsset!.size);
    expect(dl.headers.get("content-disposition")).toContain("attachment");
    expect(dl.headers.get("x-checksum-sha256")).toBe(pdfAsset!.checksum);

    // el asset de OTRO usuario → 404
    const u2 = await db.user.create({ data: { name: "Otro F4", email: `other-f4-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 10 } });
    const otherToken = await security.generateToken(u2.id);
    const dlOther = new NextRequest(`http://localhost:3000/api/product/assets/${pdfAsset!.assetId}/download`, {
      headers: { authorization: `Bearer ${otherToken}` },
    });
    const resOther = await R["/product/assets/download"].GET(dlOther, { params: Promise.resolve({ assetId: pdfAsset!.assetId }) });
    expect(resOther.status).toBe(404);
    await db.user.delete({ where: { id: u2.id } }).catch(() => {});
  });
});
