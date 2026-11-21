# src/_product-factory/ — Módulo archivado (Product Factory / product-brain)

## Qué es

El **Product Factory** era el pipeline antiguo de KREA (v1 "product-brain"):
oportunidades de producto → dossier → arquitectura → especificación → economía
→ blueprint → packaging → producción → QA → versionado → handoff.

## Por qué está archivado

La misión de AGENTE-KREA (`src/contracts/agent.mission.json`) es **producción
creativa**: prompts, imágenes, voz/TTS, texto, subtítulos, eBooks, métricas de
campaña, historial por usuario y créditos con deducción/reembolso.

El Product Factory NO forma parte de esa misión y se movió aquí intacto para
que la app principal (UI y rutas de la misión) funcione sin él. **No se borró
nada**: módulos, tests y rutas API quedan en este directorio para una posible
reactivación futura.

## Contenido

| Carpeta | Contenido |
|---------|-----------|
| `lib/` | Módulos del pipeline (product-*.ts, commercial-*.ts, book-factory, factory-contract, launch-package, offer-architecture) |
| `lib-tests/` | Tests de vitest asociados (no se ejecutan: el dir está excluido) |
| `api-routes/` | Rutas API de `src/app/api/product/*` tal como estaban |
| `components/` | `ProductDashboard.tsx` |
| `archived-tests/` | Tests del pipeline antiguo que ya no compilan contra la API actual (`.bak`) |
| `DELETED.md` | Registro de los módulos SÍ borrados (sin importadores, verificado con grep) |

## Estado técnico

- Excluido de `tsconfig.json`, `eslint` y de la inclusión de vitest → **no
  compila, no se lintea, sus tests no se ejecutan**.
- Los modelos Prisma (ProductOpportunity, ProductDossier, …) permanecen en
  `prisma/schema.prisma` y sus datos intactos (no se tocan datos de usuario).
- La entrada `product-brain`/`product-factory` del knowledge-registry fue
  retirada del agente activo.

## Cómo reactivarlo (si algún día vuelve a la misión)

1. Mover `lib/*.ts` de vuelta a `src/lib/` y `api-routes/*` a `src/app/api/product/`.
2. Devolver `components/ProductDashboard.tsx` a `src/components/app/` y
   re-añadir sus entradas en el sidebar de `AppShell.tsx`.
3. Devolver los tests de `lib-tests/` a `src/lib/__tests__/`.
4. Quitar la exclusión de `src/_product-factory` de `tsconfig.json`,
   `eslint.config.mjs` y `vitest.config.ts`.
5. Re-añadir los módulos al `knowledge-registry.ts`.
6. Ejecutar la cadena completa: `npx tsc --noEmit && npm run lint && npm test && npm run build`.
