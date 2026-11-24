# INFORME-AUDITORIA — AGENTE-KREA

> **Nota de reconstrucción (2026-11-24):** el informe original con 65 hallazgos
> **no estaba en el repo** (verificado: `ls INFORME-AUDITORIA.md` → no existe).
> Este archivo lo reconstruye desde las instrucciones de trabajo del dueño,
> numerando cada hallazgo (B1..Bn) en orden de aparición, con la verificación
> real (con evidencia de comando) y su estado: `CERRADO`,
> `DEGRADADO-HONESTO`, `NO APLICA` (con motivo) o `PENDIENTE`.
> Los hallazgos que resultaron falsos o desactualizados se marcan como
> `FALSO-DESACTUALIZADO` con la evidencia que lo contradice (regla R del
> encargo: "si un hallazgo es falso, dilo con evidencia y no lo arregles").

## Estado por hallazgo — FASE 0

| ID | Hallazgo (archivo:línea) | Verificación real | Estado |
|---|---|---|---|
| B1 | `prisma/migrations/20240101000000_init_product_models/migration.sql` crea solo 3/20 tablas y usa `ALTER TABLE ... ADD CONSTRAINT` (PostgreSQL) en SQLite | TRUE: 3 `CREATE TABLE`, líneas 71-80 con `ADD CONSTRAINT`; sin `migration_lock.toml` (`cat` → no existe) | **CERRADO** — baseline `0001_init` regenerada desde schema: 20 CREATE TABLE, `migrate deploy` desde cero → 20 tablas, `PRAGMA foreign_key_check` = 0 filas |
| B2 | `prisma migrate deploy` NUNCA podía construir el esquema | TRUE (consecuencia de B1) | **CERRADO** (ver B1) |
| B3 | `package.json:7` `db:push` siempre con `--accept-data-loss` | TRUE | **CERRADO** — `db:push` sin flag; destructivo en `db:push:force`; `db:backup` nuevo; DEPLOY.md §4.1 |
| B4 | `src/test/setup.ts` vacío; suites de BD usan la BD de desarrollo | TRUE (`setup.ts` solo importaba jest-dom) | **CERRADO** — BD de test `prisma/test.db` creada en global-setup; prueba por hash: `db/custom.db` byte-idéntica antes/después de la suite |
| B5 | `vitest.config.ts:9` jsdom global para suites de BD | TRUE | **CERRADO** — `environment: 'node'` por defecto, jsdom solo `**/*.test.tsx`, `fileParallelism: false`; suite completa 49.7s → 27.7s |
| B6 | Timeouts a 5s: `security-route-audit.test.ts:102` y `bootstrap.test.ts:59,72,81` | **FALSO-PARCIALMENTE**: línea base real 558/559 con UN solo timeout (`/doctor — GET`); los 3 de bootstrap NO se reproducían | **CERRADO** de todos modos — timeout de suite 20s en ambas + causa raíz real arreglada (B14) |
| B7 | `security-route-audit.test.ts:104,118`: dos `it()` con `return` temprano pasan sin afirmar | TRUE | **CERRADO** — `it.skipIf()` con análisis estático del route.ts; los no-ops ahora son skips declarados (59) |
| B8 | `security-route-audit.test.ts:98` afirma `>= 55` con 73 rutas | TRUE | **CERRADO** — igualdad exacta contra conteo independiente del filesystem |
| B9 | `book-factory.test.ts:44` escribe en `/tmp` hardcodeado (Windows → `D:\tmp`) | TRUE | **CERRADO** — base portable (`TMPDIR/TEMP`) + nombre único por corrida; también en `pdf-factory-cover.test.ts` |
| B10 | `scripts/ensure-db.js:29` siembra `demo@p360.com/demo123` en texto plano y fabrica tabla `_prisma_migrations` falsa | TRUE (código verificado antes de borrar; 0 referencias externas) | **CERRADO** — borrado; `prisma/seed.ts` nuevo que exige `DEMO_PASSWORD` (≥8), se niega en producción, hashea PBKDF2; `tsx` añadido como devDependency |
| B11 | No existe `.github/` — sin CI | TRUE | **CERRADO (contenido)** — `.github/workflows/ci.yml` con los 4 gates + e2e. Ejecución en Actions: **NOT_VERIFIED hasta el primer push** (mismos comandos verificados localmente) |
| B12 | `package.json:19` `test:e2e` imprime y `exit 0` (gate que no prueba nada) | TRUE | **CERRADO** — `scripts/e2e-ci.sh`: servidor producción `next start -p 3123` + `/api/health` + `e2e-mission-flow.ts` con `KREA_E2E_MOCK=1`; exit 0 real con fit 0.8→GO→PDF real→QA 9 checks→READY_FOR_SALE |
| B13 | — nuevo — `vitest` sin `tsx` devDependency aunque `db:seed` lo usa | TRUE | **CERRADO** — `npm install -D tsx` |
| B14 | — nuevo — `src/lib/doctor.ts:84` `fetch("http://localhost:3000/...")` SIN timeout: con un proceso sordo en :3000 el doctor cuelga indefinidamente | TRUE (reproducido: suite colgada >20s; doctor-v2.ts:813,1090 y mcp-server.ts:411,438 ya usaban `AbortSignal.timeout`) | **CERRADO** — `AbortSignal.timeout(5000)` en el fetch |

## Estado por hallazgo — FASE 1

| ID | Hallazgo (archivo:línea) | Verificación real | Estado |
|---|---|---|---|
| B15 | `src/middleware.ts:49-59` solo comprueba que EXISTE `Authorization` (`Authorization: x` pasa); `/api/bootstrap`, `/api/doctor`, `/api/harness` no validan en handler | TRUE (middleware leído completo; handlers sin auth verificados) | **CERRADO** — `requireSession()` compartido (`src/lib/require-session.ts`) valida el token contra la BD y está en bootstrap/doctor/harness GET+POST; el middleware ya NO pretende autenticar (solo CORS+headers). Aceptación: ciclo nuevo del audit — `Authorization: x` → 401 real en TODAS las no-públicas |
| B16 | `adn/memory` GET sin auth devuelve memorias de TODOS; DELETE invalida cualquier id sin dueño | TRUE | **CERRADO** — GET con sesión + `userId` en `recall()`; DELETE con propiedad (ajeno → 404) |
| B17 | `adn/execution`: `?userId=` del cliente | TRUE | **CERRADO** — el parámetro se ignora; siempre `user.id` |
| B18 | `adn/security/audit`: trail global legible | TRUE | **CERRADO** — lectura solo del propio usuario; lectura global exige rol admin que NO existe → documentado como degradación honesta |
| B19 | `adn/observability`: agrega ejecuciones de todos | TRUE | **CERRADO** — `getMetrics/getDashboard` con filtro `userId` opcional; la ruta pasa `user.id` |
| B20 | `adn/feedback` y `agent-comm` GET sin auth con datos ajenos | TRUE | **CERRADO** — auth + `userId` en ambos (FeedbackManager ya filtraba; AgentInteraction recibió columna `userId` aditiva, `sendRequest` la estampa) |
| B21 | `product/qa:24,47`: `artifactPath` del cliente → sonda de rutas | TRUE (`stat`/lectura antes de propiedad; lookup por `specification contains productId`) | **CERRADO** — propiedad por dossier `id+userId` (ajeno → 404); `artifactPath` solo dentro del storage root (400 fuera); canónico `assetId` de `ProductAsset` con userId. El QA ya no publica (hallazgo 3.4 se cierra en su fase) |
| B22 | `product/dossiers:39`: `opportunityId` ajeno | TRUE | **CERRADO** — `findFirst({id, userId})` → 404 |
| B23 | CORS refleja cualquier Origin con allowlist vacía | TRUE | **CERRADO** — condición invertida: solo se refleja si el origin está en `CORS_ORIGINS`; sin allowlist → deny |
| B24 | DEMO_MODE=true por defecto + VBS | PARCIALMENTE FALSO aquí: `.env.example` ya tenía `DEMO_MODE=false`; `INICIAR-KREA.vbs` NO existe en el repo | **CERRADO-NO-APLICA** — gate `DEMO_MODE !== "true"` verificado en auto-login |
| B25 | `verifyPassword` cae a texto plano para hashes no-`$pbkdf2$` y `timingSafeEqual` lanza → 500 con e.message (oráculo de enumeración) | TRUE | **CERRADO** — rama legacy eliminada; validación estricta (hex, longitud, iteraciones); malformado → `false` sin lanzar. Tests actualizados (el que codificaba el fallo como esperado, cambiado) |
| B26 | Registro: rate limit GLOBAL 5/min (bucket "direct") → 250 créditos/min de gasto | PARCIALMENTE TRUE: el bucket por IP existía pero colapsaba en "direct" sin proxy | **CERRADO** — `client-ip.ts` usa el ÚLTIMO salto de XFF (antes el PRIMERO, falsificable); tope del mapa de rate limits (10k→cleanup→20k clear); aceptación: 5 registros OK + 6.º 429 |
| B27 | Sesiones: token en texto plano, sin rotación, sin logout real | TRUE (`Session.token` guardaba el token crudo; el logout de UI solo borra localStorage) | **CERRADO** — BD guarda SHA-256 del token (`hashToken`); `POST /api/auth/logout` revoca; UI llama al endpoint; expiración 24h→8h. Aceptación: tras logout el token viejo → 401 |
| B28 | `canGenerate()` código muerto; nada limita generate/commercial | TRUE | **CERRADO** — `enforceCostRateLimit(userId, capability)` (12/min) ANTES del cobro en `chargeForCapability` y en las 6 rutas `/api/generate/*`; aceptación: 13.ª llamada → 429 sin cobro (saldo ≤24 gastado, nunca 25) |
| B29 | — nuevo — `AgentInteraction` sin columna `userId` | TRUE (el aislamiento de 1.2 era imposible sin ella) | **CERRADO** — columna aditiva (`prisma db push` no destructivo), filas históricas `null` |
