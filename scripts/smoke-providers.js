#!/usr/bin/env node
/**
 * smoke:providers — prueba REAL de cada capacidad del proveedor z.ai
 *
 * Ejecuta una llamada mínima por capacidad (texto, imagen, voz), mide
 * latencia y tamaño de salida, y guarda la evidencia en
 * smoke-providers-results.json.
 *
 * Clasificación honesta:
 *  - VERIFIED      : la llamada real respondió con contenido
 *  - NOT_VERIFIED  : no se pudo probar (sin credenciales / red / error)
 *
 * Uso: npm run smoke:providers
 */
const fs = require("fs");
const path = require("path");

const RESULTS_FILE = path.join(process.cwd(), "smoke-providers-results.json");

async function main() {
  const results = { timestamp: new Date().toISOString(), capabilities: {} };

  let ZAI;
  try {
    ZAI = (await import("z-ai-web-dev-sdk")).default;
  } catch (e) {
    console.error("SDK no disponible:", e.message);
  }

  const keyState = process.env.ZAI_API_KEY
    ? "explicit (ZAI_API_KEY presente)"
    : "implicit (sin ZAI_API_KEY — el SDK usa credenciales del entorno si existen)";

  console.log(`[smoke] Estado de credenciales: ${keyState}\n`);

  /* ── 1. Texto ── */
  if (ZAI) {
    try {
      const start = Date.now();
      const zai = await ZAI.create();
      const res = await zai.chat.completions.create({
        messages: [{ role: "user", content: "Responde exactamente: OK" }],
      });
      const content = res.choices?.[0]?.message?.content || "";
      if (content) {
        results.capabilities.text = {
          status: "VERIFIED",
          latencyMs: Date.now() - start,
          outputChars: content.length,
          sample: content.slice(0, 80),
        };
        console.log(`✅ text      VERIFIED  ${Date.now() - start}ms  ${content.length} chars`);
      } else {
        throw new Error("respuesta vacía");
      }
    } catch (e) {
      results.capabilities.text = { status: "NOT_VERIFIED", error: String(e.message || e) };
      console.log(`❌ text      NOT_VERIFIED  ${e.message}`);
    }

    /* ── 2. Imagen ── */
    try {
      const start = Date.now();
      const zai = await ZAI.create();
      const res = await zai.images.generations.create({
        model: "flux-krea-v2",
        prompt: "simple blue circle on white background, minimal",
        size: "1024x1024",
      });
      const base64 = res.data?.[0]?.base64 || "";
      if (base64) {
        const bytes = Math.round((base64.length * 3) / 4);
        results.capabilities.image = {
          status: "VERIFIED",
          latencyMs: Date.now() - start,
          outputBytes: bytes,
        };
        console.log(`✅ image     VERIFIED  ${Date.now() - start}ms  ${bytes} bytes`);
      } else {
        throw new Error("sin base64 en la respuesta");
      }
    } catch (e) {
      results.capabilities.image = { status: "NOT_VERIFIED", error: String(e.message || e) };
      console.log(`❌ image     NOT_VERIFIED  ${e.message}`);
    }

    /* ── 3. Voz (TTS) ── */
    try {
      const start = Date.now();
      const zai = await ZAI.create();
      const res = await zai.audio.tts.create({
        input: "Prueba de humo",
        voice: "tongtong",
      });
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > 0) {
        results.capabilities.voice = {
          status: "VERIFIED",
          latencyMs: Date.now() - start,
          outputBytes: buf.length,
        };
        console.log(`✅ voice     VERIFIED  ${Date.now() - start}ms  ${buf.length} bytes`);
      } else {
        throw new Error("audio vacío");
      }
    } catch (e) {
      results.capabilities.voice = { status: "NOT_VERIFIED", error: String(e.message || e) };
      console.log(`❌ voice     NOT_VERIFIED  ${e.message}`);
    }
  } else {
    for (const cap of ["text", "image", "voice"]) {
      results.capabilities[cap] = { status: "NOT_VERIFIED", error: "z-ai-web-dev-sdk no disponible" };
    }
  }

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  const verified = Object.values(results.capabilities).filter((c) => c.status === "VERIFIED").length;
  const total = Object.keys(results.capabilities).length;
  console.log(`\n[smoke] ${verified}/${total} VERIFIED — evidencia en ${path.basename(RESULTS_FILE)}`);
  process.exitCode = verified === total ? 0 : 1;
}

main().catch((e) => {
  console.error("[smoke] ERROR:", e);
  process.exitCode = 1;
});
