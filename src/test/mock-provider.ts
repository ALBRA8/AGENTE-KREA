/**
 * Provider MOCK determinista para E2E de CI (FASE 0.5).
 *
 * NO es un mock de test que solo comprueba que el mock funciona (prohibición P1):
 * es el proveedor inyectado detrás del MISMO flujo de producción real
 * (ai-gateway → registry → provider) para que `npm run test:e2e` pueda correr
 * en CI sin red ni credenciales. Todo lo que depende del proveedor es
 * contenido determinista; el pipeline, la BD, el PDF y el QA son reales.
 *
 * Rutación: los prompts estructurados del repo nombran los campos esperados
 * ("Return your analysis as a JSON object with: marketExistence, ..."), por lo
 * que el mock devuelve el JSON del esquema correspondiente; para el resto,
 * prosa determinista multi-párrafo.
 */

import type {
  GenerationType,
  IGenerationProvider,
  ProviderConfig,
  ProviderResult,
} from "@/contracts/provider.interface";

/** PNG 1x1 válido en base64 (portada de libro en modo mock). */
export const TINY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const FIT_JSON = JSON.stringify({
  marketExistence: 0.8,
  audienceClarity: 0.8,
  problemValidity: 0.8,
  differentiation: 0.7,
  feasibility: 0.9,
  reasoning:
    "El mock determinista devuelve un análisis estructurado: la audiencia existe en el nicho declarado, el problema es recurrente y la solución es factible con el formato del producto.",
});

const ECONOMICS_JSON = JSON.stringify({
  developmentCost: 800,
  productionCost: 120,
  marketingCost: 250,
  pricePerUnit: 19,
  estimatedUnits: 200,
  riskFactors: [
    { risk: "Rotación de plataformas", probability: 0.3, impact: 0.4, mitigation: "Distribuir en dos canales" },
  ],
  timelineEstimate: "4 semanas",
});

const COMMERCIAL_JSON = JSON.stringify({
  jobToBeDone:
    "Cuando el vendedor necesita ordenar su catálogo y responder rápido en el chat, quiere plantillas y pasos concretos para no perder ventas.",
  desiredOutcome: "Responder el chat con claridad y cerrar más ventas por semana",
  valueProposition:
    "Un sistema paso a paso con plantillas listas para ordenar el catálogo y responder las cinco preguntas que más se repiten en el chat.",
  differentiation: "Plantillas de respuesta probadas en ventas reales por WhatsApp, no teoría genérica.",
  positioning: "El manual práctico para vender en el chat sin herramientas de pago.",
  keyBenefits: ["Catálogo ordenado en minutos", "Respuestas listas para copiar", "Cobro sin fricción"],
  objections: ["Ya tengo un sistema propio", "No vendo por chat"],
  targetCustomer: {
    description:
      "Pequeños vendedores que usan WhatsApp como canal principal y pierden ventas por respuestas desordenadas o tardías.",
    demographics: ["25-45 años", "comercio minorista", "LatAm"],
    psychographics: ["busca resultados rápidos", "poco tiempo para herramientas complejas"],
    painPoints: ["chat desordenado", "respuestas tardías", "cobros olvidados"],
    currentSolutions: ["notas del teléfono", "ninguna plantilla", "memoria"],
  },
});

function proseFor(prompt: string): string {
  const topic =
    /chapter|capítulo|sección/i.exec(prompt)?.[0] ?? "el tema solicitado";
  return [
    `Este apartado desarrolla con detalle ${topic}. El objetivo es que el lector aplique lo descrito el mismo día en que lo lee, sin herramientas adicionales y sin conocimientos previos.`,
    "El método se apoya en tres pasos que se repiten en cada caso: ordenar la información disponible, elegir la plantilla que corresponde a la situación y ejecutar la respuesta con los elementos mínimos que la venta necesita.",
    "Un ejemplo concreto aclara el patrón. Un vendedor con cuarenta productos recibe la misma pregunta diez veces al día; al ordenar el catálogo y responder con la plantilla de precio y disponibilidad, el tiempo de respuesta baja de minutos a segundos y la conversación avanza directo al cobro.",
    "Cierra este apartado una lista de verificación: revisar el catálogo, preparar las cinco respuestas base, definir el medio de cobro y registrar cada venta en el seguimiento semanal.",
    "Con la práctica semanal el sistema se estabiliza: las respuestas son más rápidas, el registro de ventas permite medir qué productos rotan y el catálogo se mantiene al día con un esfuerzo mínimo.",
  ].join("\n\n");
}

function textFor(messages: unknown): string {
  const arr = Array.isArray(messages) ? messages : [];
  const last = arr.length ? (arr[arr.length - 1] as { content?: string }) : undefined;
  const prompt = typeof last?.content === "string" ? last.content : "";
  if (/marketExistence|audienceClarity/.test(prompt)) return FIT_JSON;
  if (/developmentCost|pricePerUnit/.test(prompt)) return ECONOMICS_JSON;
  if (/jobToBeDone|valueProposition/.test(prompt)) return COMMERCIAL_JSON;
  return proseFor(prompt);
}

export function createDeterministicMockProvider(type: GenerationType): IGenerationProvider {
  const config: ProviderConfig = {
    id: `mock-${type}`,
    name: "Mock determinista (E2E CI)",
    type,
    priority: 0,
    enabled: true,
    maxRetries: 1,
    timeoutMs: 5_000,
  };
  return {
    config,
    async generate(params: Record<string, unknown>): Promise<ProviderResult> {
      const t0 = Date.now();
      let data: unknown;
      if (type === "text") {
        data = { content: textFor(params.messages) };
      } else if (type === "voice") {
        // RIFF/WAVE vacío de 44 bytes con header válido (no se decodifica audio en el flujo E2E)
        data = { base64: "UklGRiQAAABXQVZFZm10IBAAAAABAAEAwF0AAIC7AAACABAAZGF0YQAAAAA=" };
      } else {
        data = { base64: TINY_PNG_BASE64 };
      }
      return {
        success: true,
        data,
        providerId: config.id,
        cost: 0,
        latencyMs: Date.now() - t0 + 1,
        evidence: {
          truthLevel: "MODELED",
          model: "mock-determinista",
          timestamp: new Date().toISOString(),
        },
      };
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
    getCapabilities(): string[] {
      return [type];
    },
    estimateCost(): number {
      return 0;
    },
  };
}
