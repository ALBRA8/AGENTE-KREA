/**
 * UI1 — GET /api/product/launch-package (listado real para la sección Launch)
 *
 * 1. Sin token → 401.
 * 2. Aislamiento: el listado SOLO contiene paquetes del usuario autenticado;
 *    el paquete de otro usuario no aparece ni por GET listado ni por GET [id].
 * 3. Listado correcto: orden por fecha desc y campos persistidos intactos.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";

import { GET as listRoute, POST as createRoute } from "@/app/api/product/launch-package/route";
import { GET as getByIdRoute } from "@/app/api/product/launch-package/[id]/route";

vi.setConfig({ testTimeout: 20_000 });

let userA = { id: "", token: "" };
let userB = { id: "", token: "" };
let pkgA1 = "", pkgA2 = "", pkgB1 = "";
let dossierA = "", dossierB = "";

function reqList(token: string) {
  return new NextRequest("http://localhost:3000/api/product/launch-package", {
    method: "GET",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

function reqGetById(token: string, id: string) {
  return [
    new NextRequest(`http://localhost:3000/api/product/launch-package/${id}`, {
      method: "GET",
      headers: { authorization: `Bearer ${token}` },
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

async function createPackage(token: string, productId: string, name: string, corePromise: string) {
  const body = {
    productId,
    product: { name, type: "ebook", description: `Descripción de ${name}`, version: "1.0.0" },
    offer: { problem: "Problema real del cliente", promise: "Promesa concreta", mechanism: "Mecanismo verificado" },
    positioning: `Posicionamiento de ${name}`,
    targetCustomer: { description: "Cliente objetivo descrito" },
    corePromise,
    cta: "Descarga hoy",
    price: { amount: 19, currency: "USD" },
    benefits: ["Beneficio uno", "Beneficio dos"],
    delivery: { method: "descarga directa", access: "email" },
  };
  const req = new NextRequest("http://localhost:3000/api/product/launch-package", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return createRoute(req);
}

beforeAll(async () => {
  const a = await db.user.create({ data: { name: "LP A", email: `lp-a-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 100 } });
  userA = { id: a.id, token: await security.generateToken(a.id) };
  const b = await db.user.create({ data: { name: "LP B", email: `lp-b-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 100 } });
  userB = { id: b.id, token: await security.generateToken(b.id) };

  const dA = await db.productDossier.create({ data: { userId: userA.id, title: "Dossier A", description: "Desc A", domain: "ebook", status: "QA" } });
  dossierA = dA.id;
  const dB = await db.productDossier.create({ data: { userId: userB.id, title: "Dossier B", description: "Desc B", domain: "ebook", status: "QA" } });
  dossierB = dB.id;

  const r1 = await createPackage(userA.token, dossierA, "Manual A1", "Promesa A1");
  expect(r1.status).toBe(201);
  pkgA1 = (await r1.json()).id;
  // segundo paquete de A (ligeramente posterior)
  await new Promise((r) => setTimeout(r, 15));
  const r2 = await createPackage(userA.token, dossierA, "Manual A2", "Promesa A2");
  expect(r2.status).toBe(201);
  pkgA2 = (await r2.json()).id;

  const r3 = await createPackage(userB.token, dossierB, "Manual B1", "Promesa B1");
  expect(r3.status).toBe(201);
  pkgB1 = (await r3.json()).id;
});

afterAll(async () => {
  await db.launchPackage.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } }).catch(() => {});
  await db.productDossier.deleteMany({ where: { id: { in: [dossierA, dossierB] } } }).catch(() => {});
  await db.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } }).catch(() => {});
});

describe("UI1 — GET /api/product/launch-package", () => {
  it("sin token → 401", async () => {
    const res = await listRoute(reqList(""));
    expect(res.status).toBe(401);
  });

  it("token inválido → 401", async () => {
    const res = await listRoute(reqList("no-es-un-token"));
    expect(res.status).toBe(401);
  });

  it("listado correcto: solo los del usuario, orden fecha desc, campos intactos", async () => {
    const res = await listRoute(reqList(userA.token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.packages)).toBe(true);
    expect(json.packages).toHaveLength(2);

    const ids = json.packages.map((p: { id: string }) => p.id);
    expect(ids).toContain(pkgA1);
    expect(ids).toContain(pkgA2);
    expect(ids).not.toContain(pkgB1); // aislamiento

    // orden desc por createdAt (A2 se creó después de A1)
    expect(ids[0]).toBe(pkgA2);
    expect(ids[1]).toBe(pkgA1);

    const first = json.packages[0];
    expect(first.corePromise).toBe("Promesa A2");
    expect(first.version).toBe("1.0.0");
    expect(first.productId).toBe(dossierA);
    expect(typeof first.integrityCheck).toBe("string");
    const check = JSON.parse(first.integrityCheck);
    expect(check.valid).toBe(true);
    expect(check.integrityIssues).toHaveLength(0);
  });

  it("usuario B ve SOLO su paquete (sin fugas entre usuarios)", async () => {
    const res = await listRoute(reqList(userB.token));
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = json.packages.map((p: { id: string }) => p.id);
    expect(ids).toEqual([pkgB1]);
  });

  it("GET [id] ajeno → 404 (sin fuga por detalle)", async () => {
    const [r, ctx] = reqGetById(userB.token, pkgA1);
    const res = await getByIdRoute(r as NextRequest, ctx);
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toBeTruthy();
  });

  it("GET [id] propio → 200 con el paquete completo", async () => {
    const [r, ctx] = reqGetById(userA.token, pkgA1);
    const res = await getByIdRoute(r as NextRequest, ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.id).toBe(pkgA1);
    expect(json.corePromise).toBe("Promesa A1");
  });
});
