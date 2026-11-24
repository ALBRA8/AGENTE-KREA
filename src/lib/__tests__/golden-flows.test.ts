/**
 * Golden Flows E2E (nivel módulo) — KREA V2
 *
 * Re-escrito desde golden-flows.test.ts.bak contra la API ACTUAL (funciones, no clases).
 * El .bak era un "documentation test" que importaba clases borradas (ProductFitEngine,
 * ProductDecisionEngine, ArtDirection, CoverDesign, EditorialDesign, VisualQA como clase,
 * ProductIntelligence) y en varios casos solo afirmaba propiedades de literales que el
 * propio test construía. Cada flujo de abajo ejercita funciones REALES del pipeline:
 *
 *   Flujo A: oportunidad → fit (quickFitCheck, puro) → decisión (makeProductDecision)
 *            + consistencia de umbrales GO/NO_GO/CONDITIONAL_GO
 *   Flujo B: especificación (fixture tipado) → handoff REAL con proveedor registrado
 *            (READY→SENT→ACKNOWLEDGED→COMPLETED) + invariantes de honestidad
 *            (sin proveedor disponible nunca finge SENT: queda READY + NOT_VERIFIED)
 *   Flujo C: pipeline puro del Product Factory: dossier (IDEA→…→PUBLISHED) → versión
 *            semver inmutable → readiness (8 dimensiones con QA real fixture) →
 *            paquete de lanzamiento → validación de integridad
 *   Flujo D: feedback real (submitFeedback → analyzeFeedback → resumen)
 *   Flujo E: fallo → trazabilidad → recuperación con factory-contract (in-memory,
 *            sin tocar datos reales; ExecutionTracer quedó fuera por escribir en Prisma)
 *
 * Retiros justificados del .bak, uno a uno (detalle en INFORME-ESTADO.md):
 *   1. Flow A (clases)      → reemplazado por API funcional real.
 *   2. Flow B (ArtDirection + selectConstructor) → selectConstructor no existe; su
 *      equivalente actual es el contrato de handoff con proveedor-neutral registry.
 *   3. Flow C (libros, literales) → sustituido por book-factory.test.ts (pipeline real
 *      con PDF y QA verdaderos) y aquí por la cadena dossier→versión→readiness→launch.
 *   4. Flow D (FeedbackSystem, nunca existió en el código) → implementado con
 *      commercial-feedback real.
 *   5. Flow E (ExecutionTracer sobre Prisma) → factory-contract para no tocar datos.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  quickFitCheck,
  type ProductOpportunityInput,
  type FitScore,
} from "@/lib/product-fit";
import { makeProductDecision, type ProductDecision } from "@/lib/product-decision";
import { createDossier, transitionDossier, attachFitScore, attachDecision } from "@/lib/product-dossier";
import {
  createProductVersion,
  publishVersion,
  getVersion,
  clearVersions,
} from "@/lib/product-versioning";
import {
  evaluateReadiness,
  transitionReadiness,
  type CommercialReadiness,
} from "@/lib/commercial-readiness";
import {
  generateLaunchPackage,
  validateLaunchPackage,
  getIntegrityIssues,
  type ProductDefinition,
} from "@/lib/launch-package";
import {
  createHandoff,
  markReady,
  sendHandoff,
  acknowledgeHandoff,
  completeHandoff,
  getHandoff,
  addApproval,
  registerHandoffProvider,
  clearHandoffs,
  type HandoffContract,
} from "@/lib/product-handoff";
import type { ProductSpecification, AcceptanceCriterion } from "@/lib/product-specification";
import type { ProductArchitecture } from "@/lib/product-architecture";
import type { Packaging } from "@/lib/product-qa";
import { submitFeedback, analyzeFeedback, getFeedbackSummary, clearFeedback } from "@/lib/commercial-feedback";
import {
  createFactoryContract,
  transitionFactoryStatus,
  addError,
  hasUnrecoverableErrors,
  clearContracts,
  type Blueprint as ContractBlueprint,
} from "@/lib/factory-contract";
import type { ProductQAReport, QACategoryResult, QACheck } from "@/lib/product-qa";

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeOpportunity(): ProductOpportunityInput {
  return {
    title: "Playbook de Crecimiento para PYMES",
    description:
      "Guía práctica con frameworks de crecimiento validados para pequeñas empresas que no pueden pagar consultores.",
    targetAudience: "dueños de PYMES en LATAM",
    domain: "guide",
    problemStatement:
      "Las PYMES escalan por intuición, sin frameworks accesibles ni ejemplos de su tamaño de empresa.",
    existingAlternatives: ["consultoría cara", "cursos genéricos enterprise"],
  };
}

function makeFit(overall: number, dims = overall): FitScore {
  return {
    overall,
    marketExistence: dims,
    audienceClarity: dims,
    problemValidity: dims,
    differentiation: dims,
    feasibility: dims,
    evidence: "ESTIMATED",
    reasoning: "fixture de prueba",
    recommendation: overall >= 0.7 ? "PROCEED" : overall >= 0.5 ? "EXPLORE" : "SKIP",
  };
}

function makeQACheck(name: string): QACheck {
  return { name, passed: true, score: 1, detail: "OK (fixture QA)", evidence: "VERIFIED" };
}

function makeQACategory(category: string): QACategoryResult {
  return { category, passed: true, score: 1, checks: [makeQACheck(category)], issues: [] };
}

function makeQAPassedReport(productId: string, version: string): ProductQAReport {
  return {
    reportId: `qa_${productId}_${version}`,
    productId,
    version,
    overallPassed: true,
    artifactQA: makeQACategory("artifact"),
    contentQA: makeQACategory("content"),
    structureQA: makeQACategory("structure"),
    visualQA: makeQACategory("visual"),
    commercialQA: makeQACategory("commercial"),
    deliveryQA: makeQACategory("delivery"),
    overallScore: 1,
    criticalIssues: [],
    warnings: [],
    evidence: "VERIFIED",
    inspectedAt: new Date(),
  };
}

function makeArchitecture(productType: ProductArchitecture["productType"] = "guide"): ProductArchitecture {
  return {
    productType,
    architecture: "Guía práctica en PDF con 5 capítulos y plantillas descargables",
    components: [
      {
        name: "Contenido",
        type: "content",
        description: "Capítulos con frameworks",
        dependencies: [],
      },
    ],
    dependencies: [],
    constraints: ["Sin testimonios inventados", "Sin datos de mercado sin fuente"],
    estimatedDuration: "3 días",
    technologyStack: ["markdown", "pdf-lib"],
    evidence: "ESTIMATED",
  };
}

function makeSpecification(productId: string): ProductSpecification {
  const criteria: AcceptanceCriterion[] = [
    {
      id: "ac-1",
      description: "PDF generado con 5 capítulos y sin páginas vacías",
      priority: "MUST",
      verificationMethod: "inspección con visual-qa",
      status: "PENDING",
    },
  ];
  return {
    productId,
    version: "1.0.0",
    architecture: makeArchitecture(),
    acceptanceCriteria: criteria,
    constraints: ["Markdown como fuente única"],
    evidence: "ESTIMATED",
  };
}

function makeFactoryBlueprint(productId: string): ContractBlueprint {
  return {
    blueprintId: "bp_golden_e",
    productId,
    productVersion: "1.0.0",
    productType: "guide",
  };
}

function makePackaging(): Packaging {
  return {
    deliveryFormat: "PDF",
    accessMethod: "Enlace de descarga",
    usageGuide: "Sigue los capítulos en orden",
    prerequisites: ["Lector de PDF"],
    supportInfo: "Soporte por email",
  };
}

afterEach(() => {
  clearVersions();
  clearHandoffs();
  clearFeedback();
  clearContracts();
  vi.restoreAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════
// Flujo A: oportunidad → fit → decisión (umbrales reales)
// ═════════════════════════════════════════════════════════════════════════

describe("Golden Flow A — oportunidad → fit → decisión", () => {
  it("quickFitCheck evalúa 5 dimensiones y la decisión respeta los umbrales documentados", () => {
    const opportunity = makeOpportunity();
    const fit = quickFitCheck(opportunity);

    expect(fit.overall).toBeGreaterThanOrEqual(0);
    expect(fit.overall).toBeLessThanOrEqual(1);
    for (const dim of [
      fit.marketExistence,
      fit.audienceClarity,
      fit.problemValidity,
      fit.differentiation,
      fit.feasibility,
    ]) {
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(1);
    }
    expect(fit.reasoning.length).toBeGreaterThan(0);

    const decision: ProductDecision = makeProductDecision(fit);
    expect(["GO", "NO_GO", "CONDITIONAL_GO"]).toContain(decision.decision);
    expect(decision.rationale.length).toBeGreaterThan(0);
    expect(decision.fitScore).toBe(fit);

    // Consistencia de umbrales: GO requiere overall>=0.7 y ninguna dimensión <0.4
    const dims = [
      fit.marketExistence,
      fit.audienceClarity,
      fit.problemValidity,
      fit.differentiation,
      fit.feasibility,
    ];
    if (decision.decision === "GO") {
      expect(fit.overall).toBeGreaterThanOrEqual(0.7);
      expect(Math.min(...dims)).toBeGreaterThanOrEqual(0.4);
    }
    if (decision.decision === "NO_GO") {
      expect(fit.overall).toBeLessThan(0.5);
    }
    if (decision.decision === "CONDITIONAL_GO") {
      expect(decision.conditions.length).toBeGreaterThan(0);
    }
  });

  it("umbrales exactos: 0.9 → GO, 0.6 → CONDITIONAL_GO con condiciones, 0.3 → NO_GO", () => {
    const go = makeProductDecision(makeFit(0.9, 0.85));
    expect(go.decision).toBe("GO");

    const conditional = makeProductDecision(makeFit(0.6));
    expect(conditional.decision).toBe("CONDITIONAL_GO");
    expect(conditional.conditions.length).toBeGreaterThan(0);

    const noGo = makeProductDecision(makeFit(0.3));
    expect(noGo.decision).toBe("NO_GO");
    expect(noGo.riskLevel).toBe("HIGH");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Flujo B: especificación → handoff (máquina de estados real)
// ═════════════════════════════════════════════════════════════════════════

describe("Golden Flow B — especificación → handoff con proveedor real", () => {
  it("sin proveedor disponible: nunca finge SENT — queda READY con evidencia NOT_VERIFIED", async () => {
    const contract: HandoffContract = createHandoff(makeSpecification("prod-handoff-b"), "proveedor-inexistente");
    expect(contract.status).toBe("CREATED");

    const ready = await markReady(contract.handoffId);
    expect(ready.status).toBe("READY");

    // Handoff SUPERVISED exige aprobación antes de enviar (invariante de seguridad)
    const approved = addApproval(ready.handoffId, "dueño", "APPROVED");

    const afterSend = await sendHandoff(approved.handoffId);
    expect(afterSend.status).toBe("READY"); // NO se promueve a SENT
    expect(afterSend.evidence.externalSend).toBe("NOT_VERIFIED");
  });

  it("con proveedor registrado: READY → SENT → ACKNOWLEDGED → COMPLETED", async () => {
    registerHandoffProvider({
      providerId: "constructor-mock",
      isAvailable: async () => true,
      send: async () => ({ success: true, providerRef: "ref-golden-001" }),
      checkStatus: async () => "ACKNOWLEDGED",
    });

    const contract = createHandoff(makeSpecification("prod-handoff-b2"), "constructor-mock", {
      objective: "Construir la guía",
      constraints: ["Sin contenido inventado"],
    });
    const ready = await markReady(contract.handoffId);
    const approved = addApproval(ready.handoffId, "dueño", "APPROVED");
    const sent = await sendHandoff(approved.handoffId);
    expect(sent.status).toBe("SENT");
    expect(sent.evidence.externalSend).toBe("VERIFIED");
    expect(sent.evidence.providerAvailability).toBe("VERIFIED");

    const ack = acknowledgeHandoff(sent.handoffId);
    expect(ack.status).toBe("ACKNOWLEDGED");

    const done = completeHandoff(ack.handoffId);
    expect(done.status).toBe("COMPLETED");
    expect(getHandoff(done.handoffId)?.status).toBe("COMPLETED");
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Flujo C: dossier → versión → readiness → paquete de lanzamiento
// ═════════════════════════════════════════════════════════════════════════

describe("Golden Flow C — ciclo de vida completo del producto (puro)", () => {
  it("IDEA→PUBLISHED con fit/decision adjuntos, versión semver inmutable y launch package válido", () => {
    // 1) Dossier desde la oportunidad
    const opportunity = makeOpportunity();
    let dossier = createDossier({
      userId: "user-golden",
      title: opportunity.title,
      description: opportunity.description,
      domain: opportunity.domain,
      opportunity,
    });
    expect(dossier.status).toBe("IDEA");

    // 2) Fit + decisión (reales) adjuntos al expediente
    const fit = quickFitCheck(opportunity);
    const decision = makeProductDecision(fit);
    dossier = attachFitScore(dossier.dossierId, fit);
    dossier = attachDecision(dossier.dossierId, decision);
    expect(dossier.fitScore).not.toBeNull();
    expect(dossier.decision).not.toBeNull();

    // 3) Transición por el ciclo de vida hasta PUBLISHED
    for (const [action, to] of [
      ["Investigación", "RESEARCHING"],
      ["Evaluación", "EVALUATING"],
      ["Decisión", "DECIDING"],
      ["Arquitectura", "ARCHITECTING"],
      ["Especificación", "SPECIFYING"],
      ["Producción", "PRODUCING"],
      ["QA", "QA"],
      ["Publicación", "PUBLISHED"],
    ] as const) {
      dossier = transitionDossier(dossier.dossierId, to, action);
    }
    expect(dossier.status).toBe("PUBLISHED");

    // 4) Versión semver inmutable: DRAFT → PUBLISHED; sobrescribir lanza error
    const version = createProductVersion(dossier.dossierId, "1.0.0", "bp_golden_c", dossier.dossierId);
    expect(version.status).toBe("DRAFT");
    expect(() => createProductVersion(dossier.dossierId, "1.0.0", "bp2", dossier.dossierId)).toThrow(
      /already exists/
    );
    const published = publishVersion(dossier.dossierId, "1.0.0");
    expect(published.status).toBe("PUBLISHED");
    expect(getVersion(dossier.dossierId, "1.0.0")?.status).toBe("PUBLISHED");

    // 5) Readiness con QA real (fixture VERIFIED) → READY_FOR_SALE
    // FASE 3.3: los requisitos críticos (artefacto producido + QA pasado) son
    // obligatorios — el flujo pasa los assets reales del pipeline.
    const qa = makeQAPassedReport(dossier.dossierId, "1.0.0");
    const assetsProduced = {
      artifactCount: 1,
      hasBlueprint: true,
      hasSpecification: true,
      hasEconomics: true,
      hasArchitecture: true,
    };
    let readiness: CommercialReadiness = evaluateReadiness(dossier.dossierId, "1.0.0", qa, undefined, undefined, assetsProduced);
    expect(readiness.blockers).toEqual([]);
    readiness = transitionReadiness(readiness, "READY_FOR_SALE");
    expect(readiness.state).toBe("READY_FOR_SALE");

    // 6) Paquete de lanzamiento + validación de integridad
    const productDef: ProductDefinition = {
      name: opportunity.title,
      type: "guide",
      description: opportunity.description,
      version: "1.0.0",
      targetCustomer: opportunity.targetAudience,
      painPoints: [opportunity.problemStatement],
      valueProposition: "Frameworks accionables con ejemplos de PYMES",
      differentiation: "Casos reales de LATAM",
      price: { amount: 29, currency: "USD", model: "one_time" },
    };
    const lp = generateLaunchPackage(productDef, makePackaging(), undefined, undefined, qa, readiness);
    const validation = validateLaunchPackage(lp);
    expect(validation.valid).toBe(true);
    expect(validation.issues).toEqual([]);
    expect(getIntegrityIssues(lp)).toEqual([]);
    expect(lp.product.version).toBe("1.0.0");
    expect(lp.price.amount).toBe(29);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Flujo D: feedback → análisis → resumen
// ═════════════════════════════════════════════════════════════════════════

describe("Golden Flow D — feedback → análisis → resumen", () => {
  it("clasifica feedback real y el resumen agrega por categoría", () => {
    const positive = submitFeedback("prod-flow-d", "1.0.0", "POSITIVE", "CONTENT", "Contenido claro y accionable", "user_review");
    const analyzed = analyzeFeedback(positive.feedbackId);
    expect(analyzed.analyzed).toBe(true);
    expect(analyzed.analysis?.sentiment).toBe("POSITIVE");

    const objection = submitFeedback("prod-flow-d", "1.0.0", "OBJECTION", "PRICE", "Es caro para lo que ofrece", "survey");
    const analyzedObjection = analyzeFeedback(objection.feedbackId);
    expect(analyzedObjection.analysis?.priority).toBe("HIGH");
    expect(analyzedObjection.analysis?.actionable).toBe(true);

    const summary = getFeedbackSummary("prod-flow-d");
    expect(summary.positive).toBeGreaterThanOrEqual(1);
    expect(summary.byCategory.PRICE).toBeGreaterThanOrEqual(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════
// Flujo E: fallo → trazabilidad → recuperación (factory-contract, in-memory)
// ═════════════════════════════════════════════════════════════════════════

describe("Golden Flow E — fallo → traza → recuperación", () => {
  it("transición inválida lanza; errores se acumulan con traza y el contrato no queda en estado mentiroso", () => {
    const contract = createFactoryContract("factory_e", "prod-flow-e", makeFactoryBlueprint("prod-flow-e"));
    expect(contract.status).toBe("CREATED");

    // Transición válida CREATED→QUEUED→RUNNING→QA; QA→FAILED es el camino real de fallo
    const queued = transitionFactoryStatus(contract, "QUEUED");
    const running = transitionFactoryStatus(queued, "RUNNING");
    const inQA = transitionFactoryStatus(running, "QA");

    // Transiciones inválidas (sin pasar por QA / PASSED) deben fallar
    expect(() => transitionFactoryStatus(queued, "COMPLETED")).toThrow(/Invalid transition/i);
    expect(() => transitionFactoryStatus(running, "COMPLETED")).toThrow(/Invalid transition/i);

    // Error no recuperable; la traza queda en el contrato (auditoría completa)
    let failed = transitionFactoryStatus(inQA, "FAILED");
    failed = addError(failed, "PDF_GENERATION", "PDF vacío", false);
    expect(hasUnrecoverableErrors(failed)).toBe(true);
    expect(failed.errors.some((e) => e.step === "PDF_GENERATION")).toBe(true);

    // Recuperación: FAILED→REPAIRING→RUNNING (camino documentado)
    const repairing = transitionFactoryStatus(failed, "REPAIRING");
    const backToRunning = transitionFactoryStatus(repairing, "RUNNING");
    expect(backToRunning.status).toBe("RUNNING");
  });
});
