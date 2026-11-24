/**
 * UI2 — test de componente del botón "Evaluar fit" (jsdom).
 *
 * 1. La oportunidad se renderiza desde el shape crudo de la API (title/domain).
 * 2. Confirmación inline muestra el costo leído de /api/product/credit-costs.
 * 3. Éxito → muestra puntaje/decisión/evidencia y refresca la lista (2 GET).
 * 4. 402 → mensaje claro con el costo.
 * 5. Doble clic en Confirmar → UNA sola llamada POST (anti doble cobro).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ProductDashboard from "@/components/app/ProductDashboard";

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false, media: q, onchange: null,
      addListener: vi.fn(), removeListener: vi.fn(),
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }),
  });
}
if (!(window as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class { observe() {} unobserve() {} disconnect() {} },
  });
}

const OPP_ROW = {
  id: "opp-1",
  userId: "u1",
  title: "Fermentación casera sin miedo",
  description: "Evidencia de búsquedas crecientes",
  domain: "ebook",
  audience: "Cocineros aficionados",
  problem: "El miedo a contaminar fermentos",
  status: "EVALUATING",
  fitScore: null,
  createdAt: "2026-01-10T09:00:00.000Z",
  updatedAt: "2026-01-10T09:00:00.000Z",
};

const FIT_OK = {
  data: {
    overall: 0.72,
    marketExistence: 0.8,
    audienceClarity: 0.7,
    problemValidity: 0.75,
    differentiation: 0.6,
    feasibility: 0.7,
    evidence: "INFERRED",
    reasoning: "Mercado con señales claras y problema validado en foros.",
    recommendation: "PROCEED",
  },
  credits: 48,
};

/** fetch simulado por URL/método con contadores. */
function makeFetchMock(opts: {
  costs?: { status: number; body: unknown };
  opportunitiesBody?: unknown[];
  fitStatus?: number;
  fitBody?: unknown;
}) {
  const calls = { opportunitiesGet: 0, fitPost: 0 };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/api/product/credit-costs")) {
      const c = opts.costs ?? { status: 200, body: { costs: { "product:fit": 2 } } };
      return { ok: c.status === 200, status: c.status, json: async () => c.body } as Response;
    }
    if (u.endsWith("/api/product/opportunities") && (!init?.method || init.method === "GET")) {
      calls.opportunitiesGet += 1;
      return { ok: true, status: 200, json: async () => ({ opportunities: opts.opportunitiesBody ?? [OPP_ROW] }) } as Response;
    }
    if (u.endsWith("/api/product/fit") && init?.method === "POST") {
      calls.fitPost += 1;
      const ok = (opts.fitStatus ?? 200) === 200;
      return { ok, status: opts.fitStatus ?? 200, json: async () => opts.fitBody ?? FIT_OK } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, calls };
}

beforeEach(() => {
  localStorage.setItem("p360_token", "token-de-test");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI2 — OpportunitiesSection: Evaluar fit", () => {
  it("renderiza la oportunidad desde el shape crudo de la API (title→nombre, domain→tipo)", async () => {
    makeFetchMock({});
    render(<ProductDashboard initialSection="opportunities" />);
    expect(await screen.findByText("Fermentación casera sin miedo")).toBeTruthy();
    expect(screen.getByText("ebook")).toBeTruthy();
    expect(screen.getByText(/Evaluar fit/)).toBeTruthy();
  });

  it("confirmación muestra el costo (de credit-costs) y el éxito renderiza puntaje/decisión/evidencia + refresco", async () => {
    const { calls } = makeFetchMock({});
    render(<ProductDashboard initialSection="opportunities" />);

    fireEvent.click(await screen.findByText(/Evaluar fit/));
    // costo leído del endpoint, no hardcodeado
    expect(await screen.findByText(/cuesta/)).toBeTruthy();
    expect(screen.getByText(/2 créditos/)).toBeTruthy();

    fireEvent.click(screen.getByText("Confirmar"));

    // resultado con puntaje, decisión y evidencia
    expect(await screen.findByText(/Fit: 72%/)).toBeTruthy();
    expect(screen.getByText("PROCEED")).toBeTruthy();
    expect(screen.getByText("INFERRED")).toBeTruthy();

    await waitFor(() => expect(calls.fitPost).toBe(1));
    await waitFor(() => expect(calls.opportunitiesGet).toBeGreaterThanOrEqual(2)); // carga + refresco
  });

  it("402 → mensaje claro con el costo de 2 créditos", async () => {
    makeFetchMock({ fitStatus: 402, fitBody: { error: "Créditos insuficientes" } });
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText(/Evaluar fit/));
    fireEvent.click(await screen.findByText("Confirmar"));
    expect(await screen.findByText(/Sin créditos suficientes: evaluar fit cuesta 2 créditos/)).toBeTruthy();
  });

  it("doble clic en Confirmar → UNA sola llamada POST (anti doble cobro)", async () => {
    const { calls } = makeFetchMock({});
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText(/Evaluar fit/));
    const confirm = await screen.findByText("Confirmar");
    fireEvent.click(confirm);
    fireEvent.click(confirm); // segundo clic en el mismo tick
    await waitFor(() => expect(calls.fitPost).toBe(1));
    await waitFor(() => expect(calls.fitPost).toBe(1)); // se mantiene en 1
  });
});
