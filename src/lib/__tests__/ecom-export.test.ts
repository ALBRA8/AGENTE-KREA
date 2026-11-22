/**
 * Tests de la capa de envío HTTP real de ecom-export (P4).
 *
 * Estrategia honesta: servidor stub en loopback (node:http real) — los requests
 * pasan por fetch + TCP reales; se verifica path, headers de auth y body exacto
 * que cada API documentada espera. La verificación contra plataformas productivas
 * requiere credenciales del dueño (documentado en INFORME-ESTADO.md §3.3).
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import {
  exportToEcom,
  resolvePlatformCredentials,
  CREDENTIAL_ENV_VARS,
  getPlatformInfo,
} from "@/lib/commercial/ecom-export";
import type { EcomExportParams } from "@/lib/commercial/types";

// ─── Stub de servidor loopback (HTTP real sobre TCP) ────────────────

interface CapturedRequest {
  method: string;
  url: string;
  headers: http.IncomingHttpHeaders;
  body: string;
}

type StubHandler = (req: CapturedRequest) => { status: number; body: string };

function makeStubServer(handler?: StubHandler) {
  const captured: CapturedRequest[] = [];
  const server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });
    req.on("end", () => {
      const capturedReq: CapturedRequest = {
        method: req.method ?? "",
        url: req.url ?? "",
        headers: req.headers,
        body: data,
      };
      captured.push(capturedReq);
      const out = handler
        ? handler(capturedReq)
        : { status: 201, body: JSON.stringify({ id: 1 }) };
      res.statusCode = out.status;
      res.setHeader("Content-Type", "application/json");
      res.end(out.body);
    });
  });
  const ready = new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
  const waitFor = async (n: number): Promise<void> => {
    const deadline = Date.now() + 3000;
    while (captured.length < n && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 20));
    }
    if (captured.length < n) throw new Error(`stub server: esperaba ${n} requests, llegó ${captured.length}`);
  };
  const close = () => new Promise<void>((resolve) => server.close(() => resolve()));
  return { captured, ready, waitFor, close };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Params base ────────────────────────────────────────────────────

function baseParams(platform: EcomExportParams["platform"], extra: Partial<EcomExportParams> = {}): EcomExportParams {
  return {
    platform,
    productId: "prod-42",
    assets: [{ type: "image", url: "https://cdn.krea.test/creativo.jpg", alt: "Café Krea" }],
    metadata: { name: "Café Krea" },
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Shopify ────────────────────────────────────────────────────────

describe("ecom-export — envío real Shopify", () => {
  it("hace POST real al endpoint documentado con auth y body {image}", async () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "stub.myshopify.com");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_stub_token");
    const stub = makeStubServer();
    const baseUrl = await stub.ready;

    const result = await exportToEcom(baseParams("shopify"), { baseUrlOverride: baseUrl });
    await stub.waitFor(1);

    const req = stub.captured[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/admin/api/2024-01/products/prod-42/images.json");
    expect(req.headers["x-shopify-access-token"]).toBe("shpat_stub_token");
    const body = JSON.parse(req.body);
    expect(body.image.src).toBe("https://cdn.krea.test/creativo.jpg");
    expect(body.image.alt).toBe("Café Krea");
    expect(body.image.position).toBe(1);

    expect(result.success).toBe(true);
    expect(result.exportedAssets).toBe(1);
    expect(result.send?.attempted).toBe(true);
    expect(result.send?.ok).toBe(true);
    expect(result.send?.status).toBe(201);
    expect(result.credentials?.present).toBe(true);

    await stub.close();
  });

  it("envía N assets en requests secuenciales y cuenta los exitosos", async () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "stub.myshopify.com");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_stub_token");
    const stub = makeStubServer();
    const baseUrl = await stub.ready;

    const result = await exportToEcom(
      baseParams("shopify", {
        assets: [
          { type: "image", url: "https://cdn.krea.test/1.jpg", alt: "uno" },
          { type: "image", url: "https://cdn.krea.test/2.jpg", alt: "dos" },
        ],
      }),
      { baseUrlOverride: baseUrl }
    );
    await stub.waitFor(2);

    expect(stub.captured.length).toBe(2);
    expect(JSON.parse(stub.captured[1].body).image.position).toBe(2);
    expect(result.exportedAssets).toBe(2);
    expect(result.success).toBe(true);

    await stub.close();
  });

  it("responde success:false y conserva el status cuando la plataforma rechaza (HTTP 422)", async () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "stub.myshopify.com");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_stub_token");
    const stub = makeStubServer(() => ({
      status: 422,
      body: JSON.stringify({ errors: "base64 decoding failed" }),
    }));
    const baseUrl = await stub.ready;

    const result = await exportToEcom(baseParams("shopify"), { baseUrlOverride: baseUrl });
    await stub.waitFor(1);

    expect(result.success).toBe(false);
    expect(result.exportedAssets).toBe(0);
    expect(result.send?.attempted).toBe(true);
    expect(result.send?.ok).toBe(false);
    expect(result.send?.status).toBe(422);
    expect(result.errors?.[0]).toContain("422");

    await stub.close();
  });
});

// ─── WooCommerce ────────────────────────────────────────────────────

describe("ecom-export — envío real WooCommerce", () => {
  it("usa Basic auth y adjunta images[] al update del producto (REST v3)", async () => {
    vi.stubEnv("KREA_WOOCOMMERCE_URL", "https://tienda.ejemplo.com");
    vi.stubEnv("KREA_WOOCOMMERCE_CONSUMER_KEY", "ck_test");
    vi.stubEnv("KREA_WOOCOMMERCE_CONSUMER_SECRET", "cs_test");
    const stub = makeStubServer(() => ({ status: 200, body: JSON.stringify({ id: 42 }) }));
    const baseUrl = await stub.ready;

    const result = await exportToEcom(baseParams("woocommerce"), { baseUrlOverride: baseUrl });
    await stub.waitFor(1);

    const req = stub.captured[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/wp-json/wc/v3/products/prod-42");
    const expectedBasic = Buffer.from("ck_test:cs_test").toString("base64");
    expect(req.headers.authorization).toBe(`Basic ${expectedBasic}`);
    const body = JSON.parse(req.body);
    expect(Array.isArray(body.images)).toBe(true);
    expect(body.images[0].src).toBe("https://cdn.krea.test/creativo.jpg");

    expect(result.success).toBe(true);
    expect(result.send?.ok).toBe(true);
    expect(result.send?.status).toBe(200);

    await stub.close();
  });
});

// ─── TiendaNube ─────────────────────────────────────────────────────

describe("ecom-export — envío real TiendaNube", () => {
  it("usa header Authentication Bearer + User-Agent y POST a /v1/{store}/products/{id}/images", async () => {
    vi.stubEnv("KREA_TIENDANUBE_STORE_ID", "559977");
    vi.stubEnv("KREA_TIENDANUBE_API_TOKEN", "tn_stub_token");
    const stub = makeStubServer(() => ({ status: 201, body: JSON.stringify({ id: 7, product_id: 42 }) }));
    const baseUrl = await stub.ready;

    const result = await exportToEcom(baseParams("tiendanube"), { baseUrlOverride: baseUrl });
    await stub.waitFor(1);

    const req = stub.captured[0];
    expect(req.method).toBe("POST");
    expect(req.url).toBe("/v1/559977/products/prod-42/images");
    expect(req.headers.authentication).toBe("Bearer tn_stub_token");
    expect(req.headers["user-agent"]).toContain("AGENTE-KREA");
    const body = JSON.parse(req.body);
    expect(body.src).toBe("https://cdn.krea.test/creativo.jpg");
    expect(body.position).toBe(1);

    expect(result.success).toBe(true);
    expect(result.send?.ok).toBe(true);
    expect(result.send?.status).toBe(201);

    await stub.close();
  });
});

// ─── Fallos de red ──────────────────────────────────────────────────

describe("ecom-export — fallos de red honestos", () => {
  it("informa error de conexión cuando el servidor no responde", async () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "stub.myshopify.com");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_stub_token");
    // Puerto loopback sin servidor: la conexión se rechaza de verdad
    const result = await exportToEcom(baseParams("shopify"), { baseUrlOverride: "http://127.0.0.1:9", timeoutMs: 2000 });

    expect(result.success).toBe(false);
    expect(result.send?.attempted).toBe(true);
    expect(result.send?.ok).toBe(false);
    expect(typeof result.send?.error).toBe("string");
  });

  it("aborta por timeout cuando la plataforma no contesta a tiempo", async () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "stub.myshopify.com");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_stub_token");
    // Servidor que difiere la respuesta 400ms (no bloqueante) para que el abort
    // del cliente (50ms) pueda dispararse en el event loop
    const slow = http.createServer((_req, res) => {
      const t = setTimeout(() => {
        res.statusCode = 200;
        res.end("{}");
      }, 400);
      t.unref?.();
    });
    const slowReady = new Promise<string>((resolve) => {
      slow.listen(0, "127.0.0.1", () => {
        const { port } = slow.address() as AddressInfo;
        resolve(`http://127.0.0.1:${port}`);
      });
    });
    const slowUrl = await slowReady;

    const result = await exportToEcom(baseParams("shopify"), { baseUrlOverride: slowUrl, timeoutMs: 50 });

    expect(result.success).toBe(false);
    expect(result.send?.attempted).toBe(true);
    expect(result.send?.ok).toBe(false);
    expect(result.send?.error).toContain("timeout");
    await new Promise<void>((resolve) => slow.close(() => resolve()));
  });
});

// ─── Modo prepared-only (sin credenciales) ──────────────────────────

describe("ecom-export — payload preparado sin credenciales (honesto)", () => {
  it("no intenta envío y lista exactamente las env vars que faltan", async () => {
    const result = await exportToEcom(baseParams("shopify"));

    expect(result.success).toBe(true);
    expect(result.send?.attempted).toBe(false);
    expect(result.credentials?.present).toBe(false);
    expect(result.credentials?.missingEnvVars).toEqual(CREDENTIAL_ENV_VARS.shopify);
    expect(result.exportUrl).toContain("/admin/api/2024-01/products/prod-42/images.json");
  });

  it("funnelish queda en prepared-only por diseño (sin API pública de imágenes)", async () => {
    const result = await exportToEcom(baseParams("funnelish"));

    expect(result.send?.attempted).toBe(false);
    expect(result.credentials?.present).toBe(false);
    expect(result.credentials?.missingEnvVars).toEqual([]);
    expect(CREDENTIAL_ENV_VARS.funnelish).toEqual([]);
  });
});

// ─── Validación contra límites reales de plataforma ─────────────────

describe("ecom-export — validación de formato y tamaño por plataforma", () => {
  it("rechaza formatos no aceptados por la plataforma", async () => {
    const result = await exportToEcom(
      baseParams("shopify", {
        assets: [{ type: "image", url: "https://cdn.krea.test/foto.tiff", format: "tiff" }],
      })
    );

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("tiff");
    expect(result.errors?.[0]).toContain("Shopify");
  });

  it("rechaza assets que exceden el tamaño máximo de la plataforma", async () => {
    const result = await exportToEcom(
      baseParams("funnelish", {
        assets: [{ type: "image", url: "https://cdn.krea.test/grande.jpg", sizeBytes: 6 * 1024 * 1024 }],
      })
    );

    expect(result.success).toBe(false);
    expect(result.errors?.[0]).toContain("max image size");
  });

  it("acepta formatos y tamaños dentro de los límites declarados", () => {
    const info = getPlatformInfo("shopify");
    expect(info.acceptedFormats).toContain("jpg");
    expect(info.maxImageSize).toBe(20 * 1024 * 1024);
  });
});

// ─── resolvePlatformCredentials ─────────────────────────────────────

describe("resolvePlatformCredentials", () => {
  it("normaliza la URL de la tienda Shopify (sin protocolo ni slashes finales)", () => {
    vi.stubEnv("KREA_SHOPIFY_STORE", "https://mitienda.myshopify.com/");
    vi.stubEnv("KREA_SHOPIFY_ADMIN_TOKEN", "shpat_x");
    const creds = resolvePlatformCredentials("shopify");
    expect(creds.present).toBe(true);
    expect(creds.baseUrl).toBe("https://mitienda.myshopify.com");
    expect(creds.headers["X-Shopify-Access-Token"]).toBe("shpat_x");
  });

  it("reporta las env vars faltantes una por una", () => {
    vi.stubEnv("KREA_WOOCOMMERCE_URL", "https://tienda.ejemplo.com");
    const creds = resolvePlatformCredentials("woocommerce");
    expect(creds.present).toBe(false);
    expect(creds.missingEnvVars).toEqual([
      "KREA_WOOCOMMERCE_CONSUMER_KEY",
      "KREA_WOOCOMMERCE_CONSUMER_SECRET",
    ]);
  });
});
