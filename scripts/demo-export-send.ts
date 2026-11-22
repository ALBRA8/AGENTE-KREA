/**
 * Evidencia real P4 — capa de envío HTTP de ecom-export.
 *
 * Levanta un servidor stub en loopback (TCP + fetch REALES, fuera de vitest)
 * y ejecuta exportToEcom contra él para las 3 plataformas con API documentada.
 * Además demuestra el modo prepared-only honesto (sin credenciales / funnelish).
 *
 * Salida: download/evidencia-export-ecom/evidencia-export-send.json
 * Exit 0 solo si los 3 envíos reales fueron aceptados por el stub.
 */

import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import path from "node:path";
import { exportToEcom, resolvePlatformCredentials } from "../src/lib/commercial/ecom-export";
import type { EcomExportParams } from "../src/lib/commercial/types";

const OUT_DIR = path.resolve("download/evidencia-export-ecom");

interface LoggedRequest {
  platform: string;
  method: string;
  url: string;
  authHeader: string | undefined;
  userAgent: string | undefined;
  body: unknown;
}

async function main(): Promise<number> {
  const logged: LoggedRequest[] = [];

  const server = http.createServer((req, res) => {
    let data = "";
    req.on("data", (c: Buffer) => (data += c.toString("utf8")));
    req.on("end", () => {
      let body: unknown = data;
      try { body = JSON.parse(data); } catch { /* body no JSON */ }
      logged.push({
        platform: (req.headers["x-stub-platform"] as string) ?? "?",
        method: req.method ?? "",
        url: req.url ?? "",
        authHeader: req.headers["x-shopify-access-token"]
          ? `X-Shopify-Access-Token: ${req.headers["x-shopify-access-token"]}`
          : req.headers.authorization
            ? `Authorization: ${req.headers.authorization}`
            : req.headers.authentication
              ? `Authentication: ${req.headers.authentication}`
              : undefined,
        userAgent: req.headers["user-agent"],
        body,
      });
      res.statusCode = req.url?.includes("wp-json") ? 200 : 201;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: Math.floor(Math.random() * 1000), ok: true }));
    });
  });

  const base = await new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });

  console.log(`Stub loopback escuchando en ${base}\n`);

  function paramsFor(platform: EcomExportParams["platform"]): EcomExportParams {
    return {
      platform,
      productId: "prod-evidencia-42",
      assets: [
        { type: "image", url: "https://cdn.krea.test/creativo-1.jpg", alt: "Café Krea", format: "jpg", sizeBytes: 124_000 },
      ],
      metadata: { name: "Café Krea", price: "18" },
    };
  }

  // ── Envíos REALES (credenciales stub + loopback) ────────────────────

  process.env.KREA_SHOPIFY_STORE = "stub.myshopify.com";
  process.env.KREA_SHOPIFY_ADMIN_TOKEN = "shpat_evidencia_stub";

  const shopifyCreds = resolvePlatformCredentials("shopify", base);
  console.log(`[shopify]     credenciales=${shopifyCreds.present} baseUrl=${shopifyCreds.baseUrl}`);
  const shopify = await exportToEcom(paramsFor("shopify"), { baseUrlOverride: base });
  console.log(`[shopify]     success=${shopify.success} exportedAssets=${shopify.exportedAssets} send.status=${shopify.send?.status} endpoint=${shopify.send?.endpoint}\n`);

  process.env.KREA_WOOCOMMERCE_URL = base;
  process.env.KREA_WOOCOMMERCE_CONSUMER_KEY = "ck_evidencia";
  process.env.KREA_WOOCOMMERCE_CONSUMER_SECRET = "cs_evidencia";

  const wooCreds = resolvePlatformCredentials("woocommerce", base);
  console.log(`[woocommerce] credenciales=${wooCreds.present} baseUrl=${wooCreds.baseUrl}`);
  const woo = await exportToEcom(paramsFor("woocommerce"), { baseUrlOverride: base });
  console.log(`[woocommerce] success=${woo.success} exportedAssets=${woo.exportedAssets} send.status=${woo.send?.status} endpoint=${woo.send?.endpoint}\n`);

  process.env.KREA_TIENDANUBE_STORE_ID = "559977";
  process.env.KREA_TIENDANUBE_API_TOKEN = "tn_evidencia_stub";

  const tnCreds = resolvePlatformCredentials("tiendanube", base);
  console.log(`[tiendanube]  credenciales=${tnCreds.present} baseUrl=${tnCreds.baseUrl}`);
  const tn = await exportToEcom(paramsFor("tiendanube"), { baseUrlOverride: base });
  console.log(`[tiendanube]  success=${tn.success} exportedAssets=${tn.exportedAssets} send.status=${tn.send?.status} endpoint=${tn.send?.endpoint}\n`);

  // ── Modo prepared-only honesto (sin credenciales / funnelish) ───────

  delete process.env.KREA_SHOPIFY_STORE;
  delete process.env.KREA_SHOPIFY_ADMIN_TOKEN;
  const prepared = await exportToEcom(paramsFor("shopify"));
  console.log(`[shopify sin credenciales] send.attempted=${prepared.send?.attempted} missing=${prepared.credentials?.missingEnvVars?.join(",")}`);

  const funnelish = await exportToEcom(paramsFor("funnelish"));
  console.log(`[funnelish]  send.attempted=${funnelish.send?.attempted} (sin API pública de imágenes — por diseño)`);

  server.close();

  // ── Persistencia de evidencia ───────────────────────────────────────

  const evidence = {
    timestamp: new Date().toISOString(),
    modo: "stub loopback (TCP + fetch reales); verificación contra plataforma productiva requiere credenciales del dueño",
    enviosReales: {
      shopify: { result: shopify, request: logged.find((l) => l.url.includes("images.json")) },
      woocommerce: { result: woo, request: logged.find((l) => l.url.includes("wp-json")) },
      tiendanube: { result: tn, request: logged.find((l) => l.url.includes("/v1/")) },
    },
    preparedOnly: {
      shopifySinCredenciales: prepared,
      funnelish: funnelish,
    },
    verdicto: {
      enviosAceptados: [shopify, woo, tn].filter((r) => r.success && r.send?.ok).length,
      esperados: 3,
    },
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outFile = path.join(OUT_DIR, "evidencia-export-send.json");
  fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidencia guardada en ${outFile}`);

  const okN = evidence.verdicto.enviosAceptados;
  console.log(`VEREDICTO: ${okN}/${evidence.verdicto.esperados} envíos reales aceptados por el stub loopback`);
  return okN === 3 ? 0 : 1;
}

main().then((code) => process.exit(code)).catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
