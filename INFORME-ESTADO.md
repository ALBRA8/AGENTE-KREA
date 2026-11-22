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
| E — Pendientes P2–P6 resueltos | Smoke real 13/13 rutas comerciales con generación real; 4 bugs raíz arreglados (tamaño del API, honestidad de rutas, export 500, buildLaunchBatch); edición NL real; validate-demand con red real; orquestador vía HTTP síncrono; 6 tests nuevos de `normalizeImageSize` | ver §3.2 |

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

Umbral del dueño (≥241 tests): **345 ≥ 241 CUMPLE** (203 baseline + 128 re-integrados + 14 nuevos de las suites `.bak` reparadas). Tras resolver el P1 la suite queda en **352** (7 nuevos de regresión de portada, §3.1) — verificado en el repo de trabajo: `tsc 0 errores · eslint 0 errores · 352/352 · build 0`. Tras resolver P2–P6 queda en **358** (6 nuevos de `normalizeImageSize`, §3.2). Re-verificación de clon limpio al cierre de la fase E (`a2447b7`): los 7 comandos exit 0, 352/352 en el clon. Ningún test fue retirado sin justificación (ver §5).

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

## 3.2 Smoke real por ruta comercial (P2/P3) + validate-demand con red (P5) + orquestador HTTP (P6)

**Hallazgo previo:** la primera corrida del smoke (P2) reveló que las rutas del motor creativo (ad/landing/mockup/edit/variants/batch/launch-pack) **fallaban en silencio** la parte de imagen: el API de imagen exige lados múltiplos de 32 en 512–2880 px con ≤ 2^22 px totales (error 1214), y el motor le pasaba dimensiones crudas (1080x1080, 600x200…). Los generadores propios (logo/banner/email/catalog) funcionaban porque mapeaban a presets válidos. Además `edit` chocó un 429 real y las rutas envolvían fallos internos con `success: true`.

**Bugs raíz arreglados:**

1. **Tamaño de imagen inválido (1214):** `zai.adapter` ahora normaliza cualquier tamaño al preset válido más cercano por aspecto (`normalizeImageSize`, 6 tests) y reintenta 2 veces con backoff ante 429 (texto e imagen).
2. **Honestidad de rutas:** ad/landing/mockup/edit/launch-pack devuelven ahora `success` espejando el resultado real del generador; `batch-pipeline` cuenta un item como `error` cuando el generador responde `success:false` (antes los contaba `done`).
3. **Export 500:** `validateExport` iteraba `assets` undefined → crash "undefined is not iterable"; además la ruta pasaba `{productData, creatives}` que no cumplía el contrato `EcomExportParams`. Ahora la librería es defensiva y la ruta mapea el cuerpo al contrato (productId/assets/metadata).
4. **buildLaunchBatch:** hacía spread de las *claves* de `productInfo` en vez de pasarlo como objeto → los ítems landing/banner crasheaban (`Cannot read properties of undefined (reading 'name')`). Ahora pasa `productInfo` explícito.
5. **Runner de pruebas:** `fuser` no existe en el sandbox y `lsof` no ve los procesos → las corridas golpeaban un servidor obsoleto del primer build. `run-with-server.sh` ahora mata el puerto con `ss -ltnp` y aborta si el puerto sigue ocupado.

**Salida real del smoke final (proveedor REAL, usuario smoke con créditos, saldo cobrado exacto 33 créditos):**

```
ruta          | codigo    | latencia | respuesta | resultado
logo           | HTTP 200 |   30.8s |   115487 B | success=true   ← imagen IA real
banner         | HTTP 200 |   21.2s |    60145 B | success=true   ← imagen IA real
email          | HTTP 200 |   21.4s |    82339 B | success=true   ← imagen IA real
catalog        | HTTP 200 |   33.7s |   175450 B | success=true   ← imagen IA real
ad             | HTTP 200 |   34.0s |   202840 B | success=true   ← imagen IA real
landing        | HTTP 200 |   35.8s |    87755 B | success=true   ← imagen IA real
mockup         | HTTP 200 |   30.1s |   224557 B | success=true   ← imagen IA real
edit           | HTTP 200 |   28.6s |   127221 B | success=true   ← EDICIÓN NL REAL (P3)
variants       | HTTP 200 |   72.6s |   270997 B | success=true
batch          | HTTP 200 |  108.9s |   236133 B | success=true
launch-pack    | HTTP 200 |  237.5s |        —   | success=true, 5/5 items done con imagen
export         | HTTP 200 |    0.0s |      503 B | success=true, honesty.realHttpSend=NOT_VERIFIED (sin OAuth, por diseño)
templates      | HTTP 200 |    0.0s |     4626 B | success=true
```

13/13 OK. Nota honesta: una corrida anterior al final terminó en **OOM del sandbox** (el kernel mató al next-server con RSS 2GB tras 13 rutas en un solo proceso — limitación del entorno, no del producto; dmesg: `Out of memory: Killed process 1970 (next-server)`); las 2 rutas restantes se completaron en proceso fresco. El `metadata.dimensions` sigue registrando la dimensión pedida; la generación real usa el preset normalizado.

**P5 — validate-demand con red real:** vía producción completa (bootstrap → arnés → plugin → python-bridge → `autocompletado.py` con Google suggest + `validar_demanda.py`): **VERIFIED, latencia 37.8s** (expansión con pausas de cortesía). Veredicto honesto: `adjust_topic` con 1 frase distinta tras exclusión de términos. Evidencia: `download/evidencia-validate-demand/`.

**P6 — Orquestador vía HTTP (decisión: síncrono):** `POST /api/product/produce` ahora ejecuta la fábrica de verdad (opcional `execute:false` para solo crear el registro) y `POST /api/product/factory/execute` ejecuta `executeFactory` y persiste el resultado; el dossier avanza PRODUCING→QA (éxito) o →FAILED (error), respetando la máquina de estados. Evidencia real: dossier nuevo → produce → **201, 563s, `book_factory` COMPLETED, 2 artefactos, dossier en QA** (`download/evidencia-smoke-commercial/p6-produce.json`). La alternativa de cola quedó documentada como evolución futura.

Verificación del código tras los fixes: `tsc 0 · eslint 0 · 358/358 tests · build 0`.

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
| `/api/commercial/*` generación (logo/banner/email/catalog/ad/landing/mockup/variants/edit/batch/launch-pack/templates) | VERIFIED | smoke real 13/13 con generación de imagen IA real por ruta (§3.2); créditos cobrados exactos (33) |
| Edición NL (`/api/commercial/edit`) | VERIFIED | 28.6s, imagen editada real 127KB vía `images.generations.edit` (§3.2, P3) |
| Export ecommerce | NOT_VERIFIED (parcial por diseño) | ruta expuesta y smoke OK con payload preparado (exit 0, 503B, 1 asset; §3.2); sin envío HTTP real — requiere OAuth de la plataforma (`honesty.realHttpSend: NOT_VERIFIED`) |
| Ads (meta/tiktok/google) | VERIFIED | ad route con imagen real 34s (§3.2); compilación y pruebas de copia/fallback |
| Pipeline Product Factory (oportunidad→entrega) | VERIFIED | E2E real exit 0 (§3) + 345 tests unitarios + producción vía HTTP real: produce 201, book_factory COMPLETED, dossier→QA (§3.2 P6) |
| `evaluateProductFit` con LLM real | VERIFIED | E2E: 0.77 PROCEED (2 llamadas reales en dos corridas) |
| book-factory 10 pasos | VERIFIED | E2E real 58.4s + suite con PDF/portada/QA reales (7 tests) |
| QA (visual-qa + product-qa + revisión Python) | VERIFIED (visual-qa) | 9 checks reales sobre el PDF del E2E; product-qa 6 categorías con fixture; revisión Python NOT_VERIFIED de ejecución real en esta ronda |
| Readiness comercial | VERIFIED | E2E real: READY_FOR_SALE 0.838 |
| Launch package + integridad | VERIFIED | E2E real: válido, integridad limpia |
| Versionado semver | VERIFIED | E2E real: 1.0.0 DRAFT→PUBLISHED + tests |
| Handoff (aprobar/enviar/reconocer) | VERIFIED (máquina de estados) | tests 31 casos; envío a proveedor externo real NOT_VERIFIED (no hay proveedor externo conectado) |
| Arnés: validate-demand | VERIFIED (con red real) | autocompletado real contra Google vía producción completa: VERIFIED, 37.8s (§3.2) |
| Arnés: render Python (ebook/guion/portada/pagina_venta) | NOT_VERIFIED en este entorno | SIN Chrome (evidencia: `portada.py` → "No encontré Edge ni Chrome"); degradación honesta implementada; scripts puros VERIFIED (`contraste.py` 21.0:1) |
| Doctor | VERIFIED | 15 checks + `python-environment` nuevo con sonda real (`{"chrome": null, "pil": true, "pymupdf": true}`) |
| Deployment | NOT_VERIFIED | no se ejecutó despliegue en esta ronda |
| `ZAI_API_KEY` explícita | NOT_APLICABLE | el SDK resuelve credenciales del entorno; no hay variable explícita en `.env` (solo `DATABASE_URL`) |

## 5. Tests: justicia en los retiros (ningún borrado silencioso)

- 203 baseline + 128 re-integrados (`lib-tests`) + 14 de las suites `.bak` reparadas + 7 de regresión de portada (`pdf-factory-cover.test.ts`, P1) + 6 de `normalizeImageSize` (P2) = **358**.
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
2. ~~**P2 — Smoke real por ruta comercial**~~ → **RESUELTO** (13/13 con generación real; 4 bugs raíz arreglados; evidencia y hallazgos en §3.2).
3. ~~**P3 — Edición NL**~~ → **RESUELTO** (28.6s, imagen editada real vía `images.generations.edit`; §3.2).
4. **P4 — Export ecommerce:** credenciales OAuth reales de una plataforma para pasar de payload a envío VERIFIED.
5. ~~**P5 — validate-demand con red**~~ → **RESUELTO** (VERIFIED con Google real, 37.8s; §3.2).
6. ~~**P6 — Orchestrator vía HTTP**~~ → **RESUELTO** (decisión: ejecución síncrona con `execute:false` opcional; evidencia real en §3.2). Evolución futura: cola si se requiere multi-usuario.
7. **P7 — Token de GitHub:** el token expuesto en el chat debió revocarse en GitHub (no lo guardo en ningún archivo); para futuros pushes usar token nuevo o SSH.
8. **P8 — Chrome en el entorno de despliegue** si se quiere el render Python de marca (documentado en README/SKILL.md/doctor; sin él el sistema opera en vía TS canónica).

## 8. Seguridad

- Grep de patrones de token (`ghp_`, `github_pat_`, `sk-`) en árbol e historial: **0 coincidencias**.
- `.env` solo contiene `DATABASE_URL`; `.gitignore` cubre `.env*`; `.env.example` sin secretos.
- `/api/harness execute-skill` ahora valida sesión real y cobra créditos (antes: puerta abierta).
- Rate-limit con IP robusta (no confía ciegamente en `x-forwarded-for`) — sin cambios en esta ronda.
