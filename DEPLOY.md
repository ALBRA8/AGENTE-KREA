# DEPLOY.md — Despliegue de referencia (AGENTE-KREA)

Documento único de despliegue. Verificado contra lo que el código realmente usa
(`.env.example`, `prisma/schema.prisma`, `scripts/cleanup-generated.js`, doctor).

## 1. Requisitos

| Componente | Versión / detalle |
|---|---|
| Node.js | 20+ (desarrollado y verificado en Node 24) |
| npm | gestor único (`package-lock.json`; sin yarn/pnpm) |
| Python (opcional) | 3.9+ con `PIL` (Pillow), `PyMuPDF`, `pypdf` — SOLO para el arnés de infoproductos (`validate-demand` con Google real, revisores). Sin Python el resto del sistema funciona en vía TS canónica; el doctor lo reporta `DEGRADED` con motivo |
| Chrome/Chromium (opcional) | SOLO para el render Python de marca (portada/página de venta). Sin él, esas 4 capacidades devuelven `NOT_VERIFIED` con motivo |
| Credenciales IA | `z-ai-web-dev-sdk` resuelve credenciales del entorno (implícitas). `ZAI_API_KEY` explícita es opcional |

## 2. Variables de entorno (`.env`)

```bash
# Obligatoria — SQLite local; en despliegue usar ruta PERSISTENTE (ver §3)
DATABASE_URL="file:/var/data/krea/krea.db"

# Opcional — clave explícita del SDK (si falta, usa credenciales implícitas)
ZAI_API_KEY=""

# Opcional — modo demo (default false; true permite auto-login con contraseña efímera)
DEMO_MODE=false

# Opcional — CORS (coma separada; vacío = solo same-origin)
CORS_ORIGINS=""

# Opcionales — export ecommerce real (/api/commercial/export; ver .env.example completo)
# KREA_SHOPIFY_STORE / KREA_SHOPIFY_ADMIN_TOKEN
# KREA_WOOCOMMERCE_URL / KREA_WOOCOMMERCE_CONSUMER_KEY / KREA_WOOCOMMERCE_CONSUMER_SECRET
# KREA_TIENDANUBE_STORE_ID / KREA_TIENDANUBE_API_TOKEN
```

Nunca hacer commit de `.env` (`.gitignore` lo cubre). La tabla de costos de
créditos vive en código (`CREDIT_COSTS`) y no requiere variables.

## 3. Persistencia (2 volúmenes)

| Qué | Dónde | Por qué |
|---|---|---|
| Base de datos SQLite | `DATABASE_URL="file:/var/data/krea/krea.db"` (fuera del árbol de la app) | los usuarios, dossiers, ejecuciones y créditos son estado productivo |
| Archivos generados | `public/generated/` en volumen persistente (montaje) | PDFs, portadas, imágenes y audio servidos por Next desde ahí; `cleanup:generated` los poda |

Si la app corre en contenedor: montar el volumen en `public/generated` (o
cambiar la ruta generada si se desacopla el storage — hoy el código la resuelve
desde `process.cwd()/public/generated`).

## 4. Pasos de despliegue

```bash
git clone <repo> && cd agente-krea
npm install                      # postinstall: prisma generate
mkdir -p /var/data/krea public/generated
npx prisma db push               # crea/actualiza el esquema (no destructivo)
npx tsc --noEmit && npm run lint && npm test && npm run build   # gates
npm run start                    # servidor de producción :3000
```

## 5. Tareas programadas (cron del host o scheduler del contenedor)

```cron
# Poda de archivos generados con más de 7 días (ajustable en el script)
0 3 * * * cd /opt/krea && node scripts/cleanup-generated.js >> /var/log/krea-cleanup.log 2>&1
```

Verificación manual: `npm run cleanup:generated:dry` (simula sin borrar).
`smoke:providers` es de diagnóstico, no programado.

## 6. Comportamiento al arrancar / reiniciar

- `src/instrumentation.ts` ejecuta `recoverStaleRuns()`: toda `FactoryExecution`
  RUNNING/QUEUED y todo dossier `PRODUCING` huérfanos de un reinicio se marcan
  `FAILED` y se **reembolsan** los créditos cobrados (registrados en el contract
  de cada ejecución). Es idempotente — sin huérfanos no hace nada.
- `POST /api/product/produce` y `/api/product/factory/execute` responden **202**
  al instante y ejecutan la fábrica en segundo plano; el estado se consulta en
  `GET /api/product/produce/[id]` y `GET /api/product/factory/[executionId]`.

## 7. Verificación post-despliegue

```bash
curl -s http://localhost:3000/api/health                 # 200
curl -s http://localhost:3000/api/doctor | jq '.overallStatus'   # HEALTHY (o DEGRADED con motivo)
npm run smoke:providers                                  # disponibilidad del proveedor
DATABASE_URL=file:/var/data/krea/krea.db npx tsx scripts/e2e-mission-flow.ts   # E2E real (~70s)
```

## 8. Seguridad operativa

- Todas las rutas API no públicas responden 401 sin token (suite
  `security-route-audit.test.ts` — 58 rutas auditadas).
- Aislamiento por usuario verificado por suite (dossiers/ejecuciones de otro
  usuario → 404 sin filtrar existencia).
- Revocar cualquier token que haya circulado por chat; el repo no contiene
  secretos (0 hallazgos en 81 commits con 7 patrones + detect-secrets).
