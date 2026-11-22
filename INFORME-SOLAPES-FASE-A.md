# FASE A — Inventario de solapes y decisión de implementación canónica

**Repositorio:** ALBRA8/AGENTE-KREA · **Base:** commit `57cf820` (FASE 1–5 previas) · **Fecha:** 2026-11-22
**Naturaleza:** documento de decisión, solo lectura de código. Ningún archivo de código fue modificado.
**Estado:** ⛔ DETENIDO — espera aprobación del dueño antes de FASE B.

---

## 0. Regla del dueño que gobierna este documento

> El Product Factory NO se archiva; queda integrado en KREA junto con la producción creativa, el motor comercial y el arnés de infoproductos, como un único pipeline: **oportunidad → decisión → especificación → producción → QA → preparación comercial → entrega.**

Consecuencia arquitectónica: KREA deja de tener 3 subsistemas paralelos y pasa a tener **un backbone** (el Product Factory re-integrado) y **motores de producción** (creativo-comercial, infoproductos-arnés) que cuelgan de las etapas de producción/QA de ese backbone, todos pasando por **una única capa de proveedor y un único sistema de créditos**.

## 1. Mapa de subsistemas (hechos verificados con grep/lectura)

### 1.1 Subsistema creativo-comercial
| Pieza | Tamaño | Qué hace | Proveedor que usa hoy | Créditos | Alcanzable desde |
|---|---|---|---|---|---|
| `src/lib/commercial-creative-engine.ts` | 1231 ln | ads (meta/tiktok/google), landing-sections (10 tipos), mockups (7), variantes A/B, launch-pack creativo | `zaiSdkBridge` directo | NO (solo declara `pricing`) | 6 rutas `/api/commercial/*` |
| `src/lib/commercial/logo-generator.ts` | 150 ln | logos 6 estilos × 6 variantes | `zaiSdkBridge` | NO | `/api/commercial/logo` |
| `src/lib/commercial/banner-generator.ts` | 122 ln | banners 8 formatos | `zaiSdkBridge` | NO | `/api/commercial/banner` |
| `src/lib/commercial/email-creative.ts` | 114 ln | creativos email imagen 6 tipos | `zaiSdkBridge` | NO | `/api/commercial/email` |
| `src/lib/commercial/catalog-generator.ts` | 109 ln | catálogos 5 formatos | `zaiSdkBridge` | NO | `/api/commercial/catalog` |
| `src/lib/commercial/nl-editor.ts` | 85 ln | edición por lenguaje natural | `zaiSdkBridge.editImage` | NO | `/api/commercial/edit` |
| `src/lib/commercial/template-gallery.ts` | 263 ln | 18 plantillas estáticas | ninguno (estático) | NO | `/api/commercial/templates` |
| `src/lib/commercial/batch-pipeline.ts` | 182 ln | lote con concurrencia + preset lanzamiento | delega | NO | `/api/commercial/batch` |
| `src/lib/commercial/ecom-export.ts` | 181 ln | payload shopify/woocommerce/tiendanube/funnelish — **sin llamada HTTP real** | ninguno | NO | **ninguna ruta** (huérfano) |
| `src/lib/commercial/krea-agent.ts` | 486 ln | `KreaAdapter` (identidad "agente-krea") que delega en todo lo anterior | `zaiSdkBridge` | NO | solo `bootstrap.ts` (registrado, sin ruta) |
| 12 rutas `/api/commercial/*` | — | puerta HTTP del motor | — | **NO cobran, NO reembolsan, NO registran en DB** | UI: **ninguna** las llama |

### 1.2 Subsistema arnés + infoproductos
| Pieza | Tamaño | Qué hace | Proveedor | Créditos | Alcanzable desde |
|---|---|---|---|---|---|
| `src/lib/krea-harness.ts` | 301 ln | arnés: monta adaptadores, skills, bridges, conocimiento | delega | NO | `/api/harness`, tests |
| `src/lib/harness/infoproductos-plugin.ts` | 429 ln | 8 operaciones de infoproductos → **PythonBridge** → scripts | Python + red (autocomplete) | NO (`costUsd` informativo falso) | `POST /api/harness {execute-skill}` |
| `src/lib/infoproductos/engine.ts` | 352 ln | **duplicado 1:1 del plugin que evita el bridge** (execFile directo) | Python directo | NO | **NADIE — código muerto** (solo aparece como string en metadata del knowledge-registry) |
| `src/lib/infoproductos/scripts/*.py` | 15 scripts | demanda, contenido, portada, página de venta, QA estilo/contenido, render | Python (+Chrome en 5 de ellos) | NO | vía plugin |
| `src/lib/bridges/python-bridge.ts` | 207 ln | execFile python3 con timeout/JSON | — | NO | plugin, general-adapter |
| `src/lib/bridges/zai-sdk-bridge.ts` | 267 ln | wrapper SDK (chat/imagen/edición/TTS) | ZAI SDK | NO | 10 consumidores |
| `src/lib/adapters/general-adapter.ts` | 504 ln | `AgentAdapter` "agente-general" (razona/memoria/audita/seguridad) | `zaiSdkBridge` + PythonBridge | NO | `bootstrap.ts` |
| `/api/harness` | — | **única puerta HTTP del arnés**; `execute-skill` ejecuta Python | — | **NO valida token real, NO cobra** | UI: ninguna |

### 1.3 Subsistema Product Factory (archivado en `src/_product-factory/`, excluido de tsconfig/eslint/vitest)
| Etapa del pipeline | Módulo | Qué hace | Generación |
|---|---|---|---|
| Oportunidad | `product-dossier.ts` + `product-fit.ts` | expediente único + scoring 5 dimensiones | fit llama **ZAI directo** |
| Decisión | `product-decision.ts` | GO/NO-GO determinista | puro |
| Especificación | `product-architecture.ts`, `product-specification.ts`, `product-economics.ts` | arquitectura por dominio, criterios de aceptación, economía honesta | **ZAI directo** (×6) |
| Contrato | `product-blueprint.ts`, `factory-contract.ts` | blueprint de producción + máquina de estados ejecución | puro |
| Producción | `book-factory.ts` (10 pasos), `product-content-engine.ts`, orquestador con 4 fábricas (book/document/kit/handoff-only) | genera contenido/portada/PDF | **ZAI directo** (book-factory chat×4 + imagen×1) |
| QA | `product-qa.ts` (6 categorías) | agregador, repara | puro + `visual-qa` |
| Comercial | `commercial-product.ts`, `offer-architecture.ts`, `product-packaging.ts`, `commercial-readiness.ts`, `launch-package.ts` | definición, oferta 8 elementos, empaquetado, readiness 8 dimensiones, paquete de lanzamiento con puerta de integridad | 1 LLM (commercial-product) |
| Entrega | `product-handoff.ts`, `product-versioning.ts` | handoff proveedor-neutral (nunca finge SENT), semver inmutable | puro |
| 28 rutas API | `api-routes/*` | usan `@/lib/...`, `getSessionUser`, Prisma | — |
| Dashboard | `components/ProductDashboard.tsx` (1679 ln, 8 secciones) | llama `/api/product/*` | — |
| Tests | 12 archivos `lib-tests/` (**128 casos**) + 2 `.bak` | — | — |
| Prisma | 10 modelos **ya existen** (`ProductOpportunity`, `ProductDossier`, `Handoff`, `CommercialProduct`, `ProductBlueprint`, `ProductAsset`, `FactoryExecution`, `ProductVersionRecord`, `LaunchPackage`, `CommercialFeedback`) | — | — |

### 1.4 Capa de proveedor (hoy: DOS vías paralelas)
| Vía | Cadena | Consumidores | Créditos/DB |
|---|---|---|---|
| **A (contratos, FASE 3)** | `/api/generate/*` → `getProvider()` → `zai.adapter.ts` → SDK | las 6 rutas generate + tests | SÍ (atómico + reembolso + `Generation`) |
| **B (bridges)** | motor → `zaiSdkBridge` → SDK | engine comercial + 5 generadores + krea-agent + general-adapter | NO |

Además: `ProviderManager` (provider.interface.ts) **0 consumidores** — muerto. `GenerationType "prompt"` sin adaptador (la ruta prompt reutiliza el de texto). `agenteGeneralPythonBridge` apunta a `albra_seed/` que **no existe**. `HttpBridge` documentado y nunca implementado.

## 2. Evidencia ejecutada en esta fase (real, no inventada)

| # | Comando / prueba | Resultado |
|---|---|---|
| 1 | `grep -rn "infoproductos/engine" src` | solo metadata en knowledge-registry.ts:151 → **engine.ts muerto** |
| 2 | `grep -rln "provider-registry" src` | solo las 6 rutas generate + tests → vía B sin pasar por registry |
| 3 | `grep -rn "ProviderManager" src` | 0 consumidores |
| 4 | `python3 contraste.py "#000000" "#FFFFFF"` | `21.0:1 (texto chico OK)` — scripts Python puros **funcionan** |
| 5 | `python3 validar_demanda.py /tmp/test-entradas.json` | ejecuta (falló con mi JSON de prueba mal formado — el script corre) |
| 6 | `python3 portada.py /tmp/portada-test.json /tmp/portada-out --formato ebook` | **`No encontré Edge ni Chrome. Buscados: google-chrome, chromium, chromium-browser, microsoft-edge`** — los 5 scripts que renderizan **no pueden correr en este entorno** |
| 7 | `python3 --version; PIL; PyMuPDF; pypdf` | Python 3.12.16 ✓ · PIL 11.3.0 ✓ · PyMuPDF 1.26.7 ✓ · pypdf 6.6.0 ✓ — **falta solo Chrome** |
| 8 | `npm test` | **203 passed (11 archivos)** — baseline real |
| 9 | `grep` secretos (`ghp_`, `github_pat_`, `sk-`) en árbol e historial | **0 coincidencias**; `.env` solo tiene `DATABASE_URL`; `.gitignore` cubre `.env*` |
| 10 | `grep -n "formatos" infoproductos-plugin.ts` | línea 227 pasa `"formatos.json"` a `validar_demanda.py`; **nada lo genera** → `validate-demand` roto tal como está cableado |
| 11 | `ls albra_seed` | no existe → `agenteGeneralPythonBridge` permanentemente no funcional |
| 12 | `git status` sin contenido diff | los 15 archivos "M" son **solo cambios de modo** (644→755, ruido del sandbox) — se normalizan al primer commit |

## 3. TABLA DE DECISIÓN — capacidad → canónica → retirar/fusionar

Leyenda de acción: **MANTENER** · **FUSIONAR** (una impl. absorbe a otra) · **BORRAR** (grep sin consumidores) · **EXPONER** (existe pero sin ruta) · **RENOMBRAR** (colisión de nombres).

| Capacidad | Implementación CANÓNICA | Implementaciones a retirar / fusionar | Acción propuesta |
|---|---|---|---|
| **eBook (PDF)** | `/api/generate/ebook` → provider-registry(text) + `pdf-factory.ts` (créditos 8, DB, UI) — es la puerta de usuario; `book-factory.ts` (10 pasos) es el pipeline de marca dentro del Factory | `ebook.py`+`render.py` (Python-Chrome) — NO ejecutable en este entorno | MANTENER ambas TS (route rápida y pipeline de marca); Python ebook queda **opcional** con doctor-check (ver §4) |
| **Portada** | `book-factory.stepCoverDesign` vía provider-registry(image) | `portada.py` (Chrome) | MANTENER IA como canónica; Python opcional |
| **PDF render** | `pdf-factory.ts` (pdf-lib, sin dependencias externas) | `render.py` (Chrome) | MANTENER pdf-factory; render.py opcional |
| **Logo** | `commercial/logo-generator.ts` (`/api/commercial/logo`, multivariante) | ninguna (`/api/generate/image` es imagen genérica, rol distinto) | MANTENER |
| **Banner** | `commercial/banner-generator.ts` (8 formatos) | colisión de nombre: `AdFormat="banner"` (300×250) en engine vs `BannerFormat` (8 web/print) | RENOMBRAR el formato de ads a `"display-banner"` en FASE C |
| **Email** | **dos capacidades reales, no duplicados:** copy (`/api/generate/text type=email`) y creativo-imagen (`email-creative.ts`) | — | MANTENER ambas, documentar la distinción |
| **Catálogo** | `commercial/catalog-generator.ts` (5 formatos) | — | MANTENER |
| **Ads** | `commercial-creative-engine.generateAd` (meta/tiktok/google) | — | MANTENER |
| **Landing (visual, 10 secciones)** | `commercial-creative-engine.generateLandingSection` | — | MANTENER |
| **Página de venta (marketplace)** | `pagina_venta.py` (txt/HTML/PNG móvil+PC para Hotmart/Gumroad) — producto distinto al landing visual | — | MANTENER como capacidad propia del arnés (opcional-Chrome para PNG) |
| **QA** | `product-qa.ts` (agregador 6 categorías) + `visual-qa.ts` (PDF, 7 checks VERIFIED) + `revisar_infoproducto.py`/`revisar_estilo.py` (contenido/estilo) | `engine.getCapabilities().pricing` (publica precios que nadie cobra) | MANTENER 3 niveles; **BORRAR el mapa `pricing` falso** |
| **Readiness** | `commercial-readiness.ts` (8 dimensiones, máquina de estados) | — | MANTENER |
| **Versionado** | `product-versioning.ts` (semver inmutable) | — | MANTENER |
| **Lote / multi-asset** | `batch-pipeline.executeBatch` + `buildLaunchBatch` (superconjunto: ads+secciones+mockups+logo+banner) | `generateLaunchPackage` del engine (subconjunto del mismo lote) | FUSIONAR: `/api/commercial/launch-pack` pasa a delegar en `buildLaunchBatch` |
| **Paquete de lanzamiento (datos)** | `_product-factory/launch-package.ts` (oferta, precio, FAQ, integridad) | colisión de nombre con engine | MANTENER + RENOMBRAR el método del engine en la fusión anterior |
| **Export ecommerce** | `commercial/ecom-export.ts` (payload 4 plataformas) | — | EXPONER ruta `/api/commercial/export` en FASE C; sigue NOT_VERIFIED (sin OAuth) |
| **Plantillas** | `template-gallery.ts` (18 estáticas) | — | MANTENER |
| **Edición NL** | `commercial/nl-editor.ts` | — | MANTENER |
| **Mockups / variantes** | engine (`generateMockup`, `generateVariantPack`) | — | MANTENER |
| **Validación de demanda** | plugin → `autocompletado.py`+`validar_demanda.py` (funciona: evidencia #4-5) | `src/lib/infoproductos/engine.ts` (duplicado muerto) | **BORRAR engine.ts** (352 ln); **ARREGLAR formatos.json** (generarlo en TS dentro del op) |
| **Archivo de negocio** | `archivo_negocio.py`+`guardar_en_archivo.py` — hoy **sin operación TS ni ruta** | — | EXPONER 2 ops del plugin en FASE B o marcar CLI-only (decisión del dueño) |
| **Guion** | `guion.py` — sin op dedicada | — | EXPONER op `generate-script` en el plugin |
| **Pipeline infoproductos** | `harness/infoproductos-plugin.ts` (vía bridge) | `infoproductos/engine.ts` | **BORRAR engine.ts** |
| **Entrega (handoff)** | `product-handoff.ts` (nunca finge SENT) | `GeneralAdapter.sendHandoff` stub (devuelve NOT_VERIFIED honesto) | MANTENER; conectar handoff del Factory como proveedor del stub |
| **Memoria/auditoría** | `general-adapter.ts` (Prisma real) | stubs de `KreaAdapter` (krea-agent) | FUSIONAR: KreaAdapter delega memoria en GeneralAdapter o en db |

**Código muerto confirmado a borrar en FASE C** (todos grep-verified sin consumidores): `src/lib/infoproductos/engine.ts` · `ProviderManager` (provider.interface.ts) · `agenteGeneralPythonBridge` (albra_seed inexistente) · declaración `HttpBridge` · mapa `pricing` del engine comercial · healthchecks stub del knowledge-registry (16 módulos que siempre dicen AVAILABLE).

## 4. Decisión Python con evidencia (punto FASE C.3)

**Evidencia ejecutada** (§2 #4-#7): el runtime Python está completo (3.12 + PIL + PyMuPDF + pypdf), pero **no hay Chrome**, y `render.py` —motor de PDF/PNG de 5 scripts (ebook, guion, portada, pagina_venta, revisar_estilo HTML)— falla sin él.

**Propuesta:** mantener Python como **dependencia explícita y opcional**, no implícita:
1. Los scripts **puros** (demanda, QA contenido, QA estilo-PDF, contraste, archivo) se mantienen: cubren capacidades que TS no tiene (heurísticas de revisión de contenido en español, WCAG, validación de demanda con autocomplete real).
2. Los scripts que **renderizan** quedan como variante "premium de marca" condicionada a Chrome; la vía canónica de render es siempre TS (`pdf-factory`).
3. `doctor-v2` añade checks: `python3 --version`, `PIL`, `PyMuPDF`, binario Chrome → reporta `AVAILABLE`/`DEGRADED` por capacidad, y `SKILL.md`/README documentan la dependencia.
4. El arnés **degrada con gracia**: si Chrome falta, las ops de render devuelven `NOT_VERIFIED` con motivo en vez de fallar en silencio (hoy el bridge solo hace ping a `python3 --version`).

## 5. Una sola vía (punto FASE C.1) — propuesta

1. **Único proveedor:** los 10 consumidores de `zai-sdk-bridge` (engine comercial, 5 generadores, krea-agent, general-adapter) migran a `getProvider("text"/"image"/"voice")`. El bridge queda interno a `zai.adapter.ts` o se borra. Se elimina `ProviderManager`.
2. **Único sistema de créditos:** extraer `deductCredits/refundCredits` a `src/lib/credit-service.ts` con tabla de costos por capacidad; las 12 rutas `/api/commercial/*`, `/api/harness execute-skill` y las rutas product re-cableadas cobran y reembolsan por el mismo servicio + registran `Generation`.
3. **Única puerta de entrada de generación:** `/api/generate/*` (usuario final) y `/api/commercial/*` + `/api/product/*` (pipeline) pasan todas por provider-registry + credit-service. El Product Factory deja de llamar ZAI directo (7 archivos) y usa el registry.
4. Los 7 archivos del Factory con ZAI directo se migran en FASE C tras la reintegración.

## 6. Plan de reintegración (FASE B, tras aprobación)

| Paso | Origen → Destino | Nota |
|---|---|---|
| 1 | `src/_product-factory/lib/*.ts` (20) → `src/lib/` | los imports rotos `./pdf-factory`/`./visual-qa` **se reparan solos** al convivir en `src/lib/` |
| 2 | `src/_product-factory/api-routes/*` (28) → `src/app/api/product/` | usan `@/` y `@/lib/...` → resuelven sin editar código |
| 3 | `components/ProductDashboard.tsx` → `src/components/app/` + entrada en AppShell | llama a `/api/product/*` que queda montado |
| 4 | `lib-tests/*` (12 archivos, **128 tests**) → `src/lib/__tests__/` | 203 + 128 = **331 ≥ 241** ✓ |
| 5 | Quitar exclusiones en `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts` | — |
| 6 | `scripts/golden-flow-{f,g,h}.ts` + `handoff-security-validation.ts` → `scripts/` | f/g compilan tras reintegración; **h necesita `product-validation-loop` (BORRADO)** → se justifica su retiro o se reimplementa mínimo |
| 7 | Los 2 `.bak` se **reparan contra la API actual** (funciones, no clases): `book-factory.test.ts.bak` reescrito sobre `book-factory` + `visual-qa` funcionales; `golden-flows.test.ts.bak` sobre `evaluateProductFit/makeProductDecision`, sin `product-intelligence`; envueltos en `describe/it` | no se borra ninguno; cada prueba sin sentido se justifica una a una en el informe |
| 8 | Reconectar knowledge-registry (16 → ~24 módulos) y arnés con el pipeline unificado | — |
| 9 | Prisma: **cero migraciones destructivas**, los 10 modelos ya existen | — |

## 7. Lo que NO está resuelto y se decide con el dueño

1. **¿Archivo de negocio y guion** se exponen como operaciones del plugin (FASE B.3) o quedan CLI-only documentado?
2. **`golden-flow-h.ts`** (validación iterativa): ¿se reimplementa `product-validation-loop` mínimo o el flujo se retira con justificación?
3. **Python render**: ¿aceptas la propuesta de §4 (Python opcional + doctor + degradación con gracia, canónica TS)?
4. **Fusión launch-pack → batch** y renombrado `AdFormat "banner"` → `"display-banner"`: ¿aprobado?
5. Los 15 archivos con cambio de modo (ruido del sandbox) se normalizan a 644 en el commit de FASE A.

---

**Fin de FASE A.** No se ha modificado ningún archivo de código. Esperando aprobación para proceder con FASE B (reintegración) según la tabla de §3 y el plan de §6, con los ajustes que marques en §7.
