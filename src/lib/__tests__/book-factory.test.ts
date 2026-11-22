// @vitest-environment node
/**
 * Book Factory Pipeline Tests — KREA V2
 *
 * Re-escrito desde book-factory.test.ts.bak contra la API ACTUAL (funciones, no clases).
 * El .bak probaba las clases ArtDirection / CoverDesign / EditorialDesign (borradas en la
 * ronda de limpieza anterior con grep verificado) y un VisualQA basado en clases. Esta
 * suite prueba el pipeline real de 10 pasos de src/lib/book-factory.ts con el LLM simulado
 * (vi.mock) pero PDF, portada en disco, QA y reparación REALES.
 *
 * Correspondencia con los AC del .bak (justificación de retiros en INFORME-ESTADO.md):
 *   - AC-033..039 (art/cover/editorial como clases) → RETIRADOS: clases eliminadas; el
 *     reemplazo funcional es stepArtDirection (merge acotado), stepCoverDesign (imagen real
 *     + verificación en disco) y stepLayout (PdfConfig desde BookStyle) — probados aquí.
 *   - AC-043/044 (QA no puede aprobar solo porque el renderer terminó; issues con estructura)
 *     → MANTENIDOS: el pipeline ejecuta runVisualQA REAL sobre el PDF generado.
 *   - AC-045 (loop de reparación acotado) → el diseño actual es de UN solo pase de reparación
 *     (acotado por construcción); se prueba que REPAIR queda en "skipped" cuando QA pasa.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  STEP_NAMES,
  createBookProject,
  getBookProject,
  runPipeline,
  type ProgressEvent,
} from "@/lib/book-factory";

// PNG 1x1 válido (para no depender de la red en la generación de portada)
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const tmpDir = "/tmp/krea-bookfactory-test";

// Debe fijarse ANTES de que el módulo pdf-factory evalúe DEFAULT_OUTPUT_DIR
vi.hoisted(() => {
  process.env.KREA_PDF_OUTPUT_DIR = "/tmp/krea-bookfactory-test";
});

const { chatCreate, imageCreate } = vi.hoisted(() => ({
  chatCreate: vi.fn(),
  imageCreate: vi.fn(),
}));

vi.mock("z-ai-web-dev-sdk", () => ({
  default: {
    create: vi.fn(async () => ({
      chat: { completions: { create: chatCreate } },
      images: { generations: { create: imageCreate } },
    })),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeChapters() {
  return [
    {
      index: 0,
      title: "Fundamentos",
      synopsis: "Por qué importa el tema",
      targetWords: 500,
    },
    {
      index: 1,
      title: "Aplicación práctica",
      synopsis: "Cómo aplicarlo paso a paso",
      targetWords: 500,
    },
  ];
}

/** Respuesta de chat según el paso: art direction devuelve estilo JSON; el resto, contenido. */
function mockChatSuccess() {
  chatCreate.mockImplementation(async ({ messages }: { messages: Array<{ role: string; content: string }> }) => {
    const sys = messages[0]?.content ?? "";
    if (sys.includes("art director")) {
      return {
        choices: [
          {
            message: {
              content:
                '{"colorScheme":"deep navy and amber","coverStyle":"bold","fontSize":12,"lineHeight":1.6}',
            },
          },
        ],
      };
    }
    return {
      choices: [
        {
          message: {
            content:
              "## Sección principal\n\n" +
              "Contenido de prueba para el capítulo con suficientes palabras para llenar páginas reales. ".repeat(
                30
              ),
          },
        },
      ],
    };
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("Book Factory — contrato del pipeline", () => {
  it("STEP_NAMES define exactamente 10 pasos en orden", () => {
    expect(STEP_NAMES).toHaveLength(10);
    expect(STEP_NAMES[0]).toBe("ARCHITECTURE");
    expect(STEP_NAMES[6]).toBe("PDF_GENERATION");
    expect(STEP_NAMES[8]).toBe("REPAIR");
    expect(STEP_NAMES[9]).toBe("FINAL");
  });

  it("createBookProject aplica estilos por defecto y estado PENDING", () => {
    const p = createBookProject({
      userId: "user-1",
      dossierId: "dossier-1",
      title: "Guía de prueba",
      author: "KREA",
      targetAudience: "emprendedores",
      chapters: makeChapters(),
    });
    expect(p.status).toBe("PENDING");
    expect(p.currentStep).toBe(0);
    expect(p.chapters).toHaveLength(2);
    expect(p.errors).toEqual([]);
    expect(p.style.fontSize).toBe(11);
    expect(p.style.fontFamily).toBe("Helvetica");
    expect(p.style.lineHeight).toBe(1.5);
    expect(p.style.marginSize).toBe(72);
    expect(p.style.colorScheme).toBe("professional");
    expect(p.style.coverStyle).toBe("modern");
  });

  it("createBookProject fusiona el estilo parcial sin pisar el resto y genera IDs únicos", () => {
    const a = createBookProject({
      userId: "user-1",
      dossierId: "dossier-1",
      title: "A",
      author: "KREA",
      targetAudience: "x",
      style: { fontSize: 13 },
    });
    const b = createBookProject({
      userId: "user-1",
      dossierId: "dossier-1",
      title: "B",
      author: "KREA",
      targetAudience: "x",
    });
    expect(a.style.fontSize).toBe(13);
    expect(a.style.fontFamily).toBe("Helvetica"); // resto intacto
    expect(a.projectId).not.toBe(b.projectId);
  });

  it("getBookProject devuelve el proyecto y undefined para IDs desconocidos", () => {
    const p = createBookProject({
      userId: "user-1",
      dossierId: "dossier-1",
      title: "C",
      author: "KREA",
      targetAudience: "x",
    });
    expect(getBookProject(p.projectId)?.title).toBe("C");
    expect(getBookProject("no-existe")).toBeUndefined();
  });
});

describe("Book Factory — pipeline completo (LLM simulado, PDF/QA reales)", () => {
  beforeAll(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("ejecuta los 10 pasos y produce PDF real + portada + metadata con QA", async () => {
    mockChatSuccess();
    imageCreate.mockResolvedValue({ data: [{ base64: TINY_PNG }] });

    const project = createBookProject({
      userId: "user-1",
      dossierId: "dossier-golden",
      title: "Guía Golden KREA",
      subtitle: "Prueba de pipeline",
      author: "KREA",
      targetAudience: "emprendedores digitales",
      chapters: makeChapters(),
    });

    const events: ProgressEvent[] = [];
    const result = await runPipeline(project.projectId, (e) => events.push(e));

    // Estado final
    expect(result.status).toBe("COMPLETED");
    expect(result.currentStep).toBe(10);
    expect(result.completedAt).toBeDefined();

    // PDF real en disco
    expect(result.artifacts.pdfPath).toBeTruthy();
    const pdfStat = await fs.stat(result.artifacts.pdfPath!);
    expect(pdfStat.size).toBeGreaterThan(0);

    // Portada real en disco
    expect(result.artifacts.coverImagePath).toBeTruthy();
    const coverStat = await fs.stat(result.artifacts.coverImagePath!);
    expect(coverStat.size).toBeGreaterThan(0);

    // Metadata con bloque QA real
    expect(result.artifacts.metadataPath).toBeTruthy();
    const metadata = JSON.parse(await fs.readFile(result.artifacts.metadataPath!, "utf-8"));
    expect(metadata.title).toBe("Guía Golden KREA");
    expect(metadata.qa.passed).toBe(true);
    expect(metadata.qa.checksCount).toBeGreaterThan(0);
    expect(metadata.qa.issuesCount).toBe(0);

    // Art direction (paso 3) fusionó la sugerencia simulada dentro de los rangos válidos
    expect(metadata.style.fontSize).toBe(12);
    expect(metadata.style.colorScheme).toBe("deep navy and amber");
    expect(metadata.style.coverStyle).toBe("bold");

    // Progreso: los 10 pasos reportaron "completed"; REPAIR quedó "skipped" (QA pasó)
    for (let step = 1; step <= 10; step++) {
      expect(
        events.some((e) => e.step === step && (e.status === "completed" || e.status === "skipped"))
      ).toBe(true);
    }
    const repairEvents = events.filter((e) => e.step === 9);
    expect(repairEvents.some((e) => e.status === "skipped")).toBe(true);
  });

  it("falla de forma honesta en el paso 1 si el LLM no responde (estado FAILED, error no recuperable)", async () => {
    chatCreate.mockRejectedValue(new Error("ZAI indisponible"));
    imageCreate.mockClear();

    const project = createBookProject({
      userId: "user-1",
      dossierId: "dossier-fail",
      title: "Libro que falla",
      author: "KREA",
      targetAudience: "x",
      // sin capítulos → stepArchitecture debe llamar al LLM
    });

    const events: ProgressEvent[] = [];
    const result = await runPipeline(project.projectId, (e) => events.push(e));

    expect(result.status).toBe("FAILED");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].step).toBe(1);
    expect(result.errors[0].stepName).toBe("ARCHITECTURE");
    expect(result.errors[0].recoverable).toBe(false);
    expect(result.errors[0].message).toContain("ZAI indisponible");
    expect(events.some((e) => e.status === "failed")).toBe(true);
  });

  it("fallo de portada es NO fatal: continúa sin portada y completa el PDF", async () => {
    mockChatSuccess();
    imageCreate.mockRejectedValue(new Error("generador de imágenes caído"));

    const project = createBookProject({
      userId: "user-1",
      dossierId: "dossier-nocover",
      title: "Libro sin portada",
      author: "KREA",
      targetAudience: "x",
      chapters: makeChapters(),
    });

    const result = await runPipeline(project.projectId);

    expect(result.status).toBe("COMPLETED");
    const coverError = result.errors.find((e) => e.step === 4);
    expect(coverError).toBeDefined();
    expect(coverError!.recoverable).toBe(true);
    expect(result.artifacts.coverImagePath).toBeUndefined();
    expect(result.artifacts.pdfPath).toBeTruthy();
    const stat = await fs.stat(result.artifacts.pdfPath!);
    expect(stat.size).toBeGreaterThan(0);
  });
});
