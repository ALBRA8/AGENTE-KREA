# INFORME-ESTADO — AGENTE-KREA (cierre, 2026-11-23)

**Base:** `f0b42ce` (FASE 1–4 de cierre + FASE A–F anteriores). Regla: nada se
marca VERIFIED sin prueba ejecutada y pegada; lo no probado es NOT_VERIFIED con
motivo. Historial detallado por fase: **[worklog.md](./worklog.md)** ·
Despliegue: **[DEPLOY.md](./DEPLOY.md)** · Costos de créditos: **README**.

## 1. Verificación final (clon limpio de `f0b42ce`) — SALIDA REAL

| Comando | Resultado |
|---|---|
| `npm install` | exit 0 |
| `npx prisma generate` | exit 0 (Prisma Client v6.12.0) |
| `npx prisma db push` | exit 0 (BD SQLite nueva creada) |
| `npx tsc --noEmit` | 0 errores |
| `npm run lint` | 0 errores |
| `npm test` | **30 archivos · 559/559 tests** (umbral del dueño ≥241: CUMPLE) |
| `npm run build` | exit 0 (70 rutas) |
| `npm run smoke:providers` | **3/3 VERIFIED** (text 413ms · image 31.5s 144KB · voice 1.2s) — credenciales implícitas, **sin `ZAI_API_KEY` explícita** |
| E2E misión (proveedor real) | **exit 0, 70.9s**: fit 0.79 PROCEED · GO · PDF 102.957 bytes con portada IA embebida (cover.jpg 95.443 bytes) · QA 9 checks · 1.0.0 publicada · READY_FOR_SALE · launch-package válido |

## 2. TABLA CAPACIDAD → ESTADO

| Capacidad | Estado | Evidencia |
|---|---|---|
| Proveedor IA (texto + imagen + voz) | VERIFIED | smoke:providers 3/3 en clon limpio (§1) |
| `/api/generate/*` (6 rutas) | VERIFIED | 559 tests (401/402/400/éxito/reembolso) + créditos atómicos |
| `/api/commercial/*` generación (12 rutas) | VERIFIED | smoke 13/13 con imagen IA real (worklog §3.2); gates 401 corregidos (worklog §F3) |
| Créditos en TODAS las puertas IA | VERIFIED | FASE 1: fit/architect/economics/specify/produce/factory-execute cobran atómico + reembolso (evidence NOT_VERIFIED/ESTIMATED → reembolso automático); 29+8 tests por ruta |
| Tabla de costos documentada | VERIFIED | README + check `credit_costs` del doctor (test de coherencia) |
| Producción async (202) | VERIFIED | FASE 2: produce/factory-execute responden 202 en 0.07s (real, p6-async) y completan en background (~515s); polling por GET existentes |
| Recuperación al reiniciar | VERIFIED | instrumentation → recoverStaleRuns: huérfano RUNNING real → FAILED + 12 créditos reembolsados en BD (worklog §F4) |
| Sin fuga de memoria | VERIFIED (limitado) | sonda RSS 159→168 MB tras ~45 requests (2 IA reales); riesgo previo documentado: 13 rutas pesadas de imagen en 1 proceso → OOM del entorno a 2GB |
| Auditoría de auth (58 rutas) | VERIFIED | suite recorre TODAS las rutas API: públicas por diseño → 200, resto → 401 (fix: 12 rutas comerciales validaban antes de autenticar) |
| Aislamiento entre usuarios | VERIFIED | dossiers/jobs/oportunidades/ejecuciones de otro usuario → 404 sin filtrar existencia; listados sin fugas |
| Secretos | VERIFIED | 0 hallazgos: 7 patrones × 81 commits + detect-secrets en 300 archivos (8 falsos positivos clasificados) |
| Token de GitHub expuesto en chat | **PENDIENTE de revocar por el dueño** | sigue ACTIVO a la fecha de cierre; nunca se escribió en el repo |
| Flujo UI real en navegador | VERIFIED con hallazgos | walk headless completo con capturas (worklog §F4): registro, imagen IA, oportunidad, producción 202, QA, launch; 4 bugs raíz de UI arreglados (AuthPage token, hidratación #418, switcher muerto, generadores con user.id) |
| Export ecommerce | VERIFIED en capa de envío | Shopify/WooCommerce/TiendaNube con credenciales por env vars; 3/3 en loopback real + smoke de ruta; **productivo requiere credenciales del dueño**; Funnelish sin API pública (honesto) |
| Edición NL (`/api/commercial/edit`) | VERIFIED | 28.6s vía `images.generations.edit` (worklog §3.2) |
| Arnés: validate-demand | VERIFIED (red real) | Google suggest vía producción completa 37.8s (worklog §3.2) |
| Arnés: render Python de marca | NOT_VERIFIED en este entorno | sin Chrome (doctor: `{"chrome": null}`); degradación honesta implementada |
| Launch section (UI) | NOT_VERIFIED (stub) | la sección siempre muestra vacío (`setPackages([])`); el paquete SÍ se crea y persiste por API (evidencia real `cmwso4qit…`) — pendiente de UI |
| Botones UI "crear dossier"/"evaluar fit" | NOT_VERIFIED (no existen) | el dashboard crea oportunidad pero no dossier/fit; se hace por API (documentado en el walk) |
| Deployment | VERIFIED (referencia) | DEPLOY.md con env vars, 2 volúmenes persistentes, cron de `cleanup:generated`, recuperación al arrancar; sin despliegue real a producción |
| Multi-usuario en cola de producción | NO_APLICABLE hoy | decisión síncrona-en-background single-process; cola como evolución futura si se requiere |

## 3. Pendientes reales

1. **Revocar el token de GitHub** expuesto en el chat (sigue activo; usar token nuevo o SSH para futuros pushes).
2. **Credenciales reales de tienda** (Shopify/Woo/TiendaNube) para pasar el export a VERIFIED-productivo (env vars ya documentadas).
3. **UI pendiente**: sección Launch es stub; faltan botones "crear dossier" y "evaluar fit" en el dashboard (ambos disponibles por API).
4. **Chrome en el entorno de despliegue** si se quiere el render Python de marca.
5. **Cola de producción** solo si se requiere multi-usuario intensivo (documentado en DEPLOY.md §6).
