/**
 * UI1 — test de componente para la sección Launch (jsdom).
 *
 * Renderiza ProductDashboard en la sección "launch" con fetch simulado:
 * 1. Carga real desde GET /api/product/launch-package y render de nombre/versión/evidencia.
 * 2. Click en "Ver detalle" llama a GET /api/product/launch-package/[id] y muestra el detalle.
 * 3. Sin paquetes → EmptyState.
 * 4. Error del listado → ErrorBanner con Reintentar.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import ProductDashboard from "@/components/app/ProductDashboard";

// jsdom no trae matchMedia/ResizeObserver (los usa framer-motion)
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

const PKG_ROW = {
  id: "pkg-row-1",
  packageId: "pkg-code-1",
  productId: "dossier-1",
  version: "1.0.0",
  product: JSON.stringify({ name: "Manual de fermentación", type: "ebook" }),
  corePromise: "Fermenta sin miedo en 7 días",
  positioning: "La guía práctica para principiantes",
  cta: "Descarga la guía hoy",
  price: JSON.stringify({ amount: 19, currency: "USD" }),
  integrityCheck: JSON.stringify({ valid: true, issues: [], integrityIssues: [] }),
  evidence: "INFERRED",
  generatedAt: "2026-01-15T10:00:00.000Z",
  createdAt: "2026-01-15T10:00:00.000Z",
};

function mockFetch(listResponse: { status: number; body: unknown }, detailResponse?: { status: number; body: unknown }) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).endsWith("/api/product/launch-package")) {
      return { ok: listResponse.status === 200, status: listResponse.status, json: async () => listResponse.body } as Response;
    }
    if (detailResponse && /\/api\/product\/launch-package\/[^/]+$/.test(String(url))) {
      return { ok: detailResponse.status === 200, status: detailResponse.status, json: async () => detailResponse.body } as Response;
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  localStorage.setItem("p360_token", "token-de-test");
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("UI1 — LaunchSection (componente)", () => {
  it("renderiza los paquetes del listado real (nombre, versión, evidencia)", async () => {
    const fetchMock = mockFetch({ status: 200, body: { packages: [PKG_ROW] } });
    render(<ProductDashboard initialSection="launch" />);

    expect(await screen.findByText("Manual de fermentación")).toBeTruthy();
    expect(screen.getByText(/v1\.0\.0/)).toBeTruthy();
    expect(screen.getByText("Fermenta sin miedo en 7 días")).toBeTruthy();
    expect(screen.getByText("INFERRED")).toBeTruthy();
    expect(screen.getByText("Integridad OK")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([u]) => String(u) === "/api/product/launch-package")).toBe(true);
  });

  it('click en el paquete llama a GET /api/product/launch-package/[id] y muestra el detalle', async () => {
    const fetchMock = mockFetch(
      { status: 200, body: { packages: [PKG_ROW] } },
      { status: 200, body: PKG_ROW },
    );
    render(<ProductDashboard initialSection="launch" />);
    const card = await screen.findByText("Manual de fermentación");
    fireEvent.click(card);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith("/api/product/launch-package/pkg-row-1"))).toBe(true);
    });
    expect(await screen.findByText("Promesa central")).toBeTruthy();
    expect(screen.getByText("packageId:")).toBeTruthy();
  });

  it("sin paquetes → EmptyState", async () => {
    mockFetch({ status: 200, body: { packages: [] } });
    render(<ProductDashboard initialSection="launch" />);
    expect(await screen.findByText("Sin launch packages")).toBeTruthy();
  });

  it("error del listado → ErrorBanner con Reintentar", async () => {
    mockFetch({ status: 500, body: { error: "boom" } });
    render(<ProductDashboard initialSection="launch" />);
    expect(await screen.findByText("Error al cargar launch packages")).toBeTruthy();
    expect(screen.getByText("Reintentar")).toBeTruthy();
  });
});
