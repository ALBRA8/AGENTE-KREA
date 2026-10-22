/**
 * KREA ARNÉS — Infoproductos Knowledge Module
 *
 * Integración de agente-infoproductos como CONOCIMIENTO del arnés.
 * Los scripts Python son tools que KREA orquesta.
 * Los 7 pasos son el workflow que KREA ejecuta.
 *
 * Esta no es una skill externa — es conocimiento de KREA.
 * Si el agente cambia, KREA sigue sabiendo cómo crear infoproductos.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { randomUUID } from "crypto";
import type { EvidenceTag } from "../agent-adapter";

const execFileAsync = promisify(execFile);

// ─── Config ────────────────────────────────────────────────────────

const INFOPRODUCTOS_PATH = process.env.INFOPRODUCTOS_PATH ||
  path.join(process.cwd(), "src", "lib", "infoproductos", "scripts");

const PYTHON = process.env.PYTHON_CMD || "python3";

// ─── Tipos del dominio infoproductos ───────────────────────────────

export type InfoproductFormat = "ebook" | "minicurso" | "webinar" | "podcast";

export interface BusinessProfile {
  name: string;
  author: string;
  city: string;
  country: string;
  whatTheySell: string;
  price: string;
  targetClient: string;
  colors?: { oscuro: string; claro: string; acento: string };
  fonts?: { titulos: string; texto: string };
}

export interface ValidationResults {
  source: string;
  topics: { query: string; volume: number; evidence: EvidenceTag }[];
  questions: string[];
  formatSignals: Record<string, number>;
  competitors: { name: string; price: string; link: string; evidence: EvidenceTag }[];
  verdict: "advance" | "adjust_topic" | "change_format";
  reasoning: string;
}

export interface InfoproductSpec {
  formato: InfoproductFormat;
  negocio: BusinessProfile;
  promesa: string;
  precio: string;
  siguientePaso: string;
  validacion?: ValidationResults;
  indice?: unknown;
  contenido?: unknown;
  portada?: { path: string; costUsd: number; approved: boolean };
  paginaVenta?: { path: string };
  ebook?: { path: string; printPath: string };
}

// ─── Los 7 elementos del infoproducto ──────────────────────────────

export const INFOPRODUCT_ELEMENTS = [
  { step: 1, name: "Formato de tu infoproducto", deliverable: "Comparación de formatos + recomendación" },
  { step: 2, name: "Validación con la demanda", deliverable: "Búsquedas reales + preguntas + veredicto" },
  { step: 3, name: "Índice", deliverable: "Estructura del infoproducto" },
  { step: 4, name: "Contenido del primer entregable", deliverable: "Capítulos/guion escrito" },
  { step: 5, name: "Portada", deliverable: "Imagen con marca del negocio" },
  { step: 6, name: "Página de venta corta", deliverable: "Copy + FAQs + CTA" },
  { step: 7, name: "Tu infoproducto listo", deliverable: "PDF + portada + página de venta" },
] as const;

// ─── InfoproductosEngine ───────────────────────────────────────────

export class InfoproductosEngine {
  private pythonCmd: string;
  private scriptsPath: string;

  constructor(config?: { pythonCmd?: string; scriptsPath?: string }) {
    this.pythonCmd = config?.pythonCmd || PYTHON;
    this.scriptsPath = config?.scriptsPath || INFOPRODUCTOS_PATH;
  }

  // ─── Paso 1: Elegir formato ──────────────────────────────────

  /**
   * Recomienda formato basado en perfil del negocio.
   * Lógica de KREA (no del agente) — es conocimiento del arnés.
   */
  recommendFormat(profile: BusinessProfile): {
    recommendation: InfoproductFormat;
    reasoning: string;
    options: { format: InfoproductFormat; pros: string; cons: string }[];
  } {
    const options: { format: InfoproductFormat; pros: string; cons: string }[] = [
      { format: "ebook", pros: "Se escribe una vez, atrae muy bien", cons: "No muestra técnicas con las manos" },
      { format: "minicurso", pros: "Se vende mejor, muestra el proceso", cons: "Requiere grabar y editar" },
      { format: "webinar", pros: "Atrae y vende en la misma sesión", cons: "Necesita fecha y audiencia" },
      { format: "podcast", pros: "Construye confianza de a poco", cons: "Resultados lentos, constancia requerida" },
    ];

    // Heurística del arnés (conocimiento KREA)
    let recommendation: InfoproductFormat = "ebook";
    let reasoning = "Por defecto: se escribe una vez y atrae correos.";

    if (profile.whatTheySell.toLowerCase().includes("curso") ||
        profile.whatTheySell.toLowerCase().includes("taller")) {
      recommendation = "minicurso";
      reasoning = "Ya vende formación: el minicurso complementa y lleva al producto principal.";
    }

    return { recommendation, reasoning, options };
  }

  // ─── Paso 2: Validar demanda ─────────────────────────────────

  /**
   * Ejecuta autocompletado.py + validar_demanda.py
   * Requiere el script Python disponible.
   */
  async validateDemand(
    topic: string,
    country: string,
    excludeTerms: string[] = [],
  ): Promise<ValidationResults> {
    try {
      // Run autocompletado.py
      const searchResults = await this.runScript("autocompletado.py", [
        topic,
        "--pais", country,
        "--expandir",
        "--excluir", excludeTerms.join(", "),
        "--salida", "busquedas.json",
      ]);

      // Run validar_demanda.py
      const validation = await this.runScript("validar_demanda.py", [
        "busquedas.json",
        "formatos.json",
        "--salida", "demanda",
      ]);

      return {
        source: `autocompletado.py + validar_demanda.py, ${country}, ${new Date().toISOString().split("T")[0]}`,
        topics: [], // Parsed from results
        questions: [],
        formatSignals: {},
        competitors: [],
        verdict: this.parseVerdict(validation),
        reasoning: validation,
      };
    } catch (error) {
      return {
        source: "NOT_VERIFIED — scripts unavailable",
        topics: [],
        questions: [],
        formatSignals: {},
        competitors: [],
        verdict: "adjust_topic",
        reasoning: `Could not validate demand: ${error}. Proceed with caution.`,
      };
    }
  }

  // ─── Paso 3: Construir índice ────────────────────────────────

  /**
   * Construye el índice del infoproducto.
   * Generado por KREA con ayuda del agente (LLM).
   */
  buildIndex(
    format: InfoproductFormat,
    questions: string[],
    topic: string,
  ): { chapters: { title: string; resolves: string }[] } {
    // KREA knowledge: how to structure an infoproduct index
    const chapters = questions.slice(0, 8).map((q, i) => ({
      title: `Capítulo ${i + 1}: ${q}`,
      resolves: q,
    }));

    // Add intro and closing (KREA knowledge)
    chapters.unshift({ title: "Introducción", resolves: `Qué vas a lograr con este ${format}` });
    chapters.push({ title: "Tu próximo paso", resolves: "Qué hacer después de leer" });

    return { chapters };
  }

  // ─── Paso 4: Generar contenido ───────────────────────────────

  /**
   * Revisa el infoproducto JSON con revisar_infoproducto.py
   */
  async reviewInfoproduct(jsonPath: string): Promise<{
    errors: string[];
    warnings: string[];
    ok: string[];
  }> {
    try {
      const result = await this.runScript("revisar_infoproducto.py", [jsonPath]);
      return this.parseReviewResults(result);
    } catch {
      return { errors: ["Review script unavailable"], warnings: [], ok: [] };
    }
  }

  // ─── Paso 5: Generar portada ─────────────────────────────────

  /**
   * Genera portada con portada.py
   */
  async generateCover(
    jsonPath: string,
    outputPath: string,
    backgroundImage?: string,
  ): Promise<{ path: string; costUsd: number; evidence: EvidenceTag }> {
    try {
      const args = [jsonPath, outputPath];
      if (backgroundImage) args.push("--imagen", backgroundImage);
      await this.runScript("portada.py", args);
      return { path: outputPath, costUsd: backgroundImage ? 0.25 : 0, evidence: "VERIFIED" };
    } catch {
      return { path: "", costUsd: 0, evidence: "NOT_VERIFIED" };
    }
  }

  // ─── Paso 6: Página de venta ─────────────────────────────────

  /**
   * Genera página de venta con pagina_venta.py
   */
  async generateSalesPage(jsonPath: string, outputDir: string): Promise<{ path: string; evidence: EvidenceTag }> {
    try {
      await this.runScript("pagina_venta.py", [jsonPath, outputDir]);
      return { path: path.join(outputDir, "pagina-de-venta.html"), evidence: "VERIFIED" };
    } catch {
      return { path: "", evidence: "NOT_VERIFIED" };
    }
  }

  // ─── Paso 7: Ensamblar infoproducto ──────────────────────────

  /**
   * Ensambla todo con armar_infoproducto.py
   * Entrega: PDF + portada + página de venta
   */
  async assembleInfoproduct(
    jsonPath: string,
    outputDir: string,
    backgroundImage?: string,
  ): Promise<{
    ebookPath: string;
    printPath: string;
    coverPath: string;
    salesPagePath: string;
    reviewErrors: string[];
    evidence: EvidenceTag;
  }> {
    try {
      // Step 1: Review
      const reviewArgs = [jsonPath, outputDir, "--revisar"];
      const reviewResult = await this.runScript("armar_infoproducto.py", reviewArgs);
      const reviewErrors = this.parseReviewResults(reviewResult).errors;

      if (reviewErrors.length > 0) {
        return {
          ebookPath: "", printPath: "", coverPath: "", salesPagePath: "",
          reviewErrors, evidence: "NOT_VERIFIED",
        };
      }

      // Step 2: Assemble
      const assembleArgs = [jsonPath, outputDir];
      if (backgroundImage) assembleArgs.push("--imagen", backgroundImage);
      await this.runScript("armar_infoproducto.py", assembleArgs);

      return {
        ebookPath: path.join(outputDir, "ebook.pdf"),
        printPath: path.join(outputDir, "ebook-para-imprimir.pdf"),
        coverPath: path.join(outputDir, "portada.jpg"),
        salesPagePath: path.join(outputDir, "pagina-de-venta.html"),
        reviewErrors: [],
        evidence: "VERIFIED",
      };
    } catch (error) {
      return {
        ebookPath: "", printPath: "", coverPath: "", salesPagePath: "",
        reviewErrors: [`Assembly failed: ${error}`], evidence: "NOT_VERIFIED",
      };
    }
  }

  // ─── Estilo premium ──────────────────────────────────────────

  /**
   * Revisa estilo con revisar_estilo.py
   */
  async reviewStyle(filePath: string): Promise<{
    errors: string[];
    warnings: string[];
    evidence: EvidenceTag;
  }> {
    try {
      const result = await this.runScript("revisar_estilo.py", [filePath]);
      const parsed = this.parseReviewResults(result);
      return { errors: parsed.errors, warnings: parsed.warnings, evidence: "VERIFIED" };
    } catch {
      return { errors: [], warnings: [], evidence: "NOT_VERIFIED" };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private async runScript(scriptName: string, args: string[]): Promise<string> {
    const scriptPath = path.join(this.scriptsPath, scriptName);
    const { stdout } = await execFileAsync(this.pythonCmd, [scriptPath, ...args], {
      timeout: 120000,
    });
    return stdout.trim();
  }

  private parseVerdict(output: string): "advance" | "adjust_topic" | "change_format" {
    const lower = output.toLowerCase();
    if (lower.includes("avanzar")) return "advance";
    if (lower.includes("cambiar formato")) return "change_format";
    return "adjust_topic";
  }

  private parseReviewResults(output: string): { errors: string[]; warnings: string[]; ok: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const ok: string[] = [];

    for (const line of output.split("\n")) {
      if (line.includes("ERROR")) errors.push(line);
      else if (line.includes("OJO")) warnings.push(line);
      else if (line.includes("OK")) ok.push(line);
    }

    return { errors, warnings, ok };
  }
}

// ─── Singleton ─────────────────────────────────────────────────────

export const infoproductosEngine = new InfoproductosEngine();
