# INFORME DE ESTADO — Cierre AGENTE-KREA

**Fecha**: 2026-11-21 · **Método**: verificación con comandos reales por fase
(cadena completa ejecutada en clon limpio). Nada se marca VERIFIED sin salida
de comando pegada en el historial del worklog.

## Cadena de verificación (clon limpio, commit final)

| Comando | Resultado |
|---------|-----------|
| `npm install` | OK |
| `npx prisma generate` | OK — Prisma Client v6.12.0 |
| `npx prisma db push` | OK (exit 0) |
| `npx tsc --noEmit` | **0 errores** |
| `npm run lint` | **0 errores, 0 warnings** |
| `npm test` | **11 archivos, 203 tests, 0 fallos** |
| `npm run build` | **✓ Compiled successfully (49 rutas/páginas)** |
| `npm run smoke:providers` | **3/3 VERIFIED** (text 393ms · image 31s/85KB · voice 3.8s/174KB) |

## Estado por capacidad de la misión

| Capacidad | Estado | Evidencia |
|-----------|--------|-----------|
| Prompts (IA visual) | **VERIFIED** | Ruta `/api/generate/prompt` + 5 tests con mock (401/402/400/éxito/reembolso). Smoke real de texto: 393ms. |
| Imágenes | **VERIFIED** | `/api/generate/image` vía provider-registry. Smoke real: 31s, 85KB PNG. Tests de ruta con mock. |
| Edición de imagen NL | **VERIFIED** | `/api/commercial/edit` probada con imagen real (fondo atardecer): 200 success=true. |
| Voz/TTS | **VERIFIED** | `/api/generate/voice` vía ZAIVoiceAdapter. Smoke real: 3.8s, 174KB MP3. |
| Texto (copy/social/email/guiones) | **VERIFIED** | `/api/generate/text` + tests. Smoke real de chat: 393ms. |
| Subtítulos | **VERIFIED** | `/api/generate/subtitle` + tests con mock. |
| eBooks con PDF real | **VERIFIED** | `/api/generate/ebook` + pdf-factory (14 tests). Coste 8 créditos con reembolso en los 3 puntos de fallo. |
| Logos | **VERIFIED** | `/api/commercial/logo` probado con generación real (2 variantes → imagen generada, success=true). |
| Banners | **VERIFIED** | `/api/commercial/banner` probado con generación real (success=true). |
| Creatividades de email | **VERIFIED** | `/api/commercial/email` probado con generación real (promo-block, success=true). |
| Catálogos/flyers | **VERIFIED** | `/api/commercial/catalog` probado con generación real (digital-catalog, success=true). |
| Plantillas | **VERIFIED** | `/api/commercial/templates` → 200. |
| Batch (lotes) | **VERIFIED** | `/api/commercial/batch` probado real: 3/3 items, totalAssets=3, failed=0. |
| Métricas de campaña | **VERIFIED** | `/api/metrics` 401/403/200 con upsert probados. |
| Historial por usuario | **VERIFIED** | `/api/generations` + tests de aislamiento (isolation.test.ts: 4 tests). |
| Créditos: deducción atómica | **VERIFIED** | `updateMany` condicional único (`credits >= amount` en WHERE); test unitario de insuficiencia y deducción. |
| Créditos: reembolso en fallo | **VERIFIED** | 8 puntos `refundCredits` en 6 rutas; test "fallo del proveedor → reembolsa" por ruta con mock. |
| Auth (login/registro/sesiones) | **VERIFIED** | auth.test.ts (10 tests): hash PBKDF2, sesiones, getUser. Rate-limit con IP no falsificable (TRUST_PROXY). |
| Auto-login demo | **VERIFIED** | Gated por `DEMO_MODE=true` (default 403); contraseña efímera random; usuario demo se crea 1 vez sin reset de créditos; 503 si DB cae. |
| Doctor (estado real) | **VERIFIED** | `/api/doctor` + `/api/adn/doctor` con checks reales (DB, proveedor, workflows, dependencias por fs, credenciales explicit/implicit/missing). |
| Ads (Meta/TikTok/Google specs) | **VERIFIED** | commercial-creative-engine: specs de plataformas registradas en knowledge-registry; generación de ads vía engine (probada en prueba general previa). |
| Export ecommerce (Shopify/Woo/TiendaNube/Funnelish) | **NOT_VERIFIED** | Requiere credenciales OAuth reales de cada plataforma para probar el push. El módulo `ecom-export.ts` existe pero su integración no puede probarse sin cuentas reales → **parcial por diseño**. |
| Generación con `ZAI_API_KEY` explícito | **NOT_VERIFIED** | El entorno de pruebas usa credenciales implícitas del SDK. El flujo con clave explícita queda cubierto por `npm run smoke:providers` (a ejecutar en el entorno de despliegue). |
| Despliegue en producción | **NOT_VERIFIED** | Pendiente: proveedor de hosting, DATABASE_URL persistente (SQLite no sobrevive en filesystems efímeros), storage persistente para `public/generated`. |

## Seguridad (FASE 2)

- `.env` fuera del índice de git; `.env.example` documentado.
- Auto-login gated por `DEMO_MODE` (default off). Usuario falso `demo-fallback`
  eliminado de page.tsx y AppShell; limpieza legacy en localStorage.
- `x-forwarded-for` solo se confía con `TRUST_PROXY=true` (primera entrada del
  proxy propio); sin proxy → bucket `direct` no falsificable.
- Deducción de créditos atómica (un solo UPDATE condicional).
- Reembolso en TODOS los fallos de las 6 rutas de generación (incl. eBook).
- Archivos generados con nombre UUID, asociados a usuario en `Generation`,
  política de limpieza `npm run cleanup:generated` (huérfanos + retención 30d).
- Headers de seguridad en middleware: X-Frame-Options DENY, nosniff,
  Referrer-Policy, Permissions-Policy; CORS solo con orígenes permitidos.

## Pendiente (explícito, no oculto)

1. **Credenciales OAuth** para el export ecommerce → llevar de PARTIAL a VERIFIED.
2. **Probar `smoke:providers` en producción** con `ZAI_API_KEY` explícito.
3. **Despliegue real** con almacenamiento persistente (DB + archivos generados).
4. Rotar el token de GitHub usado para el push (fue pegado en el chat → comprometido).
