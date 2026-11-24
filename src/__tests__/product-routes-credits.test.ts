import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  setProviderOverride,
  clearProviderOverrides,
} from "@/contracts/provider-registry";
import { CREDIT_COSTS } from "@/lib/credit-service";
import type { IGenerationProvider, ProviderResult, ProviderConfig } from "@/contracts/provider.interface";

/**
 * Créditos en el Product Factory (FASE 1) — tests por ruta con proveedor
 * simulado y orquestador simulado:
 *   - sin token   → 401
 *   - sin créditos → 402 y SIN llamada al proveedor
 *   - éxito        → deducción exacta
 *   - fallo del proveedor/pipeline → reembolso
 *
 * Cobertura: fit, architect, economics, specify, produce, factory/execute.
 * El orquestador se simula vía vi.mock: aquí se prueba la lógica de créditos
 * de la ruta; la fábrica real tiene sus propias suites (book-factory, etc.).
 */

vi.mock("@/lib/product-factory-orchestrator", () => ({
  executeFactory: vi.fn(),
  resolveFactory: vi.fn(() => "book_factory"),
}));

import { executeFactory } from "@/lib/product-factory-orchestrator";

/* ── Contador de llamadas al proveedor ────────────────────────── */

const providerCalls = { text: 0, image: 0 };

function makeMockProvider(
  kind: "text" | "image",
  content: string | null = null,
  shouldThrow = false
): IGenerationProvider {
  const config: ProviderConfig = {
    id: `mock-${kind}`,
    name: `Mock ${kind}`,
    type: kind,
    priority: 1,
    enabled: true,
    maxRetries: 0,
    timeoutMs: 1000,
  };
  return {
    config,
    async generate(): Promise<ProviderResult> {
      providerCalls[kind]++;
      if (shouldThrow) throw new Error("PROVIDER_DOWN");
      return {
        success: true,
        data: kind === "text" ? { content: content ?? "{}" } : { base64: "bW9jaw==" },
        providerId: `mock-${kind}`,
        cost: 0,
        latencyMs: 1,
        evidence: { truthLevel: "VERIFIED", model: "mock", timestamp: new Date().toISOString() },
      };
    },
    async isAvailable() { return true; },
    getCapabilities() { return [kind]; },
    estimateCost() { return 0; },
  };
}

/* ── JSON válidos por motor (los schemas zod reales) ──────────── */

const FIT_JSON = JSON.stringify({
  marketExistence: 0.8, audienceClarity: 0.9, problemValidity: 0.85,
  differentiation: 0.7, feasibility: 0.75,
  reasoning: "Mercado claro con audiencia definida y problema real",
});

const ARCH_JSON = JSON.stringify({
  architecture: "Arquitectura de ebook con 3 capítulos progresivos",
  components: [{ name: "Contenido", type: "content", description: "Capítulos del libro", dependencies: [] }],
  dependencies: [], constraints: ["Fit alto"], estimatedDuration: "2 semanas",
  technologyStack: ["pdf-factory"],
  chapters: [{ number: 1, title: "Fundamentos", description: "Base del tema", estimatedWords: 1200, keyTopics: ["intro"] }],
  totalWordCount: 3000, artDirection: "minimalista, tipografía serif", format: "pdf",
});

const ECON_JSON = JSON.stringify({
  developmentCost: 500, productionCost: 100, marketingCost: 300,
  pricePerUnit: 18, estimatedUnits: 500,
  riskFactors: [{ description: "Competencia", probability: 0.4, impact: 0.5, mitigation: "Diferenciación" }],
  timelineEstimate: "3 semanas",
});

const SPEC_JSON = JSON.stringify({
  constraints: ["Fit alto"],
  acceptanceCriteria: [{ description: "PDF generado", priority: "MUST", verificationMethod: "QA pipeline" }],
  chapters: [{ chapterNumber: 1, title: "Fundamentos", description: "Base del tema", targetWordCount: 1200, keyTopics: ["intro"], outline: ["Intro", "Desarrollo"], acceptanceCriteria: ["Sin errores"] }],
});

/* ── Arquitectura mínima para economics/specify ───────────────── */

const MIN_ARCH = {
  productType: "ebook",
  architecture: "Arquitectura de ebook con 3 capítulos progresivos",
  components: [{ name: "Contenido", type: "content", description: "Capítulos del libro", dependencies: [] }],
  dependencies: [], constraints: ["Fit alto"], estimatedDuration: "2 semanas",
  technologyStack: ["pdf-factory"], evidence: "INFERRED",
};

/* ── Request helpers ──────────────────────────────────────────── */

function req(url: string, body: unknown, token?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers["authorization"] = `Bearer ${token}`;
  return new NextRequest(`http://localhost:3000${url}`, { method: "POST", headers, body: JSON.stringify(body) });
}

/* ── Fixtures de BD (efímeros) ────────────────────────────────── */

const RICH_EMAIL = `test-prich-${Date.now()}@krea-test.local`;
const POOR_EMAIL = `test-ppoor-${Date.now()}@krea-test.local`;
let richId = ""; let poorId = ""; let richToken = ""; let poorToken = "";
let opportunityId = ""; let dossierId = "";
let poorOpportunityId = ""; let poorDossierId = "";

beforeAll(async () => {
  const rich = await db.user.create({ data: { name: "Rich P", email: RICH_EMAIL, password: security.hashPassword("x"), credits: 100 } });
  const poor = await db.user.create({ data: { name: "Poor P", email: POOR_EMAIL, password: security.hashPassword("x"), credits: 0 } });
  richId = rich.id; poorId = poor.id;
  richToken = await security.generateToken(rich.id);
  poorToken = await security.generateToken(poor.id);

  const opp = await db.productOpportunity.create({
    data: { userId: richId, title: "Ebook de fermentación casera", description: "Guía completa para fermentar vegetales en casa con seguridad y sabor", domain: "ebook", audience: "Cocineros aficionados", problem: "Miedo a la contaminación y procesos confusos", status: "EVALUATING" },
  });
  opportunityId = opp.id;

  const dossier = await db.productDossier.create({
    data: {
      userId: richId, opportunityId, title: "Ebook de fermentación casera", description: "Guía completa de fermentación", domain: "ebook", status: "IDEA",
      // FASE 4.2/4.4: producir exige especificación con capítulos (gate honesto)
      specification: JSON.stringify({
        productId: "spec-fixture", version: "1.0.0",
        chapters: [
          { chapterNumber: 1, title: "Fundamentos de la fermentación", description: "Base científica y práctica", targetWordCount: 320, keyTopics: ["fermentación"], outline: ["Intro"], acceptanceCriteria: [{ description: "Conceptos claros", priority: "MUST", verificationMethod: "revisión" }] },
        ],
      }),
    },
  });
  dossierId = dossier.id;

  // Recursos del usuario pobre: para probar 402 SIN chocar el ownership (403)
  const poorOpp = await db.productOpportunity.create({
    data: { userId: poorId, title: "Ebook pobre de prueba", description: "Descripción suficientemente larga para la validación del motor", domain: "ebook", audience: "Audiencia", problem: "Problema", status: "EVALUATING" },
  });
  poorOpportunityId = poorOpp.id;
  const poorDossier = await db.productDossier.create({
    data: { userId: poorId, opportunityId: poorOpp.id, title: "Ebook pobre de prueba", description: "Descripción", domain: "ebook", status: "IDEA" },
  });
  poorDossierId = poorDossier.id;
});

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: [richId, poorId].filter(Boolean) } } });
});

afterEach(() => {
  clearProviderOverrides();
  vi.mocked(executeFactory).mockReset();
});

/* ── Import de handlers DESPUÉS de mocks ──────────────────────── */

import { POST as fitPOST } from "@/app/api/product/fit/route";
import { POST as architectPOST } from "@/app/api/product/architect/route";
import { POST as economicsPOST } from "@/app/api/product/economics/route";
import { POST as specifyPOST } from "@/app/api/product/specify/route";
import { POST as producePOST } from "@/app/api/product/produce/route";
import { POST as factoryExecutePOST } from "@/app/api/product/factory/execute/route";

/* ── Casos compartidos para las 4 rutas LLM ───────────────────── */

const LLM_CASES = [
  { name: "fit", POST: fitPOST, capability: "product:fit" as const, url: "/api/product/fit",
    body: (id: string) => ({ opportunityId: id }) },
  { name: "architect", POST: architectPOST, capability: "product:architect" as const, url: "/api/product/architect",
    body: (id: string) => ({ opportunityId: id, productType: "ebook", fitScore: { overall: 0.8, evidence: "INFERRED", recommendation: "PROCEED" } }) },
  { name: "economics", POST: economicsPOST, capability: "product:economics" as const, url: "/api/product/economics",
    body: () => ({ productId: "test-product", architecture: MIN_ARCH }) },
  { name: "specify", POST: specifyPOST, capability: "product:specify" as const, url: "/api/product/specify",
    body: () => ({ architecture: MIN_ARCH }) },
];

describe.each(LLM_CASES)("$name — créditos", ({ name, POST, capability, url, body }) => {
  it("401 sin token", async () => {
    setProviderOverride("text", makeMockProvider("text", FIT_JSON));
    const res = await POST(req(url, body(opportunityId)));
    expect(res.status).toBe(401);
  });

  it("402 sin créditos y SIN llamada al proveedor", async () => {
    providerCalls.text = 0; providerCalls.image = 0;
    setProviderOverride("text", makeMockProvider("text", FIT_JSON));
    // El usuario pobre opera sobre SU PROPIA oportunidad (evita 403 de ownership,
    // que es una respuesta legítima previa al cobro para recursos ajenos)
    const res = await POST(req(url, body(poorOpportunityId), poorToken));
    expect(res.status).toBe(402);
    expect(providerCalls.text).toBe(0);   // la ruta NO tocó el proveedor
    expect(providerCalls.image).toBe(0);
  });

  it("éxito: deducción exacta (costo) y resultado INFERRED", async () => {
    providerCalls.text = 0; providerCalls.image = 0;
    setProviderOverride("text", makeMockProvider("text", name === "architect" ? ARCH_JSON : name === "economics" ? ECON_JSON : name === "specify" ? SPEC_JSON : FIT_JSON));
    const before = (await db.user.findUnique({ where: { id: richId } }))!.credits;
    const cost = CREDIT_COSTS[capability];

    const res = await POST(req(url, body(opportunityId), richToken));
    expect([200, 201]).toContain(res.status);
    const json = await res.json();
    expect(json.refunded).toBeUndefined();

    const after = (await db.user.findUnique({ where: { id: richId } }))!.credits;
    expect(after).toBe(before - cost);
    expect(providerCalls.text).toBeGreaterThanOrEqual(1);
    expect(json.credits).toBe(after);
  });

  it("fallo del proveedor: reembolso completo (motor degradado, sin cargo)", async () => {
    providerCalls.text = 0; providerCalls.image = 0;
    setProviderOverride("text", makeMockProvider("text", null, true));
    const before = (await db.user.findUnique({ where: { id: richId } }))!.credits;

    const res = await POST(req(url, body(opportunityId), richToken));
    expect([200, 201]).toContain(res.status); // degradación con gracia, PERO…
    const json = await res.json();
    expect(json.refunded).toBe(true);         // …honesto: reembolsado
    expect(json.data?.evidence).not.toBe("INFERRED"); // NOT_VERIFIED o ESTIMADO

    const after = (await db.user.findUnique({ where: { id: richId } }))!.credits;
    expect(after).toBe(before);               // saldo íntegro
  });
});

/* ── produce y factory/execute (orquestador simulado, modo ASYNC 202) ── */

const ORCH_SUCCESS = {
  executionId: "exec-mock-1", factoryType: "book_factory", status: "COMPLETED",
  progress: [], artifacts: [{ id: "a1", type: "pdf", path: "/tmp/x.pdf" }],
  qaReport: { passed: true }, error: null, startedAt: new Date(), completedAt: new Date(),
};

/** Espera activa hasta que la condición se cumple (el trabajo corre en background) */
async function waitFor<T>(fn: () => Promise<T | null>, timeoutMs = 10000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v !== null && v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("timeout esperando la condición asíncrona");
}

async function creditsOf(userId: string): Promise<number> {
  return (await db.user.findUnique({ where: { id: userId } }))!.credits;
}

describe("produce — créditos de la fábrica completa", () => {
  it("401 sin token", async () => {
    const res = await producePOST(req("/api/product/produce", { dossierId }));
    expect(res.status).toBe(401);
  });

  it("402 sin créditos y executeFactory NUNCA se llama", async () => {
    const res = await producePOST(req("/api/product/produce", { dossierId: poorDossierId }, poorToken));
    expect(res.status).toBe(402);
    expect(vi.mocked(executeFactory)).not.toHaveBeenCalled();
    // el dossier NO entra en PRODUCING sin créditos
    const d = await db.productDossier.findUnique({ where: { id: poorDossierId } });
    expect(d!.status).not.toBe("PRODUCING");
  });

  it("éxito async: 202 inmediato, deducción exacta (12) y dossier → QA en background", async () => {
    vi.mocked(executeFactory).mockResolvedValue(ORCH_SUCCESS as never);
    const before = await creditsOf(richId);

    const res = await producePOST(req("/api/product/produce", { dossierId }, richToken));
    if (res.status !== 202) {
      const err = await res.clone().json().catch(() => ({}));
      console.log("produce 400 →", JSON.stringify(err).slice(0, 200));
    }
    expect(res.status).toBe(202);                 // respuesta inmediata
    const json = await res.json();
    expect(json.mode).toBe("async");
    expect(json.executionId).toBeDefined();
    expect(json.status).toBe("PRODUCING");
    // el cobro fue inmediato aunque la fábrica sigue corriendo
    expect(await creditsOf(richId)).toBe(before - CREDIT_COSTS["product:produce"]);

    // el trabajo en background completa: dossier → QA
    const d = await waitFor(async () => {
      const dd = await db.productDossier.findUnique({ where: { id: dossierId } });
      return dd?.status === "QA" ? dd : null;
    });
    expect(d.status).toBe("QA");
    expect(await creditsOf(richId)).toBe(before - CREDIT_COSTS["product:produce"]); // sin reembolso
    await db.productDossier.update({ where: { id: dossierId }, data: { status: "IDEA" } });
  });

  it("fallo async del pipeline: 202, luego dossier → FAILED y reembolso", async () => {
    vi.mocked(executeFactory).mockResolvedValue({ ...ORCH_SUCCESS, status: "FAILED", error: "cover failed" } as never);
    const before = await creditsOf(richId);

    const res = await producePOST(req("/api/product/produce", { dossierId }, richToken));
    expect(res.status).toBe(202);

    const d = await waitFor(async () => {
      const dd = await db.productDossier.findUnique({ where: { id: dossierId } });
      return dd?.status === "FAILED" ? dd : null;
    });
    expect(d.status).toBe("FAILED");
    const restored = await waitFor(async () => {
      const c = await creditsOf(richId);
      return c === before ? c : null;
    });
    expect(restored).toBe(before);  // reembolsado en background
    await db.productDossier.update({ where: { id: dossierId }, data: { status: "IDEA" } });
  });

  it("excepción async del pipeline: 202, luego ejecución FAILED + reembolso + dossier FAILED", async () => {
    vi.mocked(executeFactory).mockRejectedValue(new Error("PROVIDER_DOWN"));
    const before = await creditsOf(richId);

    const res = await producePOST(req("/api/product/produce", { dossierId }, richToken));
    expect(res.status).toBe(202);
    const json = await res.json();

    const exec = await waitFor(async () => {
      const e = await db.factoryExecution.findFirst({ where: { executionId: json.executionId } });
      return e?.status === "FAILED" ? e : null;
    });
    expect(exec.status).toBe("FAILED");
    // el reembolso ocurre justo después de marcar FAILED en background — esperar el saldo
    const restored = await waitFor(async () => {
      const c = await creditsOf(richId);
      return c === before ? c : null;
    });
    expect(restored).toBe(before);
    const d = await db.productDossier.findUnique({ where: { id: dossierId } });
    expect(d!.status).toBe("FAILED");
    await db.productDossier.update({ where: { id: dossierId }, data: { status: "IDEA" } });
  });

  it("execute:false crea el registro sin cobrar ni ejecutar", async () => {
    const before = (await db.user.findUnique({ where: { id: richId } }))!.credits;
    const res = await producePOST(req("/api/product/produce", { dossierId, execute: false }, richToken));
    expect(res.status).toBe(201);
    const after = (await db.user.findUnique({ where: { id: richId } }))!.credits;
    expect(after).toBe(before);
    expect(vi.mocked(executeFactory)).not.toHaveBeenCalled();
    const d = await db.productDossier.findUnique({ where: { id: dossierId } });
    // FASE 5.3: execute:false ya NO simula un run real — estado honesto QUEUED
    expect(d!.status).toBe("QUEUED");
    await db.productDossier.update({ where: { id: dossierId }, data: { status: "IDEA" } });
  });
});

describe("factory/execute — créditos de la fábrica por executionId", () => {
  it("401 sin token", async () => {
    const res = await factoryExecutePOST(req("/api/product/factory/execute", { productId: dossierId }));
    expect(res.status).toBe(401);
  });

  it("402 sin créditos y executeFactory NUNCA se llama", async () => {
    const res = await factoryExecutePOST(req("/api/product/factory/execute", { productId: poorDossierId }, poorToken));
    expect(res.status).toBe(402);
    expect(vi.mocked(executeFactory)).not.toHaveBeenCalled();
  });

  it("éxito async: 202 inmediato y ejecución COMPLETED en BD", async () => {
    vi.mocked(executeFactory).mockResolvedValue(ORCH_SUCCESS as never);
    const before = await creditsOf(richId);

    const res = await factoryExecutePOST(req("/api/product/factory/execute", { productId: dossierId }, richToken));
    expect(res.status).toBe(202);
    const json = await res.json();
    expect(json.executionId).toBeDefined();
    expect(json.status).toBe("RUNNING");
    expect(await creditsOf(richId)).toBe(before - CREDIT_COSTS["product:factory-execute"]);

    const exec = await waitFor(async () => {
      const e = await db.factoryExecution.findFirst({ where: { executionId: json.executionId } });
      return e?.status === "COMPLETED" ? e : null;
    });
    expect(exec.status).toBe("COMPLETED");
    expect(await creditsOf(richId)).toBe(before - CREDIT_COSTS["product:factory-execute"]);
  });

  it("fallo async del pipeline: 202, luego ejecución FAILED en BD + reembolso", async () => {
    vi.mocked(executeFactory).mockResolvedValue({ ...ORCH_SUCCESS, status: "FAILED", error: "qa failed" } as never);
    const before = await creditsOf(richId);

    const res = await factoryExecutePOST(req("/api/product/factory/execute", { productId: dossierId }, richToken));
    expect(res.status).toBe(202);
    const json = await res.json();

    const exec = await waitFor(async () => {
      const e = await db.factoryExecution.findFirst({ where: { executionId: json.executionId } });
      return e?.status === "FAILED" ? e : null;
    });
    expect(exec.status).toBe("FAILED");
    const restored = await waitFor(async () => {
      const c = await creditsOf(richId);
      return c === before ? c : null;
    });
    expect(restored).toBe(before);
  });

  it("404 para el dossier de otro usuario", async () => {
    vi.mocked(executeFactory).mockResolvedValue(ORCH_SUCCESS as never);
    const res = await factoryExecutePOST(req("/api/product/factory/execute", { productId: dossierId }, poorToken));
    expect([402, 404]).toContain(res.status); // pobre: 402 antes de exponer siquiera existencia
  });
});

/* ── Coherencia documental ─────────────────────────────────────── */

describe("tabla de costos y doctor", () => {
  it("CREDIT_COSTS contiene las 6 capacidades del Product Factory con los valores documentados", () => {
    expect(CREDIT_COSTS["product:fit"]).toBe(2);
    expect(CREDIT_COSTS["product:architect"]).toBe(2);
    expect(CREDIT_COSTS["product:economics"]).toBe(2);
    expect(CREDIT_COSTS["product:specify"]).toBe(2);
    expect(CREDIT_COSTS["product:produce"]).toBe(12);
    expect(CREDIT_COSTS["product:factory-execute"]).toBe(12);
  });

  it("el doctor expone la tabla de costos (check credit_costs)", async () => {
    const { KreaDoctorV2 } = await import("@/lib/doctor-v2");
    const doctor = new KreaDoctorV2();
    const check = await doctor.checkCreditCosts();
    expect(check.name).toBe("credit_costs");
    expect(check.status).toBe("HEALTHY");
    expect(check.details).toContain("product:produce=12");
    expect(check.details).toContain("generate:ebook=8");
  });
});

/* ── Recuperación al arrancar (FASE 2) ────────────────────────── */

describe("recoverStaleRuns — huérfanos tras reinicio del servidor", () => {
  it("ejecución RUNNING huérfana → FAILED + reembolso según contract.chargedCredits", async () => {
    const { recoverStaleRuns } = await import("@/lib/production-recovery");
    const u = await db.user.create({ data: { name: "Rec Test", email: `test-rec-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 5 } });
    const opp = await db.productOpportunity.create({ data: { userId: u.id, title: "Opp recovery", description: "Descripción suficientemente larga", domain: "ebook", audience: "A", problem: "P" } });
    const dossier = await db.productDossier.create({ data: { userId: u.id, opportunityId: opp.id, title: "Opp recovery", description: "Descripción", domain: "ebook", status: "PRODUCING" } });
    await db.factoryExecution.create({
      data: {
        userId: u.id, executionId: `rec-${Date.now()}`, productId: dossier.id,
        factoryType: "book_factory",
        contract: JSON.stringify({ chargedCredits: 12, capability: "product:produce" }),
        status: "RUNNING", startedAt: new Date(),
        // FASE 2.5: lease de 10 min — solo se recupera lo que lleva inactivo
        // más que el umbral (una run VIVA no se toca). updatedAt explícito.
        updatedAt: new Date(Date.now() - 11 * 60 * 1000),
      },
    });

    const report = await recoverStaleRuns();

    expect(report.recoveredExecutions).toBeGreaterThanOrEqual(1);
    expect(report.refundsIssued).toBeGreaterThanOrEqual(1);
    expect(report.refundedCredits).toBeGreaterThanOrEqual(12);
    expect((await db.user.findUnique({ where: { id: u.id } }))!.credits).toBe(17); // 5 + 12
    const exec = await db.factoryExecution.findFirst({ where: { productId: dossier.id } });
    expect(exec!.status).toBe("FAILED");
    expect(exec!.error).toBe("server_restart_recovery");
    const d = await db.productDossier.findUnique({ where: { id: dossier.id } });
    expect(d!.status).toBe("FAILED");
    const timeline = JSON.parse(d!.timeline ?? "[]") as Array<{ step: string }>;
    expect(timeline.some((t) => t.step === "FACTORY_FAILED" || t.step === "SERVER_RESTART_RECOVERY")).toBe(true);
    await db.user.delete({ where: { id: u.id } });
  });

  it("dossier PRODUCING sin ejecución (execute:false o huérfano antiguo) → FAILED SIN reembolso ciego", async () => {
    const { recoverStaleRuns } = await import("@/lib/production-recovery");
    const u = await db.user.create({ data: { name: "Rec Test 2", email: `test-rec2-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 0 } });
    const opp = await db.productOpportunity.create({ data: { userId: u.id, title: "Opp recovery 2", description: "Descripción suficientemente larga", domain: "ebook", audience: "A", problem: "P" } });
    const dossier = await db.productDossier.create({ data: { userId: u.id, opportunityId: opp.id, title: "Opp recovery 2", description: "Descripción", domain: "ebook", status: "PRODUCING" } });

    const report = await recoverStaleRuns();

    expect(report.recoveredDossiers).toBeGreaterThanOrEqual(1);
    const d = await db.productDossier.findUnique({ where: { id: dossier.id } });
    expect(d!.status).toBe("FAILED");
    // sin cobro verificado → sin reembolso (el usuario seguía en 0 créditos)
    expect((await db.user.findUnique({ where: { id: u.id } }))!.credits).toBe(0);
    await db.user.delete({ where: { id: u.id } });
  });

  it("un servidor sin huérfanos no reembolsa nada (idempotente)", async () => {
    const { recoverStaleRuns } = await import("@/lib/production-recovery");
    const report = await recoverStaleRuns();
    expect(report.recoveredExecutions).toBe(0);
    expect(report.recoveredDossiers).toBe(0);
    expect(report.refundedCredits).toBe(0);
  });
});
