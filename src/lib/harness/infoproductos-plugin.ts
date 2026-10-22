/**
 * KREA ARNÉS — Infoproductos Skill Plugin
 *
 * El agente-infoproductos integrado como CONOCIMIENTO del arnés.
 * Implementa ISkillPlugin para registro formal.
 *
 * Los 7 pasos son el workflow que KREA ejecuta.
 * Los scripts Python son tools que KREA orquesta via PythonBridge.
 *
 * Si el agente cambia, KREA sigue sabiendo cómo crear infoproductos.
 */

import type { EvidenceTag } from "../agent-adapter";
import type {
  ISkillPlugin,
  SkillCategory,
  SkillContext,
  SkillHealth,
  SkillResult,
} from "./types";
import { PythonBridge } from "../bridges/python-bridge";
import path from "path";

// ─── Domain Types ──────────────────────────────────────────────────

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

// ─── InfoproductosPlugin ───────────────────────────────────────────

export class InfoproductosPlugin implements ISkillPlugin {
  readonly skillId = "infoproductos";
  readonly name = "Agente de Infoproductos";
  readonly version = "2.1.0";
  readonly category: SkillCategory = "infoproductos";
  readonly capabilities = [
    "recommend-format",
    "validate-demand",
    "build-index",
    "review-infoproduct",
    "generate-cover",
    "generate-sales-page",
    "assemble-infoproduct",
    "review-style",
  ];
  readonly dependencies: string[] = [];

  private _isReady = false;
  private pythonBridge: PythonBridge | null = null;
  private agentReason: SkillContext["agent"]["reason"] | null = null;

  get isReady(): boolean {
    return this._isReady;
  }

  async initialize(context: SkillContext): Promise<void> {
    this.agentReason = context.agent.reason;

    // Get or create Python bridge for infoproductos scripts
    const bridge = context.bridges.get("python-infoproductos") as PythonBridge | undefined;
    if (bridge) {
      this.pythonBridge = bridge;
    } else {
      // Create standalone bridge
      this.pythonBridge = new PythonBridge({
        id: "python-infoproductos",
        scriptsPath: path.join(process.cwd(), "src", "lib", "infoproductos", "scripts"),
        capabilities: this.capabilities,
      });
      await this.pythonBridge.initialize();
    }

    this._isReady = true;
  }

  async shutdown(): Promise<void> {
    this._isReady = false;
    this.pythonBridge = null;
    this.agentReason = null;
  }

  async healthCheck(): Promise<SkillHealth> {
    const start = Date.now();
    if (!this.pythonBridge) {
      return { status: "DOWN", details: "Python bridge not initialized", latencyMs: 0 };
    }
    const bridgeHealth = await this.pythonBridge.healthCheck();
    return {
      status: bridgeHealth.status === "CONNECTED" ? "READY" : bridgeHealth.status === "DEGRADED" ? "DEGRADED" : "DOWN",
      details: bridgeHealth.details,
      latencyMs: Date.now() - start,
    };
  }

  listOperations(): string[] {
    return this.capabilities;
  }

  async execute(operation: string, params: unknown): Promise<SkillResult> {
    const start = Date.now();

    try {
      switch (operation) {
        case "recommend-format":
          return this.recommendFormat(params as { profile: BusinessProfile });

        case "validate-demand":
          return await this.validateDemand(params as { topic: string; country: string; excludeTerms?: string[] });

        case "build-index":
          return this.buildIndex(params as { format: InfoproductFormat; questions: string[]; topic: string });

        case "review-infoproduct":
          return await this.reviewInfoproduct(params as { jsonPath: string });

        case "generate-cover":
          return await this.generateCover(params as { jsonPath: string; outputPath: string; backgroundImage?: string });

        case "generate-sales-page":
          return await this.generateSalesPage(params as { jsonPath: string; outputDir: string });

        case "assemble-infoproduct":
          return await this.assembleInfoproduct(params as { jsonPath: string; outputDir: string; backgroundImage?: string });

        case "review-style":
          return await this.reviewStyle(params as { filePath: string });

        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}. Available: ${this.capabilities.join(", ")}`,
            evidence: "NOT_VERIFIED" as EvidenceTag,
            latencyMs: Date.now() - start,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: `Infoproductos operation "${operation}" failed: ${error}`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    }
  }

  // ─── Paso 1: Elegir formato ──────────────────────────────────

  private recommendFormat(params: { profile: BusinessProfile }): SkillResult {
    const { profile } = params;

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

    return {
      success: true,
      data: { recommendation, reasoning, options },
      evidence: "VERIFIED" as EvidenceTag,
      latencyMs: 0,
    };
  }

  // ─── Paso 2: Validar demanda ─────────────────────────────────

  private async validateDemand(params: { topic: string; country: string; excludeTerms?: string[] }): Promise<SkillResult> {
    const start = Date.now();
    const { topic, country, excludeTerms = [] } = params;

    if (!this.pythonBridge?.isConnected) {
      return {
        success: false,
        data: {
          source: "NOT_VERIFIED — Python bridge unavailable",
          verdict: "adjust_topic",
          reasoning: "Python scripts not available. Cannot validate demand.",
          topics: [], questions: [], formatSignals: {}, competitors: [],
        },
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    }

    try {
      // Run autocompletado.py
      const searchResult = await this.pythonBridge.call({
        script: "autocompletado.py",
        args: [topic, "--pais", country, "--expandir", "--excluir", excludeTerms.join(", "), "--salida", "busquedas.json"],
      });

      // Run validar_demanda.py
      const validationResult = await this.pythonBridge.call({
        script: "validar_demanda.py",
        args: ["busquedas.json", "formatos.json", "--salida", "demanda"],
      });

      const validationOutput = (validationResult.data as any)?.stdout || "";
      const verdict = this.parseVerdict(validationOutput);

      return {
        success: true,
        data: {
          source: `autocompletado.py + validar_demanda.py, ${country}, ${new Date().toISOString().split("T")[0]}`,
          topics: [],
          questions: [],
          formatSignals: {},
          competitors: [],
          verdict,
          reasoning: validationOutput,
        },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        success: false,
        data: {
          source: "NOT_VERIFIED — scripts failed",
          verdict: "adjust_topic",
          reasoning: `Could not validate demand: ${error}. Proceed with caution.`,
          topics: [], questions: [], formatSignals: {}, competitors: [],
        },
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    }
  }

  // ─── Paso 3: Construir índice ────────────────────────────────

  private buildIndex(params: { format: InfoproductFormat; questions: string[]; topic: string }): SkillResult {
    const { format, questions, topic } = params;

    // KREA knowledge: how to structure an infoproduct index
    const chapters = questions.slice(0, 8).map((q, i) => ({
      title: `Capítulo ${i + 1}: ${q}`,
      resolves: q,
    }));

    chapters.unshift({ title: "Introducción", resolves: `Qué vas a lograr con este ${format}` });
    chapters.push({ title: "Tu próximo paso", resolves: "Qué hacer después de leer" });

    return {
      success: true,
      data: { chapters },
      evidence: "VERIFIED" as EvidenceTag,
      latencyMs: 0,
    };
  }

  // ─── Paso 4: Review ──────────────────────────────────────────

  private async reviewInfoproduct(params: { jsonPath: string }): Promise<SkillResult> {
    const start = Date.now();
    if (!this.pythonBridge?.isConnected) {
      return { success: false, error: "Python bridge unavailable", evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
    try {
      const result = await this.pythonBridge.call({ script: "revisar_infoproducto.py", args: [params.jsonPath] });
      const output = (result.data as any)?.stdout || "";
      return { success: true, data: this.parseReviewResults(output), evidence: "VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, error: String(error), evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
  }

  // ─── Paso 5: Portada ─────────────────────────────────────────

  private async generateCover(params: { jsonPath: string; outputPath: string; backgroundImage?: string }): Promise<SkillResult> {
    const start = Date.now();
    if (!this.pythonBridge?.isConnected) {
      return { success: false, error: "Python bridge unavailable", evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
    try {
      const args = [params.jsonPath, params.outputPath];
      if (params.backgroundImage) args.push("--imagen", params.backgroundImage);
      await this.pythonBridge.call({ script: "portada.py", args });
      return {
        success: true,
        data: { path: params.outputPath, costUsd: params.backgroundImage ? 0.25 : 0, evidence: "VERIFIED" },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return { success: false, error: String(error), evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
  }

  // ─── Paso 6: Página de venta ─────────────────────────────────

  private async generateSalesPage(params: { jsonPath: string; outputDir: string }): Promise<SkillResult> {
    const start = Date.now();
    if (!this.pythonBridge?.isConnected) {
      return { success: false, error: "Python bridge unavailable", evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
    try {
      await this.pythonBridge.call({ script: "pagina_venta.py", args: [params.jsonPath, params.outputDir] });
      return {
        success: true,
        data: { path: path.join(params.outputDir, "pagina-de-venta.html") },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return { success: false, error: String(error), evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
  }

  // ─── Paso 7: Ensamblar ──────────────────────────────────────

  private async assembleInfoproduct(params: { jsonPath: string; outputDir: string; backgroundImage?: string }): Promise<SkillResult> {
    const start = Date.now();
    if (!this.pythonBridge?.isConnected) {
      return { success: false, error: "Python bridge unavailable", evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
    try {
      // Step 1: Review
      const reviewResult = await this.pythonBridge.call({
        script: "armar_infoproducto.py",
        args: [params.jsonPath, params.outputDir, "--revisar"],
      });
      const reviewOutput = (reviewResult.data as any)?.stdout || "";
      const reviewErrors = this.parseReviewResults(reviewOutput).errors;

      if (reviewErrors.length > 0) {
        return {
          success: false,
          data: { reviewErrors },
          error: "Review found errors",
          evidence: "NOT_VERIFIED" as EvidenceTag,
          latencyMs: Date.now() - start,
        };
      }

      // Step 2: Assemble
      const assembleArgs = [params.jsonPath, params.outputDir];
      if (params.backgroundImage) assembleArgs.push("--imagen", params.backgroundImage);
      await this.pythonBridge.call({ script: "armar_infoproducto.py", args: assembleArgs });

      return {
        success: true,
        data: {
          ebookPath: path.join(params.outputDir, "ebook.pdf"),
          printPath: path.join(params.outputDir, "ebook-para-imprimir.pdf"),
          coverPath: path.join(params.outputDir, "portada.jpg"),
          salesPagePath: path.join(params.outputDir, "pagina-de-venta.html"),
          reviewErrors: [],
        },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return { success: false, error: String(error), evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
  }

  // ─── Estilo premium ──────────────────────────────────────────

  private async reviewStyle(params: { filePath: string }): Promise<SkillResult> {
    const start = Date.now();
    if (!this.pythonBridge?.isConnected) {
      return { success: false, error: "Python bridge unavailable", evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
    try {
      const result = await this.pythonBridge.call({ script: "revisar_estilo.py", args: [params.filePath] });
      const output = (result.data as any)?.stdout || "";
      const parsed = this.parseReviewResults(output);
      return { success: true, data: parsed, evidence: "VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    } catch (error) {
      return { success: false, error: String(error), evidence: "NOT_VERIFIED" as EvidenceTag, latencyMs: Date.now() - start };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────

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
