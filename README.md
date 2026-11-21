# AGENTE-KREA

**Fábrica de producción creativa con IA** del ecosistema ALBRA. Genera prompts,
imágenes, voz, texto, subtítulos, eBooks (con PDF real), logos, banners,
creatividades de email, catálogos y gestiona métricas de campaña, historial por
usuario y créditos con deducción atómica y reembolso.

Fuente de verdad de la misión: `src/contracts/agent.mission.json` y
`src/contracts/agent.identity.json`.

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript strict · Prisma + SQLite ·
Tailwind CSS 4 · z-ai-web-dev-sdk vía capa de proveedor propia · Vitest.

## Instalación

```bash
npm install          # gestor único: npm (no hay bun.lock)
npx prisma generate
npx prisma db push   # crea db/custom.db
cp .env.example .env # ajusta DATABASE_URL (y ZAI_API_KEY si tienes clave explícita)
```

Requisito: Node 18+ (usa la Web API Request/Response que Next 16 necesita).

## Ejecutar

```bash
npm run dev     # desarrollo en :3000
npm run build   # build de producción
npm run start   # servir el build
```

## Verificación completa (criterio de salida del proyecto)

```bash
npm install && npx prisma generate && npx prisma db push \
  && npx tsc --noEmit && npm run lint && npm test && npm run build
```

Todos los comandos deben terminar en 0 errores.

## Tests

```bash
npm test              # suite completa (unit + misión con proveedor mockeado)
npm run smoke:providers   # prueba REAL de texto/imagen/voz con evidencia (latencia, tamaños)
npm run cleanup:generated -- --dry-run  # política de limpieza de archivos generados
```

## Variables de entorno

| Variable | Obligatoria | Uso |
|----------|-------------|-----|
| `DATABASE_URL` | Sí | SQLite (`file:./db/custom.db`). En despliegues efímeros usa un volumen o storage persistente. |
| `ZAI_API_KEY` | No | Clave explícita del proveedor. Si falta y el SDK tiene credenciales implícitas, funciona con `implicit` (el doctor lo reporta). |
| `DEMO_MODE` | No | `true` habilita `/api/auth/auto-login` (por defecto **403 deshabilitado**). Solo para demos desechables. |
| `TRUST_PROXY` | No | `true` solo si hay proxy propio que sobreescribe `x-forwarded-for`; si no, el rate-limit usa un bucket no falsificable. |
| `CORS_ORIGINS` | No | Orígenes CORS permitidos separados por coma. |
| `GENERATED_RETENTION_DAYS` | No | Retención de archivos generados para `cleanup:generated` (default 30). |

## Arquitectura (una sola vía, sin código muerto)

```
Ruta /api/generate/*  →  contracts/provider-registry  →  IGenerationProvider
                      →  contracts/zai.adapter        →  z-ai-web-dev-sdk
```

- **Créditos**: `deductCredits` = un único `UPDATE ... WHERE credits >= amount`
  (atómico, sin carrera). `refundCredits` en TODOS los fallos de las 6 rutas.
- **Auth**: sesiones en DB (`Session`), contraseñas PBKDF2 (`lib/security.ts`).
- **Doctor**: `/api/doctor` (rápido, shallow) y `/api/adn/doctor` (15 checks
  profundos, estado real del proveedor incluida la fuente de credenciales).
- **Módulo archivado**: el Product Factory (pipeline product-brain antiguo,
  fuera de la misión) vive en `src/_product-factory/` con su documentación y
  sus tests — excluido de build/lint/tests. Ver `src/_product-factory/README.md`.

## Estructura

```
src/
  app/api/generate/    # misión: image, text, voice, prompt, subtitle, ebook
  app/api/commercial/  # creatividades: logo, banner, email, catalog, edit, batch, templates…
  app/api/metrics/     # métricas de campaña por usuario
  app/api/auth/        # login, register, me, auto-login (gated)
  app/api/health       # liveness
  app/api/adn/         # identidad, capacidades, doctor, observabilidad del agente
  contracts/           # misión, identidad, interfaz de proveedor, registry, adaptador
  lib/                 # auth, security, db, doctor, pdf-factory, commercial/, bridges…
  components/app/      # UI (AppShell, generadores, dashboard ADN)
  __tests__/           # tests de misión y aislamiento de datos
db/                   # SQLite (gitignored)
```
