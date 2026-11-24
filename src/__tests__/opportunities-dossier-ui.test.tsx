/**
 * UI3 — test de componente del botón "Crear dossier" desde una oportunidad (jsdom).
 *
 * 1. Botón "Crear dossier" abre formulario precargado con nombre/tipo de la oportunidad.
 * 2. Submit vacío → validación sin llamada.
 * 3. Éxito → POST con { opportunityId, productName, productType } y navegación
 *    a la sección Dossiers con el nuevo dossier visible (detalle enfocado).
 * 4. Doble clic → UNA sola llamada POST.
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
  id: "opp-9",
  title: "Guía de fermentación",
  description: "Evidencia",
  domain: "guide",
  audience: "Aficionados",
  problem: "Miedo a contaminar",
  status: "ACCEPTED",
  fitScore: JSON.stringify({ overall: 0.75, recommendation: "PROCEED", evidence: "INFERRED" }),
  createdAt: "2026-01-10T09:00:00.000Z",
};

const NEW_DOSSIER = {
  id: "dossier-nuevo-1",
  opportunityId: "opp-9",
  title: "Guía de fermentación",
  domain: "guide",
  status: "IDEA",
  createdAt: "2026-01-12T10:00:00.000Z",
  updatedAt: "2026-01-12T10:00:00.000Z",
};

function makeFetchMock(opts: { dossierStatus?: number; dossierBody?: unknown } = {}) {
  const calls = { dossierPost: 0, dossiersGet: 0, detailGet: 0, bodies: [] as unknown[] };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/api/product/credit-costs")) {
      return { ok: true, status: 200, json: async () => ({ costs: { "product:fit": 2 } }) } as Response;
    }
    if (u.endsWith("/api/product/opportunities")) {
      return { ok: true, status: 200, json: async () => ({ opportunities: [OPP_ROW] }) } as Response;
    }
    if (u.endsWith("/api/product/dossiers") && (!init?.method || init.method === "GET")) {
      calls.dossiersGet += 1;
      return { ok: true, status: 200, json: async () => ({ dossiers: [NEW_DOSSIER] }) } as Response;
    }
    if (u.endsWith("/api/product/dossiers") && init?.method === "POST") {
      calls.dossierPost += 1;
      calls.bodies.push(JSON.parse(String(init.body)));
      const status = opts.dossierStatus ?? 201;
      return { ok: status === 201, status, json: async () => opts.dossierBody ?? NEW_DOSSIER } as Response;
    }
    if (/\/api\/product\/dossiers\/[^/]+$/.test(u)) {
      calls.detailGet += 1;
      return { ok: true, status: 200, json: async () => NEW_DOSSIER } as Response;
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

describe("UI3 — Crear dossier desde una oportunidad", () => {
  it("abre formulario precargado y valida campos vacíos sin llamar a la API", async () => {
    const { calls } = makeFetchMock();
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText("Crear dossier"));

    // precargado desde la oportunidad
    const input = screen.getByPlaceholderText("Nombre del producto") as HTMLInputElement;
    expect(input.value).toBe("Guía de fermentación");

    // vaciar → el submit queda deshabilitado (validación) y no hay POST
    fireEvent.change(input, { target: { value: "" } });
    const createBtn = screen.getByRole("button", { name: "Crear dossier" }) as HTMLButtonElement;
    expect(createBtn.disabled).toBe(true);
    await waitFor(() => expect(calls.dossierPost).toBe(0));
  });

  it("éxito → POST correcto y navegación a Dossiers con el nuevo dossier visible", async () => {
    const { calls } = makeFetchMock();
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText("Crear dossier"));

    const createButtons = screen.getAllByRole("button", { name: "Crear dossier" });
    // [0] = botón que abre el form, [1] = submit del form
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => expect(calls.dossierPost).toBe(1));
    expect(calls.bodies[0]).toEqual({
      opportunityId: "opp-9",
      productName: "Guía de fermentación",
      productType: "guide",
    });

    // navegación a la sección Dossiers: el listado se pide y el dossier aparece
    await waitFor(() => expect(calls.dossiersGet).toBeGreaterThanOrEqual(1));
    // el nombre aparece en la tarjeta de la lista Y en el h3 del detalle normalizado
    expect((await screen.findAllByText("Guía de fermentación")).length).toBeGreaterThanOrEqual(1);
    // el detalle del nuevo dossier se enfoca vía /api/product/dossiers/[id]
    await waitFor(() => expect(calls.detailGet).toBeGreaterThanOrEqual(1));
    // el estado IDEA aparece en el badge y en el pipeline (≥1 instancia)
    expect(screen.getAllByText(/IDEA/).length).toBeGreaterThanOrEqual(1);
  });

  it("doble clic en crear → UNA sola llamada POST", async () => {
    const { calls } = makeFetchMock();
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText("Crear dossier"));
    const createButtons = screen.getAllByRole("button", { name: "Crear dossier" });
    const submit = createButtons[createButtons.length - 1];
    fireEvent.click(submit);
    fireEvent.click(submit); // mismo tick
    await waitFor(() => expect(calls.dossierPost).toBe(1));
    await waitFor(() => expect(calls.dossierPost).toBe(1));
  });

  it("404 (oportunidad ajena/borrada) → mensaje y sin navegación", async () => {
    const { calls } = makeFetchMock({ dossierStatus: 404, dossierBody: { error: "Oportunidad no encontrada" } });
    render(<ProductDashboard initialSection="opportunities" />);
    fireEvent.click(await screen.findByText("Crear dossier"));
    const createButtons = screen.getAllByRole("button", { name: "Crear dossier" });
    fireEvent.click(createButtons[createButtons.length - 1]);

    expect(await screen.findByText("Oportunidad no encontrada.")).toBeTruthy();
    await waitFor(() => expect(calls.dossiersGet).toBe(0)); // no navegó a Dossiers
  });
});
