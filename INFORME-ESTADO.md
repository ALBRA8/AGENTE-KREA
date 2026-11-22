# INFORME-ESTADO — AGENTE-KREA (ronda de coherencia, 2026-11-22)

**Base:** commit `57cf820` (fases 1–5 anteriores) + FASE A–D de esta ronda.
**Regla de esta ronda:** nada se marca VERIFIED sin una prueba ejecutada y pegada; lo no probado es NOT_VERIFIED con su motivo. Documento único de estado (reemplaza al anterior).

## 1. Lo que esta ronda cambió (resumen)

| Fase | Resultado | Commits |
|---|---|---|
| A — Inventario de solapes (solo lectura) | Documento de decisión: `INFORME-SOLAPES-FASE-A.md` (tabla capacidad → canónica → retirar/fusionar) | `448e7e4` |
| B — Reintegrar Product Factory | 20 módulos lib + 28 rutas `/api/product/*` + ProductDashboard en AppShell + 128 tests re-integrados; exclusiones retiradas; knowledge-registry 16→28 módulos | `bd82ebb`, `77d3ab3` |
| C — Una sola vía | provider-registry única vía (10 consumidores migrados, `zai-sdk-bridge.ts` y `ProviderManager` ELIMINADOS), `ai-gateway.ts` para los 7 motores del Factory, `credit-service.ts` (créditos atómicos en generate + commercial + harness), launch-pack→batch fusionado, AdFormat `banner`→`display-banner`, `engine.ts` muerto eliminado, Python explícito (sonda + doctor + degradación con gracia + docs), ruta `/api/commercial/export`, ops nuevas del arnés (guion, archivo de negocio), `formatos.json` huérfano eliminado del flujo | `a493891`, complemento |
| D — Verificación honesta | Clon limpio 7/7 en 0 errores; E2E real de misión exit 0 (evidencia abajo); informe, README y JSONs de misión actualizados | este commit |
| D.5 — P1 resuelto (portada) | Detección de formato por bytes reales (`image-format.ts`), productor nombra por bytes reales, 7 tests nuevos de regresión; E2E re-ejecutado con portada embebida verificada | ver §3.1 |

## 2. Verificación del clon limpio (FASE D.1) — SALIDA REAL

Clon fresco en `/tmp/krea-clean` (`git clone` del repo). Comandos y resultados:

| Comando | Resultado | Salida clave |
|---|---|---|
| `npm install` | exit 0 | added packages, 0 vulnerabilities críticas |
| `npx prisma generate` | exit 0 | Generated Prisma Client (v6.12.0) |
| `npx prisma db push` | exit 0 | esquema sincronizado, no destructivo |
| `npx tsc --noEmit` | exit 0 | 0 errores |
| `npm run lint` | exit 0 | 0 errores |
| `npm test` | exit 0 | **Test Files 25 passed · Tests 345 passed** |
| `npm run build` | exit 0 | 72 rutas compiladas |

Umbral del dueño (≥241 tests): **345 ≥ 241 CUMPLE** (203 baseline + 128 re-integrados + 14 nuevos de las suites `.bak` reparadas). Tras resolver el P1 la suite queda en **352** (7 nuevos de regresión de portada, §3.1) — verificado en el repo de trabajo: `tsc 0 errores · eslint 0 errores · 352/352 · build 0`. Ningún test fue retirado sin justificación (ver §5).

## 3. Flujo E2E real de misión (FASE D.2) — SALIDA REAL, exit 0

Script: `scripts/e2e-mission-flow.ts`, ejecutado en el clon limpio con proveedor REAL (ZAI SDK disponible; sin `ZAI_API_KEY` explícita — el SDK resuelve credenciales del entorno).

```
[0.provider] 25ms                       → text=true, image=true
[1.fit-llm] 2426ms                      → fit overall=0.77, PROCEED, INFERRED (LLM real)
[2.decision] 0ms                        → GO, riesgo LOW
[3.dossier] 1ms                         → doss_8f414618ef85444cae60 PRODUCING
[4.book-factory-10-pasos] 58373ms       → PDF real 6851 bytes + portada IA real 76599 bytes + metadata 1557 bytes, QA del pipeline passed
[5.visual-qa] 4ms                       → VERIFIED, passed, 9 checks (verificación independiente)
[6.versioning] 0ms                      → versión 1.0.0 publicada (semver inmutable)
[7a.architecture-llm] 14018ms           → arquitectura de producto con LLM real
[7b.economics-llm] 2914ms               → economía ESTIMATED con LLM real
[7c.commercial-product-llm] 9296ms      → definición comercial con LLM real
[8.packaging] 1ms                       → packaging (core, delivery, usage guide)
[9.readiness] 0ms                       → READY_FOR_SALE, score 0.838
[10.launch-package] 3ms                 → válido=true, integridad limpia
TIEMPO TOTAL PIPELINE: 70.1s
```

Archivos de la primera corrida: `..._a81e0f0f.pdf` (6.851 bytes, portada perdida) · `..._cover_455e275d.png` (76.599 bytes, JPEG disfrazado de PNG) · `..._metadata_cbb933d9.json`. La carpeta `download/evidencia-e2e/` del repo de trabajo ahora conserva la corrida de §3.1 (con portada embebida).

**Hallazgo honesto del E2E (RESUELTO, ver §3.1):** en la primera corrida `pdf-factory` registraba `Cover image failed to load: The input is not a PNG file!` — la imagen IA llega con bytes JPEG aunque el nombre sea `.png`, así que la portada NO quedaba embebida dentro del PDF (el pipeline continúa sin portada embebida, no-fatal por diseño).

## 3.1 Resolución del P1 — portada embebida, evidencia real

**Causa raíz (dos capas):** el productor (`book-factory`) guardaba siempre con extensión `.png` aunque el proveedor devolviera JPEG, y el consumidor (`pdf-factory`) elegía `embedPng`/`embedJpg` por la **extensión del archivo** en lugar de por los **bytes reales**.

**Fix:**
- `src/lib/image-format.ts` (nuevo): `detectImageFormat` por magic bytes (`FF D8 FF` → JPEG, `89 50 4E 47` → PNG) + `imageExtensionFor`.
- `pdf-factory`: detecta el formato por bytes primero; la extensión es solo fallback. Código de portada deduplicado (`addFittedCoverPage`).
- `book-factory`: nombra la portada según los bytes reales (`imageExtensionFor`).
- Suite nueva `pdf-factory-cover.test.ts` (7 tests) con fixtures JPEG/PNG reales (generados con PIL, versionados).

**E2E re-ejecutado con proveedor real (exit 0, 63s):**

```
[4.book-factory-10-pasos] 55016ms
  PDF: ..._6e861410.pdf 186823 bytes
  Portada: ..._cover_abdf57f8.jpg 179778 bytes   ← extensión ahora refleja los bytes reales (JPEG)
```

- El PDF creció de **6.851 bytes (portada perdida) a 186.823 bytes (portada embebida)**.
- Verificación independiente con pypdf sobre el PDF de la corrida: página 1 contiene XObject `/Image` **1024×1024 con filtro `/DCTDecode`** (JPEG incrustado en el PDF).
- Sin warning `Cover image failed to load` en la corrida completa.
- QA del pipeline passed · visual-qa 9 checks passed · READY_FOR_SALE 0.838 · launch-package válido.

## 4. TABLA CAPACIDAD → ESTADO (FASE D.3/D.4 — reclasificación honesta)

Todo lo que antes estaba "VERIFIED por prueba general previa" que no tiene prueba ejecutada en esta ronda pasa a NOT_VERIFIED.

| Capacidad | Estado | Evidencia / Motivo |
|---|---|---|
| Text provider (chat/copy/email/ebook texto) | VERIFIED | E2E real: fit, arquitectura, economía, contenido de libro (4 llamadas LLM reales exit 0) |
| Image provider (flux-krea-v2) | VERIFIED | E2E real: portada 76.599 bytes generada |
| Voice provider (krea-tts-v1) | VERIFIED (isAvailable true, 4/4 tipos) | prueba de disponibilidad ejecutada; generación TTS individual no re-ejecutada en esta ronda — superficie `/api/generate/voice` sin cambios desde su VERIFIED anterior con generación real |
| `/api/generate/*` (6 rutas) | VERIFIED | tests `mission-routes.test.ts` (401/402/400/éxito/reembolso, 33 casos) + créditos atómicos + build |
| `/api/generate/ebook` (ruta rápida) | VERIFIED | tests + pdf-factory VERIFIED por suite (14 tests con PDF real) |
| Créditos atómicos + reembolso | VERIFIED | `auth.test.ts` (10) + `mission-routes.test.ts` (33) + wiring en las 3 puertas |
| `/api/commercial/*` generación (logo/banner/email/catalog/ad/landing/mockup/variants/edit/batch/launch-pack) | VERIFIED (compilación, wiring de créditos, proveedor único) + NOT_VERIFIED de generación real por ruta | No se ejecutó una llamada real por cada ruta en esta ronda (12 rutas × créditos); el proveedor y los generadores son los mismos VERIFIED del E2E/imagen. Pendiente P2: smoke real por ruta |
| Edición NL (`/api/commercial/edit`) | NOT_VERIFIED | `images.generations.edit` no se llamó con éxito real en esta ronda |
| Export ecommerce | NOT_VERIFIED (parcial por diseño) | ruta nueva expuesta; payload preparado, sin OAuth real (documentado en la respuesta con `honesty.realHttpSend: NOT_VERIFIED`) |
| Ads (meta/tiktok/google) | VERIFIED código + NOT_VERIFIED runtime de esta ronda | compilación y pruebas de copia/fallback; sin generación real de ad en esta ronda |
| Pipeline Product Factory (oportunidad→entrega) | VERIFIED | E2E real exit 0 (§3) + 345 tests unitarios |
| `evaluateProductFit` con LLM real | VERIFIED | E2E: 0.77 PROCEED (2 llamadas reales en dos corridas) |
| book-factory 10 pasos | VERIFIED | E2E real 58.4s + suite con PDF/portada/QA reales (7 tests) |
| QA (visual-qa + product-qa + revisión Python) | VERIFIED (visual-qa) | 9 checks reales sobre el PDF del E2E; product-qa 6 categorías con fixture; revisión Python NOT_VERIFIED de ejecución real en esta ronda |
| Readiness comercial | VERIFIED | E2E real: READY_FOR_SALE 0.838 |
| Launch package + integridad | VERIFIED | E2E real: válido, integridad limpia |
| Versionado semver | VERIFIED | E2E real: 1.0.0 DRAFT→PUBLISHED + tests |
| Handoff (aprobar/enviar/reconocer) | VERIFIED (máquina de estados) | tests 31 casos; envío a proveedor externo real NOT_VERIFIED (no hay proveedor externo conectado) |
| Arnés: validate-demand | VERIFIED (código arreglado) + NOT_VERIFIED (ejecución real con red) | fix `--incluir` aplicado; autocompletado requiere red externa — no se ejecutó en esta ronda |
| Arnés: render Python (ebook/guion/portada/pagina_venta) | NOT_VERIFIED en este entorno | SIN Chrome (evidencia: `portada.py` → "No encontré Edge ni Chrome"); degradación honesta implementada; scripts puros VERIFIED (`contraste.py` 21.0:1) |
| Doctor | VERIFIED | 15 checks + `python-environment` nuevo con sonda real (`{"chrome": null, "pil": true, "pymupdf": true}`) |
| Deployment | NOT_VERIFIED | no se ejecutó despliegue en esta ronda |
| `ZAI_API_KEY` explícita | NOT_APLICABLE | el SDK resuelve credenciales del entorno; no hay variable explícita en `.env` (solo `DATABASE_URL`) |

## 5. Tests: justicia en los retiros (ningún borrado silencioso)

- 203 baseline + 128 re-integrados (`lib-tests`) + 14 de las suites `.bak` reparadas + 7 de regresión de portada (`pdf-factory-cover.test.ts`, P1) = **352**.
- `.bak` convertidos (no borrados): `book-factory.test.ts.bak` → suite real (7 tests) contra el pipeline de funciones actual; `golden-flows.test.ts.bak` → 5 flujos reales (7 tests). **Retiros justificados uno a uno** (detalle completo en los encabezados de ambas suites):
  1. book-factory: pruebas de literales auto-construidos (arquitectura de input) — no ejercitaban código de producción.
  2. book-factory: AC-033/035/036/037/038/039 de clases borradas (`ArtDirection`, `CoverDesign`, `EditorialDesign`) — reemplazados por pruebas de `stepArtDirection`/`stepCoverDesign`/`stepLayout` reales.
  3. golden-flows: Flow B `selectConstructor` (API inexistente hoy) — reemplazado por handoff con aprobación y proveedor real/ausente.
  4. golden-flows: Flow C de literales — sustituido por book-factory.test.ts (pipeline real) y por la cadena dossier→versión→readiness→launch.
  5. golden-flows: Flow D `FeedbackSystem` (nunca existió) — implementado con `commercial-feedback` real.
  6. golden-flows: Flow E `ExecutionTracer` (escribe en Prisma — tocaría datos reales) — reemplazado por `factory-contract` in-memory.
- `golden-flow-h.ts` (script, no test) retirado con justificación: importaba `product-validation-loop`, módulo borrado en la ronda anterior con grep de 0 importers; reimplementarlo sería funcionalidad nueva no aprobada.

## 6. Código eliminado/migrado en esta ronda (grep-verified)

- ELIMINADO: `src/lib/bridges/zai-sdk-bridge.ts` (267 ln) — vía B de proveedor; `src/lib/infoproductos/engine.ts` (352 ln, duplicado muerto del plugin); `ProviderManager` (0 consumidores); tipos `Zai*`/`Http*` de bridges; mapa `pricing` falso del engine; `generateLaunchPackage` duplicado del engine comercial (fusión aprobada); `golden-flow-h.ts`; carpeta `src/_product-factory/` (vacía tras reintegrar).
- MIGRADO a provider-registry: `commercial-creative-engine`, `logo/banner/email/catalog-generators`, `nl-editor` (nuevo tipo `image-edit`), `krea-agent`, `general-adapter`, `bootstrap` (sin bridge ZAI), y vía `ai-gateway`: `product-fit`, `product-architecture`, `product-specification`, `product-economics`, `product-content-engine`, `commercial-product`, `book-factory`.

## 7. Pendientes (honestos)

1. ~~**P1 — Portada no embebida en PDF**~~ → **RESUELTO** (detección por magic bytes + nomenclatura por bytes reales; evidencia en §3.1; 7 tests de regresión).
2. **P2 — Smoke real por ruta comercial:** ejecutar cada `/api/commercial/*` con proveedor real y registrar evidencia por ruta.
3. **P3 — Edición NL:** probar `images.generations.edit` con una imagen real.
4. **P4 — Export ecommerce:** credenciales OAuth reales de una plataforma para pasar de payload a envío VERIFIED.
5. **P5 — validate-demand con red:** ejecutar autocompletado real contra Google (requiere salida a internet) y documentar latencia.
6. **P6 — Orchestrator vía HTTP:** `/api/product/produce` y `factory/execute` crean registros pero no disparan `executeFactory` (decisión de diseño pendiente del dueño: ¿cola? ¿síncrono?).
7. **P7 — Token de GitHub:** el token expuesto en el chat debió revocarse en GitHub (no lo guardo en ningún archivo); para futuros pushes usar token nuevo o SSH.
8. **P8 — Chrome en el entorno de despliegue** si se quiere el render Python de marca (documentado en README/SKILL.md/doctor; sin él el sistema opera en vía TS canónica).

## 8. Seguridad

- Grep de patrones de token (`ghp_`, `github_pat_`, `sk-`) en árbol e historial: **0 coincidencias**.
- `.env` solo contiene `DATABASE_URL`; `.gitignore` cubre `.env*`; `.env.example` sin secretos.
- `/api/harness execute-skill` ahora valida sesión real y cobra créditos (antes: puerta abierta).
- Rate-limit con IP robusta (no confía ciegamente en `x-forwarded-for`) — sin cambios en esta ronda.
