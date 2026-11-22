/**
 * AGENTE-KREA — Commercial Creative Factory Adapter
 *
 * El agente específico para producción comercial creativa.
 * Se monta en el arnés de KREA y ejecuta todas las capacidades
 * de generación de activos comerciales.
 *
 * Filosofía del arnés:
 *   "El agente es intercambiable (cajero).
 *    El conocimiento queda en KREA (caja registradora)."
 *
 * AGENTE-KREA es responsable de:
 *   - Generación de anuncios visuales (Meta, TikTok, Google Ads)
 *   - Secciones visuales de páginas de venta
 *   - Mockups, imágenes comerciales y recursos de marca
 *   - Logos profesionales
 *   - Banners (web, email, social, print)
 *   - Creativos de email marketing
 *   - Catálogos y flyers
 *   - Edición en lenguaje natural
 *   - Variantes creativas y paquetes de lanzamiento
 *   - Exportación a plataformas e-commerce
 *
 * NO absorbe funciones de investigación:
 *   ❌ Product Research
 *   ❌ Sales Angles Research
 *   ❌ Avatar Research
 *   ❌ Meta/Google/TikTok Ads Spy
 */

import {
  type AgentAdapter,
  type AgentIdentity,
  type AgentResponse,
  type MemoryRecord,
  type SecurityResult,
  type AuditEntry,
  type HandoffResult,
  type HealthStatus,
  type EvidenceTag,
  type ReasonOptions,
  type ImageOptions,
  type SpeechOptions,
  type MemoryMetadata,
} from "../agent-adapter";
import { getProvider, isProviderAvailable } from "@/contracts/provider-registry";
import { CommercialCreativeEngine } from "../commercial-creative-engine";
import { generateLogo } from "./logo-generator";
import { generateBanner } from "./banner-generator";
import { generateEmailCreative } from "./email-creative";
import { generateCatalog } from "./catalog-generator";
import { editCreativeWithNL } from "./nl-editor";
import { executeBatch, buildLaunchBatch } from "./batch-pipeline";
import { exportToEcom, getSupportedPlatforms } from "./ecom-export";
import {
  getTemplateGallery,
  getTemplatesByCategory,
  getTemplatesByType,
  searchTemplates,
  getTemplatePromptModifier,
} from "./template-gallery";
import type {
  LogoParams,
  BannerParams,
  EmailCreativeParams,
  CatalogParams,
  NLEditParams,
  BatchItem,
  EcomExportParams,
  TemplateCategory,
} from "./types";

// ─── AGENTE-KREA Identity ──────────────────────────────────────────

export const KREA_AGENT_IDENTITY = {
  id: "agente-krea",
  name: "AGENTE-KREA",
  role: "Fábrica de creativos comerciales",
  version: "1.0.0",
  description:
    "Genera activos comerciales listos para usar: anuncios, landing pages, mockups, logos, banners, email creativos, catálogos, y paquetes de lanzamiento completos.",
  capabilities: [
    "ad_generation",
    "landing_generation",
    "mockup_generation",
    "logo_generation",
    "banner_generation",
    "email_creative",
    "catalog_generation",
    "nl_editing",
    "variant_generation",
    "launch_packages",
    "batch_pipeline",
    "ecom_export",
    "template_gallery",
  ] as const,
  excludedCapabilities: [
    "product_research",
    "sales_angles_research",
    "avatar_research",
    "ads_spy",
  ] as const,
};

// ─── AGENTE-KREA Adapter ───────────────────────────────────────────

export class KreaAdapter implements AgentAdapter {
  readonly adapterName = "agente-krea";
  readonly name = "AGENTE-KREA";
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  async initialize(): Promise<void> {
    if (!(await isProviderAvailable("text"))) {
      console.warn("[KreaAdapter] Provider de texto no disponible al inicializar — continuando en modo degradado");
    }
    this._isConnected = true;
  }

  async shutdown(): Promise<void> {
    this._isConnected = false;
  }

  // ─── Identity ─────────────────────────────────────────────────

  getIdentity(): AgentIdentity {
    return {
      agentId: KREA_AGENT_IDENTITY.id,
      name: KREA_AGENT_IDENTITY.name,
      version: KREA_AGENT_IDENTITY.version,
      specialization: "commercial-creative-factory",
      capabilities: [...KREA_AGENT_IDENTITY.capabilities],
      autonomyLevel: "L3",
      riskProfile: "LOW",
      providers: ["zai-sdk"],
      memoryDomains: ["commercial", "creative", "production"],
    };
  }

  // ─── Cognition (LLM) ──────────────────────────────────────────

  async reason(prompt: string, options?: ReasonOptions): Promise<AgentResponse> {
    const start = Date.now();
    try {
      const result = await getProvider("text").generate({
        messages: [
          {
            role: "system",
            content:
              options?.systemPrompt ??
              "Eres AGENTE-KREA, la fábrica de creativos comerciales. Generas activos comerciales profesionales: anuncios, landing pages, mockups, logos, banners. Usas frameworks AIDA y PAS. Siempre produces contenido de calidad comercial listo para usar.",
          },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0.8,
        maxTokens: options?.maxTokens,
      });

      const data = (result.data as { content?: string; model?: string; tokensUsed?: { input: number; output: number } }) ?? undefined;
      return {
        content: data?.content ?? "",
        evidence: "INFERRED" as EvidenceTag,
        confidence: 0.85,
        provider: "zai",
        model: data?.model,
        tokensUsed: data?.tokensUsed,
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        content: "",
        evidence: "NOT_VERIFIED" as EvidenceTag,
        confidence: 0,
        provider: "zai",
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : "Reasoning failed",
      };
    }
  }

  async reasonStructured<T>(
    prompt: string,
    schema: unknown,
    options?: ReasonOptions
  ): Promise<AgentResponse & { structured: T }> {
    const base = await this.reason(
      `${prompt}\n\nReturn JSON matching this schema: ${JSON.stringify(schema)}`,
      options
    );
    try {
      const structured = JSON.parse(base.content) as T;
      return { ...base, structured };
    } catch {
      return { ...base, structured: { raw: base.content } as T };
    }
  }

  // ─── Generation ───────────────────────────────────────────────

  async generateImage(
    prompt: string,
    options?: ImageOptions
  ): Promise<AgentResponse & { imageUrl?: string; imageBase64?: string }> {
    const start = Date.now();
    try {
      const result = await getProvider("image").generate({
        prompt,
        size: options?.size,
      });
      const data = (result.data as { base64?: string; url?: string }) ?? undefined;
      return {
        content: "Image generated",
        imageUrl: data?.url,
        imageBase64: data?.base64,
        evidence: "VERIFIED" as EvidenceTag,
        confidence: 0.9,
        provider: "zai",
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        content: "",
        evidence: "NOT_VERIFIED" as EvidenceTag,
        confidence: 0,
        provider: "zai",
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : "Image generation failed",
      };
    }
  }

  async generateSpeech(
    text: string,
    options?: SpeechOptions
  ): Promise<AgentResponse & { audioUrl?: string; audioBase64?: string }> {
    const start = Date.now();
    try {
      const result = await getProvider("voice").generate({
        text,
        voice: options?.voice,
      });
      const audioBase64 = result.data
        ? Buffer.from((result.data as { arrayBuffer?: ArrayBuffer }).arrayBuffer as ArrayBuffer).toString("base64")
        : "";
      return {
        content: "Speech generated",
        audioBase64,
        evidence: "VERIFIED" as EvidenceTag,
        confidence: 0.9,
        provider: "zai",
        latencyMs: Date.now() - start,
      };
    } catch (e: unknown) {
      return {
        content: "",
        evidence: "NOT_VERIFIED" as EvidenceTag,
        confidence: 0,
        provider: "zai",
        latencyMs: Date.now() - start,
        error: e instanceof Error ? e.message : "Speech generation failed",
      };
    }
  }

  // ─── Memory ───────────────────────────────────────────────────

  async memoryWrite(
    domain: string,
    content: unknown,
    metadata?: MemoryMetadata
  ): Promise<{ id: string; evidence: EvidenceTag }> {
    // In production this would use the db
    return {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      evidence: "VERIFIED" as EvidenceTag,
    };
  }

  async memoryRead(
    domain: string,
    query?: string,
    limit?: number
  ): Promise<MemoryRecord[]> {
    return [];
  }

  // ─── Security ─────────────────────────────────────────────────

  async checkPermission(
    action: string,
    actor: string,
    resource?: string
  ): Promise<SecurityResult> {
    const allowedActions = [
      "generate_ad",
      "generate_landing",
      "generate_mockup",
      "generate_logo",
      "generate_banner",
      "generate_email",
      "generate_catalog",
      "edit_creative",
      "generate_variants",
      "generate_launch_pack",
      "batch_generate",
      "export_ecom",
    ];
    const allowed = allowedActions.includes(action);
    return {
      allowed,
      reason: allowed ? undefined : `Action "${action}" not permitted for AGENTE-KREA`,
      riskLevel: allowed ? "LOW" : "HIGH",
    };
  }

  async hashPassword(password: string): Promise<string> {
    // Delegate to crypto
    const { createHash } = await import("crypto");
    return createHash("sha256").update(password).digest("hex");
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    const computed = await this.hashPassword(password);
    return computed === hash;
  }

  async validateToken(token: string): Promise<{ valid: boolean; userId?: string }> {
    // Basic validation — in production this would check JWT
    return { valid: false };
  }

  // ─── Audit ────────────────────────────────────────────────────

  async auditLog(entry: Omit<AuditEntry, "timestamp">): Promise<void> {
    // In production this would write to audit store
  }

  // ─── Handoff ──────────────────────────────────────────────────

  async sendHandoff(
    contractId: string,
    payload: unknown
  ): Promise<HandoffResult> {
    return {
      contractId,
      status: "sent",
      externalSend: "NOT_VERIFIED" as EvidenceTag,
      payload,
    };
  }

  // ─── Health ───────────────────────────────────────────────────

  async healthCheck(): Promise<HealthStatus> {
    const capabilities = this.listCommercialCapabilities();
    return {
      healthy: this._isConnected,
      agent: this.adapterName,
      components: {
        zaiSdk: (await isProviderAvailable("text")) ? "UP" : "DOWN",
        engine: "UP",
        templates: "UP",
      },
      latencyMs: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // Commercial-Specific Methods (beyond AgentAdapter)
  // ═══════════════════════════════════════════════════════════════

  /** Generate a Meta/TikTok/Google ad */
  async generateAd(params: Record<string, unknown>) {
    return CommercialCreativeEngine.getInstance().generateAd(params as any);
  }

  /** Generate a landing page section */
  async generateLandingSection(params: Record<string, unknown>) {
    return CommercialCreativeEngine.getInstance().generateLandingSection(params as any);
  }

  /** Generate a product mockup */
  async generateMockup(params: Record<string, unknown>) {
    return CommercialCreativeEngine.getInstance().generateMockup(params as any);
  }

  /** Generate A/B variants */
  async generateVariants(params: Record<string, unknown>) {
    return CommercialCreativeEngine.getInstance().generateVariantPack(params as any);
  }

  /** Generate a logo */
  async generateLogo(params: LogoParams) {
    return generateLogo(params);
  }

  /** Generate a banner */
  async generateBanner(params: BannerParams) {
    return generateBanner(params);
  }

  /** Generate an email creative */
  async generateEmailCreative(params: EmailCreativeParams) {
    return generateEmailCreative(params);
  }

  /** Generate a catalog/flyer */
  async generateCatalog(params: CatalogParams) {
    return generateCatalog(params);
  }

  /** Edit a creative with natural language */
  async editCreative(params: NLEditParams) {
    return editCreativeWithNL(params);
  }

  /** Execute a batch generation pipeline */
  async batchGenerate(items: BatchItem[], concurrency?: number) {
    return executeBatch(items, concurrency);
  }

  /** Build and execute a standard launch batch */
  async launchBatch(params: Parameters<typeof buildLaunchBatch>[0]) {
    const items = buildLaunchBatch(params);
    return executeBatch(items);
  }

  /** Export to ecommerce platform */
  async exportToEcom(params: EcomExportParams) {
    return exportToEcom(params);
  }

  /** Get templates by category */
  getTemplates(category?: TemplateCategory) {
    return category ? getTemplatesByCategory(category) : getTemplateGallery();
  }

  /** Search templates */
  searchTemplates(query: string) {
    return searchTemplates(query);
  }

  /** Get template prompt modifier */
  getTemplateModifier(templateId: string) {
    return getTemplatePromptModifier(templateId);
  }

  // ─── Capability Listing ────────────────────────────────────────

  listCommercialCapabilities(): string[] {
    return [...KREA_AGENT_IDENTITY.capabilities];
  }

  listExcludedCapabilities(): string[] {
    return [...KREA_AGENT_IDENTITY.excludedCapabilities];
  }

  getIdentityInfo() {
    return { ...KREA_AGENT_IDENTITY };
  }
}

// ─── Singleton ──────────────────────────────────────────────────────

let kreaAdapterInstance: KreaAdapter | null = null;

export function getKreaAdapter(): KreaAdapter {
  if (!kreaAdapterInstance) {
    kreaAdapterInstance = new KreaAdapter();
  }
  return kreaAdapterInstance;
}

export function resetKreaAdapter(): void {
  kreaAdapterInstance = null;
}
