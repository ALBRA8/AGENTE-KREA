/**
 * UI2 — Evaluar fit desde Opportunities (UI).
 *
 * Ruta:  GET /api/product/credit-costs expone CREDIT_COSTS.product:* (401 sin token).
 * UI:    botón "Evaluar fit" con confirmación de costo, anti doble clic,
 *        manejo 402/404/500 y render del resultado (puntaje, decisión, evidencia).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { security } from "@/lib/auth";
import { db } from "@/lib/db";
import { CREDIT_COSTS, costOf } from "@/lib/credit-service";
import { GET as creditCostsRoute } from "@/app/api/product/credit-costs/route";

vi.setConfig({ testTimeout: 20_000 });

let userId = "", token = "";

beforeAll(async () => {
  const u = await db.user.create({ data: { name: "Costs T", email: `costs-${Date.now()}@krea-test.local`, password: security.hashPassword("x"), credits: 50 } });
  userId = u.id;
  token = await security.generateToken(u.id);
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } }).catch(() => {});
});

describe("UI2 — GET /api/product/credit-costs", () => {
  it("sin token → 401", async () => {
    const res = await creditCostsRoute(new NextRequest("http://localhost:3000/api/product/credit-costs"));
    expect(res.status).toBe(401);
  });

  it("expone product:fit con el valor EXACTO de CREDIT_COSTS (fuente única)", async () => {
    const res = await creditCostsRoute(
      new NextRequest("http://localhost:3000/api/product/credit-costs", {
        headers: { authorization: `Bearer ${token}` },
      })
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.costs["product:fit"]).toBe(costOf("product:fit"));
    expect(json.costs["product:fit"]).toBe(CREDIT_COSTS["product:fit"]);
    // solo capacidades product:* (nada de generate:* / commercial:*)
    for (const key of Object.keys(json.costs)) {
      expect(key.startsWith("product:")).toBe(true);
    }
    expect(json.costs["product:produce"]).toBeDefined();
  });
});
