/**
 * FASE 1 — pruebas de aceptación de seguridad:
 *
 * 1.2  Aislamiento multi-tenant con 2 usuarios REALES por cada ruta tocada:
 *      el ajeno → 404 (nunca 403, sin filtrar existencia).
 * 1.4  verifyPassword no lanza con hash malformado (suite security.test.ts).
 *      Registro: el límite por IP no bloquea el flujo legítimo y N+1 → 429.
 * 1.5  Logout: tras revocar, el token viejo devuelve 401.
 * 1.6  Rate limit de coste: N+1 llamadas → 429 SIN cobro (saldo intacto).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";
import { setProviderOverride } from "@/contracts/provider-registry";
import { createDeterministicMockProvider } from "@/test/mock-provider";

vi.setConfig({ testTimeout: 20_000 });

// El rate limit de coste ejercita la RUTA real 12 veces — el proveedor es
// determinista (sin red). Lo que se prueba: el cobro y el 429, no el SDK.
setProviderOverride("text", createDeterministicMockProvider("text"));

const USER_A_EMAIL = `mt-A-${Date.now()}@krea-test.local`;
const USER_B_EMAIL = `mt-B-${Date.now()}@krea-test.local`;
let userAId = "", userBId = "";
let tokenA = "", tokenB = "";
let memoryAId = "";
let dossierAId = "";
let opportunityAId = "";

function authed(method: "GET" | "POST" | "DELETE", urlPath: string, token: string, body?: unknown): NextRequest {
  const url = `http://localhost:3000/api${urlPath}`;
  const headers = { "content-type": "application/json", authorization: `Bearer ${token}` };
  if (body !== undefined) {
    return new NextRequest(url, { method, headers, body: JSON.stringify(body) });
  }
  return new NextRequest(url, { method, headers });
}

import * as memoryRoute from "@/app/api/adn/memory/route";
import * as executionRoute from "@/app/api/adn/execution/route";
import * as auditRoute from "@/app/api/adn/security/audit/route";
import * as observabilityRoute from "@/app/api/adn/observability/route";
import * as feedbackRoute from "@/app/api/adn/feedback/route";
import * as agentCommRoute from "@/app/api/adn/agent-comm/route";
import * as dossiersRoute from "@/app/api/product/dossiers/route";
import * as qaRoute from "@/app/api/product/qa/route";
import * as registerRoute from "@/app/api/auth/register/route";
import * as loginRoute from "@/app/api/auth/login/route";
import * as meRoute from "@/app/api/auth/me/route";
import * as logoutRoute from "@/app/api/auth/logout/route";
import * as promptRoute from "@/app/api/generate/prompt/route";

const ROUTES: Record<string, Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>> = {
  "/adn/memory": memoryRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/adn/execution": executionRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/adn/security/audit": auditRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/adn/observability": observabilityRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/adn/feedback": feedbackRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/adn/agent-comm": agentCommRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/product/dossiers": dossiersRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/product/qa": qaRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/auth/register": registerRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/auth/login": loginRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/auth/me": meRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/auth/logout": logoutRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
  "/generate/prompt": promptRoute as unknown as Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>,
};

const handlers: Record<string, Record<string, (req: NextRequest, ctx?: unknown) => Promise<Response>>> = {};
async function route(apiPath: string) {
  const mod = ROUTES[apiPath];
  if (!mod) throw new Error(`ruta no mapeada en el test: ${apiPath}`);
  return mod;
}

beforeAll(async () => {
  const a = await db.user.create({ data: { name: "MT A", email: USER_A_EMAIL, password: security.hashPassword("x"), credits: 200 } });
  const b = await db.user.create({ data: { name: "MT B", email: USER_B_EMAIL, password: security.hashPassword("x"), credits: 200 } });
  userAId = a.id; userBId = b.id;
  tokenA = await security.generateToken(a.id);
  tokenB = await security.generateToken(b.id);

  const opp = await db.productOpportunity.create({
    data: { userId: userAId, title: "Op de A", description: "Descripción larga de la oportunidad de A", domain: "ebook", audience: "Audiencia A", problem: "Problema A" },
  });
  opportunityAId = opp.id;
  const dossier = await db.productDossier.create({
    data: { userId: userAId, opportunityId: opp.id, title: "Dossier MT de A", description: "Descripción del dossier de A", domain: "ebook", status: "IDEA" },
  });
  dossierAId = dossier.id;
  const mem = await db.memory.create({
    data: {
      agentId: "krea",
      domain: "test",
      type: "FACTUAL",
      content: "Memoria privada de A — no debe verse desde B",
      userId: userAId,
      confidence: 0.9,
      relevance: 0.9,
    },
  });
  memoryAId = mem.id;
});

afterAll(async () => {
  await db.memory.deleteMany({ where: { id: memoryAId } }).catch(() => {});
  await db.productDossier.deleteMany({ where: { id: dossierAId } }).catch(() => {});
  await db.productOpportunity.deleteMany({ where: { id: opportunityAId } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [userAId, userBId].filter(Boolean) } } }).catch(() => {});
});

describe("FASE 1.2 — aislamiento multi-tenant por ruta tocada", () => {
  it("adn/memory GET: B solo ve sus memorias (las de A no aparecen)", async () => {
    const mod = await route("/adn/memory");
    const res = await mod.GET(authed("GET", "/adn/memory", tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(memoryAId);
    expect(text).not.toContain("no debe verse desde B");
  });

  it("adn/memory GET sin token → 401", async () => {
    const mod = await route("/adn/memory");
    const res = await mod.GET(authed("GET", "/adn/memory", ""));
    expect(res.status).toBe(401);
  });

  it("adn/memory DELETE: invalidar la memoria de A con token de B → 404 y la memoria sigue ACTIVE", async () => {
    const mod = await route("/adn/memory");
    const res = await mod.DELETE(authed("DELETE", "/adn/memory", tokenB, { id: memoryAId, reason: "intento ajeno" }));
    expect(res.status).toBe(404);
    const mem = await db.memory.findUnique({ where: { id: memoryAId } });
    expect(mem?.status).toBe("ACTIVE"); // el dueño decide; B no pudo invalidarla
  });

  it("adn/execution GET: ?userId= del cliente se ignora — B ve solo lo suyo", async () => {
    const mod = await route("/adn/execution");
    const res = await mod.GET(authed("GET", `/adn/execution?userId=${encodeURIComponent(userAId)}`, tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(userAId);
  });

  it("adn/security/audit GET: B no lee el audit trail de A", async () => {
    const mod = await route("/adn/security/audit");
    const res = await mod.GET(authed("GET", "/adn/security/audit", tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(userAId);
  });

  it("adn/observability GET: las métricas de B no agregan ejecuciones de A", async () => {
    const mod = await route("/adn/observability");
    const res = await mod.GET(authed("GET", "/adn/observability", tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(userAId);
  });

  it("adn/feedback GET: B no lee feedback de A", async () => {
    const mod = await route("/adn/feedback");
    const res = await mod.GET(authed("GET", "/adn/feedback", tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(userAId);
  });

  it("adn/agent-comm GET: B no lee interacciones de A", async () => {
    const mod = await route("/adn/agent-comm");
    const res = await mod.GET(authed("GET", "/adn/agent-comm", tokenB));
    expect(res.status).toBe(200);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(userAId);
  });

  it("product/dossiers POST: crear dossier sobre la opportunity de A con token de B → 404", async () => {
    const mod = await route("/product/dossiers");
    const res = await mod.POST(authed("POST", "/product/dossiers", tokenB, { productName: "Dossier espía", opportunityId: opportunityAId }));
    expect(res.status).toBe(404);
  });

  it("product/qa POST: QA del dossier de A con token de B → 404 (sin sonda de rutas)", async () => {
    const mod = await route("/product/qa");
    const res = await mod.POST(authed("POST", "/product/qa", tokenB, { productId: dossierAId, artifactPath: "/etc/passwd" }));
    expect(res.status).toBe(404);
  });

  it("product/qa POST: artifactPath fuera del storage → 400 (sin sonda de rutas)", async () => {
    const mod = await route("/product/qa");
    const res = await mod.POST(authed("POST", "/product/qa", tokenA, { productId: dossierAId, artifactPath: "/etc/passwd" }));
    expect(res.status).toBe(400);
  });
});

describe("FASE 1.4 — registro y contraseñas", () => {
  it("verifyPassword('' , hash malformado) → false sin lanzar", () => {
    expect(security.verifyPassword("", "not-a-hash")).toBe(false);
    expect(() => security.verifyPassword("", "$pbkdf2$100000$z$zz")).not.toThrow();
    expect(security.verifyPassword("", "$pbkdf2$100000$z$zz")).toBe(false);
  });

  it("2 registros seguidos desde la misma IP no superan el cupo (límite 5/min)", async () => {
    security.resetRateLimits(); // aislamiento del bucket compartido entre suites
    const mod = await route("/auth/register");
    const mk = (email: string) => new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "RL", email, password: "secreto123" }),
    });
    const r1 = await mod.POST(mk(`rl1-${Date.now()}@krea-test.local`));
    expect(r1.status).toBe(200); // la ruta responde 200 en éxito
    const r2 = await mod.POST(mk(`rl2-${Date.now()}@krea-test.local`));
    expect(r2.status).toBe(200); // el cupo legítimo no se agota a la segunda
    const r3 = await mod.POST(mk(`rl3-${Date.now()}@krea-test.local`));
    expect(r3.status).toBe(200);
    const r4 = await mod.POST(mk(`rl4-${Date.now()}@krea-test.local`));
    expect(r4.status).toBe(200);
    const r5 = await mod.POST(mk(`rl5-${Date.now()}@krea-test.local`));
    expect(r5.status).toBe(200);
    const r6 = await mod.POST(mk(`rl6-${Date.now()}@krea-test.local`));
    expect(r6.status).toBe(429); // el 6.º en el mismo minuto → 429
    // limpieza de los usuarios creados
    await db.user.deleteMany({ where: { email: { contains: `@krea-test.local` }, name: "RL" } });
  });

  it("login con email inexistente y con password errónea devuelven lo mismo", async () => {
    const mod = await route("/auth/login");
    const mk = (email: string, password: string) => new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const unknown = await mod.POST(mk(`no-existe-${Date.now()}@krea-test.local`, "cualquiera123"));
    const wrong = await mod.POST(mk(USER_A_EMAIL, "password-equivocada"));
    expect(unknown.status).toBe(wrong.status);
    const bodyUnknown = JSON.stringify(await unknown.json());
    const bodyWrong = JSON.stringify(await wrong.json());
    expect(bodyUnknown).toBe(bodyWrong); // mismo mensaje, sin oráculo de enumeración
  });
});

describe("FASE 1.5 — logout revoca la sesión", () => {
  it("tras logout, el token viejo devuelve 401", async () => {
    const temp = await db.user.create({ data: { name: "Logout U", email: `lo-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 10 } });
    const tok = await security.generateToken(temp.id);

    const me = await route("/auth/me");
    const before = await me.GET(authed("GET", "/auth/me", tok));
    expect(before.status).toBe(200);

    const mod = await route("/auth/logout");
    const res = await mod.POST(authed("POST", "/auth/logout", tok));
    expect(res.status).toBe(200);

    const after = await me.GET(authed("GET", "/auth/me", tok));
    expect(after.status).toBe(401); // el token viejo ya no vale

    await db.user.delete({ where: { id: temp.id } }).catch(() => {});
  });
});

describe("FASE 1.6 — rate limit de coste (N+1 → 429 sin cobro)", () => {
  it("13 llamadas a /api/generate/prompt → la 13.ª es 429 y el saldo no baja más", async () => {
    security.resetRateLimits();
    const u = await db.user.create({ data: { name: "RL Cost", email: `cost-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 200 } });
    const tok = await security.generateToken(u.id);

    const mod = await route("/generate/prompt");
    const mk = () => authed("POST", "/generate/prompt", tok, { prompt: "probando rate limit de coste" });

    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) {
      const res = await mod.POST(mk());
      statuses.push(res.status);
      await res.text();
    }
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1); // alguna 429
    expect(statuses[12]).toBe(429); // la 13.ª NO cobra

    const after = await db.user.findUnique({ where: { id: u.id } });
    // 2 créditos por llamada exitosa (CREDIT_COSTS["generate:prompt"]) — el 429 no cobra
    const spent = 200 - (after?.credits ?? 0);
    expect(spent).toBeLessThanOrEqual(24); // ≤ 12 llamadas cobradas, nunca 13

    await db.user.delete({ where: { id: u.id } }).catch(() => {});
  });
});
