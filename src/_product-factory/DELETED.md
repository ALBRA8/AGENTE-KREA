# Registro de borrados — FASE 4 cierre AGENTE-KREA

Módulos eliminados del repositorio tras verificar con `grep` que **nadie los
importa** (0 referencias en src/, scripts/, db/, prisma/):

| Módulo | Evidencia |
|--------|-----------|
| `src/lib/product-factory.ts` | 0 importadores (borrado en FASE 1). Reemplazado por `product-factory-orchestrator.ts`. |
| `src/lib/product-intelligence.ts` | 0 importadores. |
| `src/lib/product-validation-loop.ts` | 0 importadores. (Su único dependiente era `commercial-feedback.ts`, movido a `lib/`.) |
| `src/lib/cover-design.ts` | 0 importadores. |
| `src/lib/editorial-design.ts` | 0 importadores. |
| `src/lib/art-direction.ts` | 0 importadores tras borrar cover-design/editorial-design (sus únicos dependientes). |

Tests del pipeline antiguo retirados por referenciar APIs inexistentes en el
código actual (fallaban la recolección de vitest con `TypeError: VisualQA is
not a constructor`, `ProductFitEngine is not a constructor`, `createSession` inexistente):

| Test | Motivo | Respaldo |
|------|--------|----------|
| `book-factory.test.ts` | Clases `VisualQA`/`EditorialDesign.specify` ya no existen | archivado en `archived-tests/` |
| `golden-flows.test.ts` | `ProductFitEngine`/`ProductDecisionEngine` (API de clases) eliminados; hay equivalentes de funciones con tests activos | archivado en `archived-tests/` |
| `src/__tests__/security.test.ts` | Duplicado de `src/lib/__tests__/security.test.ts` (65 tests activos); "No test suite found" en vitest | borrado (documentación duplicada) |
| `src/__tests__/product-decision.test.ts` | Probaba API de clase `ProductDecisionEngine`; cubierto por `product-decision.test.ts` (API de funciones, movido con su módulo) | borrado |
| `src/__tests__/product-fit.test.ts` | Probaba API de clase `ProductFitEngine`; cobertura equivalente en tests de la API de funciones | borrado |

Los módulos con tests vivos **no** se borraron: se archivaron con sus tests en
`lib/` y `lib-tests/` (ver README.md).
