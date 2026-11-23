# AGENTE-KREA (KREA)

Fábrica unificada de producción: **activos creativos con IA** + **fábrica de productos infodigitales** + **arnés de infoproductos**, en un solo pipeline.

> Pipeline: oportunidad → decisión (GO/NO-GO) → especificación → producción → QA → preparación comercial → entrega.

## Qué hace (resumen honesto)

| Capa | Capacidad | Entrada HTTP | Estado |
|---|---|---|---|
| Creativa | prompts, imágenes, texto, voz, subtítulos, eBooks PDF | `/api/generate/*` | VERIFIED (créditos atómicos + reembolso) |
| Creativa | logos, banners, email, catálogos, ads, landings, mockups, variantes, edición NL, plantillas, batch, launch-pack | `/api/commercial/*` | VERIFIED generación (créditos atómicos); export ecommerce con envío HTTP real (Shopify/WooCommerce/TiendaNube, credenciales por env vars — verificado contra loopback; productivo requiere credenciales del dueño) |
| Producto | pipeline completo del Product Factory | `/api/product/*` | VERIFIED en módulos y e2e de script (ver INFORME-ESTADO); produce/factory-execute ejecutan la fábrica vía HTTP síncrona (P6, evidencia en INFORME-ESTADO §3.2) |
| Arnés | validación demanda, revisión contenido/estilo, archivo de negocio, guion, ensamble | `/api/harness` (execute-skill) | VERIFIED ops puras; render Python NOT_VERIFIED sin Chrome (degrada con motivo) |

Detalles, evidencia y pendientes: **[INFORME-ESTADO.md](./INFORME-ESTADO.md)**.

## Arquitectura en una frase

- **Una sola vía de proveedor:** todo pasa por `src/contracts/provider-registry.ts` → adapters (`zai.adapter.ts`) → `z-ai-web-dev-sdk`. Los motores del Factory usan `src/lib/ai-gateway.ts` (fachada sobre el registry). Ningún módulo instancia el SDK directamente.
- **Un solo sistema de créditos:** `src/lib/credit-service.ts` — deducción atómica (`updateMany` con `credits >= amount`) + reembolso en fallo, en `/api/generate/*`, `/api/commercial/*`, `/api/harness execute-skill` y `/api/product/*` (operaciones que llaman al proveedor IA).
- **Un solo pipeline de producto:** `src/lib/product-factory-orchestrator.ts` + módulos en `src/lib/` (dossier, fit, decision, architecture, specification, economics, book-factory, qa, packaging, readiness, launch-package, handoff, versioning), rutas en `src/app/api/product/*`, UI en `src/components/app/ProductDashboard.tsx`.
- **Python explícito y opcional:** `src/lib/infoproductos/scripts/*.py` vía `PythonBridge`. Sin Chrome, las 4 capacidades de render devuelven `NOT_VERIFIED` con motivo; la vía canónica de PDF/portada es TypeScript (`pdf-factory`). Doctor: check `python-environment`.

## Tabla de costos (créditos)

Referencia del dueño: **1 crédito ≈ 1 generación simple**. Fuente única: `CREDIT_COSTS` en `src/lib/credit-service.ts` (el doctor la muestra en el check `credit_costs`; un test verifica que esta tabla y el código no divergen).

| Puerta | Operación | Créditos | Llamadas al proveedor |
|---|---|---:|---|
| `/api/generate/*` | prompt · text · subtitle | 2 | 1 texto |
| `/api/generate/*` | image · voice | 3 | 1 imagen / 1 TTS |
| `/api/generate/ebook` | ebook rápido | 8 | texto multi-capítulo + PDF |
| `/api/commercial/*` | logo · banner · catalog · mockup · edit | 3 | 1 imagen |
| `/api/commercial/*` | email · ad · landing · variants | 2 | 1 texto/imagen |
| `/api/commercial/*` | batch · launch-pack | 5 | lote (varias) |
| `/api/commercial/export` | export ecommerce (prepared) | 1 | 0 (payload) |
| `/api/product/fit` | evaluar fit de oportunidad | 2 | 1 texto (LLM) |
| `/api/product/architect` | diseñar arquitectura | 2 | 1 texto (LLM) |
| `/api/product/economics` | análisis económico | 2 | 1 texto (LLM) |
| `/api/product/specify` | especificación del producto | 2 | 1 texto (LLM) |
| `/api/product/produce` | producir dossier (fábrica completa) | 12 | 10 pasos: texto multi-capítulo + portada IA + PDF |
| `/api/product/factory/execute` | misma fábrica por executionId | 12 | ídem |
| `/api/harness` execute-skill | validate-demand · review-* · generate-* | 2–3 | según op (ver `CREDIT_COSTS`) |
| `/api/harness` execute-skill | assemble-infoproduct | 8 | pipeline Python |

**Regla de reembolso:** si el proveedor falla o el motor cae a su fallback sin LLM (evidence `NOT_VERIFIED` en fit/architect/specify, `ESTIMATED`-heurístico en economics), la ruta **reembolsa automáticamente** y lo marca con `refunded: true` en la respuesta. Las rutas que no llaman al proveedor (decide, commercial, offer, qa, packaging, readiness, versions, handoff, launch-package, feedback) **no cobran**.

## Requisitos

- Node.js + npm (gestor único; `package-lock.json`).
- `DATABASE_URL` (SQLite) en `.env` — ver `.env.example`.
- **Opcional (arnés de infoproductos):** `python3` >= 3.9, `PIL` (Pillow), `PyMuPDF`, `pypdf`; `Chrome/Chromium/Edge` SOLO para render Python de marca. Sin ellos el sistema no se rompe: el doctor reporta `DEGRADED` con motivo.
- Credenciales del proveedor de IA: `z-ai-web-dev-sdk` (el SDK resuelve credenciales del entorno; no se declara `ZAI_API_KEY` explícita en el repo).

## Comandos

```bash
npm install          # postinstall: prisma generate
npx prisma db push   # crea/actualiza el esquema SQLite (no destructivo si ya coincide)
npm run dev          # dev server :3000
npm run build        # prisma generate + next build
npm test             # vitest (372 tests)
npm run lint         # eslint
npm run smoke:providers
DATABASE_URL=file:./prisma/dev.db npx tsx scripts/e2e-mission-flow.ts   # flujo e2e real de misión
```

## Estructura

```
src/
  app/api/generate/     prompts, image, text, voice, ebook, subtitle (créditos)
  app/api/commercial/   logo, banner, email, catalog, ad, landing, mockup,
                        variants, edit, batch, launch-pack, templates, export (créditos)
  app/api/product/      opportunities, dossiers, fit, decide, architect, specify,
                        economics, blueprint, produce, factory/execute, qa, packaging,
                        offer, commercial, readiness, handoff, launch-package,
                        feedback, versions, assets
  app/api/harness/      arnés: execute-skill (créditos por op)
  contracts/            provider-registry (única vía) + agent.mission/identity.json
  lib/
    commercial/           generadores creativos + batch + ecom-export + krea-agent
    commercial-creative-engine.ts
    credit-service.ts     costos + cobro atómico + reembolso
    ai-gateway.ts         fachada única para los motores del Factory
    book-factory.ts       pipeline de 10 pasos (LLM+imagen+PDF+QA reales)
    product-*.ts          pipeline de producto (dossier→…→handoff/versioning)
    krea-harness.ts       arnés (adapters, skills, bridges, knowledge)
    harness/              infoproductos-plugin + knowledge-registry
    infoproductos/        engine scripts Python + SKILL.md
    bridges/              python-bridge (el puente ZAI ya no existe: es el registry)
```
