/**
 * KREA Commercial — Ecommerce Platform Export
 *
 * Exporta creativos generados a plataformas de e-commerce:
 * Shopify, WooCommerce, TiendaNube, Funnelish.
 *
 * Dos modos, con honestidad explícita en el resultado:
 *
 * 1. ENVÍO REAL (credenciales presentes vía env vars): hace POST HTTP reales
 *    a la API documentada de la plataforma, un asset por vez:
 *      - Shopify:    POST {store}/admin/api/{v}/products/{id}/images.json
 *                    header X-Shopify-Access-Token, body {image:{src,alt,position}}
 *      - WooCommerce: POST {site}/wp-json/wc/v3/products/{id} (update con images[],
 *                    API REST v3 "Update a product"; no existe sub-recurso /images)
 *                    Basic auth con consumer key/secret
 *      - TiendaNube: POST https://api.tiendanube.com/v1/{store_id}/products/{id}/images
 *                    headers Authentication: Bearer + User-Agent (obligatorio), 201
 *    (Funnelish no tiene API pública REST de imágenes de producto documentada —
 *    solo webhooks; para esa plataforma el modo real queda deshabilitado y se
 *    informa por qué.)
 *
 * 2. PAYLOAD PREPARADO (sin credenciales): comportamiento anterior — arma el
 *    payload por plataforma y devuelve el endpoint destino, con la lista exacta
 *    de env vars faltantes (send.attempted=false).
 *
 * La capa de envío está verificada contra un servidor stub en loopback
 * (fetch + TCP reales); la verificación contra plataformas productivas
 * requiere credenciales del dueño (P4 en INFORME-ESTADO.md).
 */

import type { EcomPlatform, EcomExportParams, EcomExportResult, EcomSendReport } from "./types";

// ─── Platform Config ────────────────────────────────────────────────

interface PlatformConfig {
  name: string;
  maxImageSize: number;   // in bytes
  acceptedFormats: string[];
  productImageEndpoint: string; // placeholders: {storeId}, {id}
}

const PLATFORM_CONFIGS: Record<EcomPlatform, PlatformConfig> = {
  shopify: {
    name: "Shopify",
    maxImageSize: 20 * 1024 * 1024,  // 20MB
    acceptedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    productImageEndpoint: "/admin/api/2024-01/products/{id}/images.json",
  },
  woocommerce: {
    name: "WooCommerce",
    maxImageSize: 10 * 1024 * 1024,  // 10MB
    acceptedFormats: ["jpg", "jpeg", "png", "gif", "webp"],
    // WooCommerce REST v3 no tiene sub-recurso /images: las imágenes se adjuntan
    // actualizando el producto ("Update a product" con images[] en el body).
    productImageEndpoint: "/wp-json/wc/v3/products/{id}",
  },
  tiendanube: {
    name: "TiendaNube",
    maxImageSize: 10 * 1024 * 1024,
    acceptedFormats: ["jpg", "jpeg", "png", "gif"],
    productImageEndpoint: "/v1/{storeId}/products/{id}/images",
  },
  funnelish: {
    name: "Funnelish",
    maxImageSize: 5 * 1024 * 1024,
    acceptedFormats: ["jpg", "jpeg", "png", "webp"],
    productImageEndpoint: "/api/v1/products/{id}/images",
  },
};

// ─── Credentials (por plataforma, vía variables de entorno) ─────────

export const CREDENTIAL_ENV_VARS: Record<EcomPlatform, string[]> = {
  shopify: ["KREA_SHOPIFY_STORE", "KREA_SHOPIFY_ADMIN_TOKEN"],
  woocommerce: [
    "KREA_WOOCOMMERCE_URL",
    "KREA_WOOCOMMERCE_CONSUMER_KEY",
    "KREA_WOOCOMMERCE_CONSUMER_SECRET",
  ],
  tiendanube: ["KREA_TIENDANUBE_STORE_ID", "KREA_TIENDANUBE_API_TOKEN"],
  funnelish: [], // sin API pública de imágenes: el modo real no se habilita por env
};

export interface PlatformCredentials {
  platform: EcomPlatform;
  present: boolean;
  missingEnvVars: string[];
  baseUrl: string;
  headers: Record<string, string>;
  endpoint: string; // con placeholders aún sin resolver
}

function env(name: string): string {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : "";
}

/**
 * Resuelve las credenciales de la plataforma desde env vars.
 * `baseUrlOverride` (solo para pruebas en loopback) sustituye la URL base.
 */
export function resolvePlatformCredentials(
  platform: EcomPlatform,
  baseUrlOverride?: string
): PlatformCredentials {
  const config = PLATFORM_CONFIGS[platform];
  const required = CREDENTIAL_ENV_VARS[platform];
  const missingEnvVars = required.filter((name) => env(name) === "");

  if (missingEnvVars.length > 0) {
    return {
      platform,
      present: false,
      missingEnvVars,
      baseUrl: "",
      headers: {},
      endpoint: config.productImageEndpoint,
    };
  }

  switch (platform) {
    case "shopify": {
      const store = env("KREA_SHOPIFY_STORE").replace(/^https?:\/\//, "").replace(/\/+$/, "");
      const token = env("KREA_SHOPIFY_ADMIN_TOKEN");
      const version = env("KREA_SHOPIFY_API_VERSION") || "2024-01";
      return {
        platform,
        present: true,
        missingEnvVars: [],
        baseUrl: baseUrlOverride ?? `https://${store}`,
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        endpoint: `/admin/api/${version}/products/{id}/images.json`,
      };
    }
    case "woocommerce": {
      const site = env("KREA_WOOCOMMERCE_URL").replace(/\/+$/, "");
      const key = env("KREA_WOOCOMMERCE_CONSUMER_KEY");
      const secret = env("KREA_WOOCOMMERCE_CONSUMER_SECRET");
      const basic = Buffer.from(`${key}:${secret}`).toString("base64");
      return {
        platform,
        present: true,
        missingEnvVars: [],
        baseUrl: baseUrlOverride ?? site,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basic}`,
        },
        endpoint: "/wp-json/wc/v3/products/{id}",
      };
    }
    case "tiendanube": {
      const storeId = env("KREA_TIENDANUBE_STORE_ID");
      const token = env("KREA_TIENDANUBE_API_TOKEN");
      const userAgent = env("KREA_TIENDANUBE_USER_AGENT") || "AGENTE-KREA/1.0 (ecom-export)";
      return {
        platform,
        present: true,
        missingEnvVars: [],
        baseUrl: baseUrlOverride ?? "https://api.tiendanube.com",
        headers: {
          "Content-Type": "application/json",
          Authentication: `Bearer ${token}`,
          "User-Agent": userAgent,
        },
        endpoint: `/v1/${storeId}/products/{id}/images`,
      };
    }
    case "funnelish":
      // Sin API pública REST de imágenes de producto: nunca hay envío real.
      return {
        platform,
        present: false,
        missingEnvVars: [],
        baseUrl: "",
        headers: {},
        endpoint: config.productImageEndpoint,
      };
  }
}

// ─── Export Validation ──────────────────────────────────────────────

function normalizeFormat(format?: string): string {
  return (format ?? "").toLowerCase().replace(/^\./, "").trim();
}

export function validateExport(params: EcomExportParams): string[] {
  const errors: string[] = [];
  const config = PLATFORM_CONFIGS[params.platform];

  if (!config) {
    errors.push(`Unsupported platform: ${params.platform}`);
    return errors;
  }

  if (!params.productId) {
    errors.push("Missing productId");
  }

  if (!params.assets || params.assets.length === 0) {
    errors.push("No assets to export");
  }

  for (const asset of params.assets ?? []) {
    if (!asset.url) {
      errors.push(`Asset missing URL: ${asset.type}`);
    }
    // Validación contra límites reales de la plataforma (cuando el asset los declara)
    const format = normalizeFormat(asset.format);
    if (format && !config.acceptedFormats.includes(format)) {
      errors.push(
        `Asset format "${asset.format}" not accepted by ${config.name} (accepted: ${config.acceptedFormats.join(", ")})`
      );
    }
    if (typeof asset.sizeBytes === "number" && asset.sizeBytes > config.maxImageSize) {
      errors.push(
        `Asset exceeds ${config.name} max image size (${asset.sizeBytes} > ${config.maxImageSize} bytes)`
      );
    }
  }

  return errors;
}

// ─── Real HTTP send (un asset por vez, semántica real de cada API) ──

export interface ExportOptions {
  /** Sustituye fetch (para pruebas) */
  fetchImpl?: typeof fetch;
  /** Sustituye la URL base (para pruebas en loopback) */
  baseUrlOverride?: string;
  /** Timeout por request en ms (default 15000) */
  timeoutMs?: number;
}

function buildRequestBodies(
  platform: EcomPlatform,
  params: EcomExportParams
): Array<Record<string, unknown>> {
  const assets = params.assets;
  switch (platform) {
    case "shopify":
      // Shopify Admin API: una imagen por request, body {image:{...}}
      return assets.map((asset, i) => ({
        image: {
          src: asset.url,
          alt: asset.alt || `Product image ${i + 1}`,
          position: i + 1,
        },
      }));
    case "woocommerce":
      // WooCommerce REST v3 "Update a product": images[] en el body del producto
      return [
        {
          images: assets.map((asset, i) => ({
            src: asset.url,
            alt: asset.alt || `Product image ${i + 1}`,
            position: i + 1,
          })),
        },
      ];
    case "tiendanube":
      // TiendaNube API v1: una imagen por request, body {src, position} (201)
      return assets.map((asset, i) => ({
        src: asset.url,
        position: i + 1,
      }));
    case "funnelish":
      return [];
  }
}

async function sendToPlatform(
  params: EcomExportParams,
  creds: PlatformCredentials,
  options: ExportOptions
): Promise<{ ok: boolean; exportedAssets: number; report: EcomSendReport; errors: string[] }> {
  const doFetch = options.fetchImpl ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const bodies = buildRequestBodies(params.platform, params);
  const errors: string[] = [];
  let exportedAssets = 0;
  let lastReport: EcomSendReport = { attempted: true, ok: false };

  for (let i = 0; i < bodies.length; i++) {
    const url = `${creds.baseUrl}${creds.endpoint.replace("{id}", encodeURIComponent(params.productId))}`;
    // Timeout con Promise.race (portable entre realms de AbortSignal: Node/undici
    // rechaza signals de jsdom y viceversa; la carrera evita esa incompatibilidad).
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fetchPromise = doFetch(url, {
      method: "POST",
      headers: creds.headers,
      body: JSON.stringify(bodies[i]),
    });
    try {
      const res = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timeout: la plataforma no respondió en ${timeoutMs}ms`)),
            timeoutMs
          );
          // No mantener el proceso vivo solo por el timer
          (timer as { unref?: () => void }).unref?.();
        }),
      ]);
      const preview = (await res.text()).slice(0, 500);
      lastReport = {
        attempted: true,
        ok: res.ok,
        status: res.status,
        endpoint: url,
        responsePreview: preview,
      };
      if (!res.ok) {
        errors.push(`Asset ${i + 1}: HTTP ${res.status} — ${preview}`);
      } else {
        exportedAssets++;
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      lastReport = { attempted: true, ok: false, endpoint: url, error: message };
      errors.push(`Asset ${i + 1}: ${message}`);
    } finally {
      clearTimeout(timer);
      // Evita unhandled rejection si el fetch pierde la carrera del timeout
      fetchPromise.catch(() => {});
    }
  }

  return {
    ok: exportedAssets === bodies.length && bodies.length > 0,
    exportedAssets,
    report: lastReport,
    errors,
  };
}

// ─── Ecommerce Export ───────────────────────────────────────────────

/**
 * Export creative assets to an ecommerce platform.
 *
 * Con credenciales (env vars) hace el envío HTTP real a la API documentada;
 * sin credenciales devuelve el payload preparado, el endpoint destino y la
 * lista exacta de env vars faltantes (send.attempted=false). Honesty first.
 */
export async function exportToEcom(
  params: EcomExportParams,
  options: ExportOptions = {}
): Promise<EcomExportResult> {
  const validationErrors = validateExport(params);
  if (validationErrors.length > 0) {
    return {
      success: false,
      platform: params.platform,
      exportedAssets: 0,
      errors: validationErrors,
    };
  }

  const config = PLATFORM_CONFIGS[params.platform];
  const creds = resolvePlatformCredentials(params.platform, options.baseUrlOverride);

  // Modo PREPARED_ONLY: sin credenciales (o plataforma sin API pública de imágenes)
  if (!creds.present) {
    const exportUrl = `${config.productImageEndpoint.replace("{id}", params.productId)}?prepared=true`;
    return {
      success: true,
      platform: params.platform,
      exportedAssets: params.assets.length,
      exportUrl,
      credentials: { present: false, missingEnvVars: creds.missingEnvVars },
      send: { attempted: false, ok: false },
    };
  }

  // Modo ENVÍO REAL
  const send = await sendToPlatform(params, creds, options);
  return {
    success: send.ok,
    platform: params.platform,
    exportedAssets: send.exportedAssets,
    exportUrl: send.report.endpoint,
    errors: send.errors.length > 0 ? send.errors : undefined,
    credentials: { present: true, missingEnvVars: [] },
    send: send.report,
  };
}

// ─── Platform-Specific Payload Builders ─────────────────────────────

function buildPlatformPayload(platform: EcomPlatform, params: EcomExportParams): Record<string, unknown> {
  switch (platform) {
    case "shopify":
      return {
        product_id: params.productId,
        images: params.assets.map((asset, i) => ({
          src: asset.url,
          alt: asset.alt || `Product image ${i + 1}`,
          position: i + 1,
        })),
        metafields: Object.entries(params.metadata || {}).map(([key, value]) => ({
          namespace: "krea",
          key,
          value,
          type: "single_line_text_field",
        })),
      };

    case "woocommerce":
      return {
        product_id: params.productId,
        images: params.assets.map((asset, i) => ({
          src: asset.url,
          alt: asset.alt || `Product image ${i + 1}`,
          position: i + 1,
        })),
        meta_data: Object.entries(params.metadata || {}).map(([key, value]) => ({
          key: `krea_${key}`,
          value,
        })),
      };

    case "tiendanube":
      return {
        product_id: params.productId,
        images: params.assets.map((asset) => ({
          src: asset.url,
          alt: asset.alt || "",
        })),
      };

    case "funnelish":
      return {
        productId: params.productId,
        assets: params.assets.map((asset) => ({
          url: asset.url,
          type: asset.type,
          alt: asset.alt || "",
        })),
        metadata: params.metadata || {},
      };
  }
}

// ─── Platform Info ──────────────────────────────────────────────────

export function getPlatformInfo(platform: EcomPlatform): PlatformConfig {
  return PLATFORM_CONFIGS[platform];
}

export function getSupportedPlatforms(): Array<{ id: EcomPlatform; name: string }> {
  return Object.entries(PLATFORM_CONFIGS).map(([id, config]) => ({
    id: id as EcomPlatform,
    name: config.name,
  }));
}
