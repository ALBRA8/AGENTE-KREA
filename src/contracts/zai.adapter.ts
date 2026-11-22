/**
 * ZAI SDK Adapter — implementa IGenerationProvider para z-ai-web-dev-sdk
 * 
 * CORE → IGenerationProvider (interface) → ZAIAdapter (adapter) → ZAI SDK (provider)
 */

import ZAI from "z-ai-web-dev-sdk";
import {
  IGenerationProvider,
  ProviderConfig,
  ProviderResult,
  ProviderEvidence,
} from "./provider.interface";

const ZAI_CONFIG: ProviderConfig = {
  id: "z-ai-web-dev-sdk",
  name: "Z-AI Web Dev SDK",
  type: "text", // Default, overridden per instance
  priority: 1,
  enabled: true,
  maxRetries: 2,
  timeoutMs: 60000,
};

export class ZAITextAdapter implements IGenerationProvider {
  readonly config: ProviderConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor() {
    this.config = { ...ZAI_CONFIG, type: "text", id: "zai-text" };
  }

  private async init() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  async generate(params: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ProviderResult> {
    const zai = await this.init();
    const start = Date.now();
    
    const response = await withRateLimitRetry(() =>
      zai.chat.completions.create({
        messages: params.messages as any,
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.maxTokens !== undefined && { max_tokens: params.maxTokens }),
      })
    );

    const content = response.choices[0]?.message?.content || "";
    const evidence: ProviderEvidence = {
      truthLevel: "VERIFIED",
      model: "zai-chat",
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: { content },
      providerId: this.config.id,
      cost: 0, // ZAI cost managed by credit system
      latencyMs: Date.now() - start,
      evidence,
    };
  }

  async isAvailable(): Promise<boolean> {
    try { await this.init(); return true; } catch { return false; }
  }

  getCapabilities(): string[] {
    return ["chat.completions.create", "multi-turn", "system-prompts"];
  }

  estimateCost(): number { return 0; }
}

// ─── Image size normalization + rate-limit resilience ──────────────

/**
 * Valid sizes for the image API: both sides multiple of 32, 512–2880 px,
 * and total pixels <= 2^22. Requested creative dimensions like 1080x1080
 * or 600x200 are rejected with error 1214, so they are mapped to the
 * closest valid preset by aspect ratio (see smoke evidence P2).
 */
const IMAGE_SIZE_PRESETS = ["1024x1024", "1792x1024", "1024x576", "576x1024", "1152x896"] as const;

export function normalizeImageSize(size?: string): string {
  const fallback = "1024x1024";
  if (!size) return fallback;
  const m = /^(\d+)x(\d+)$/i.exec(size.trim());
  if (!m) return fallback;
  const w = parseInt(m[1], 10);
  const h = parseInt(m[2], 10);
  if (!w || !h) return fallback;

  const okSide = (n: number) => n % 32 === 0 && n >= 512 && n <= 2880;
  if (okSide(w) && okSide(h) && w * h <= 2 ** 22) return `${w}x${h}`;

  const ratio = w / h;
  let best = fallback;
  let bestDiff = Infinity;
  for (const p of IMAGE_SIZE_PRESETS) {
    const [pw, ph] = p.split("x").map(Number);
    const diff = Math.abs(pw / ph - ratio);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return best;
}

/**
 * Retry with backoff for transient rate-limit errors (HTTP 429).
 * The provider throttles bursts of calls; 2 delayed retries (3s, 6s) avoid
 * spurious failures in batch flows (verified in the P2 smoke runs).
 */
async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  const RETRY_DELAYS_MS = [3000, 6000];
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isThrottle = msg.includes("429") || msg.includes("Too many requests");
      if (!isThrottle || attempt === RETRY_DELAYS_MS.length) throw err;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastErr;
}

export class ZAIImageAdapter implements IGenerationProvider {
  readonly config: ProviderConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor() {
    this.config = { ...ZAI_CONFIG, type: "image", id: "zai-image" };
  }

  private async init() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  async generate(params: { prompt: string; size?: string }): Promise<ProviderResult> {
    const zai = await this.init();
    const start = Date.now();

    const size = normalizeImageSize(params.size);
    const response = await withRateLimitRetry(() =>
      zai.images.generations.create({
        model: "flux-krea-v2",
        prompt: params.prompt,
        size: size as any,
      })
    );

    const base64 = response.data[0]?.base64 || "";
    const url = (response.data?.[0] as any)?.url;
    const evidence: ProviderEvidence = {
      truthLevel: "VERIFIED",
      model: "flux-krea-v2",
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: { base64, url, size },
      providerId: this.config.id,
      cost: 0,
      latencyMs: Date.now() - start,
      evidence,
    };
  }

  async isAvailable(): Promise<boolean> {
    try { await this.init(); return true; } catch { return false; }
  }

  getCapabilities(): string[] {
    return ["images.generations.create", "sizes:512x512-1536x1024"];
  }

  estimateCost(): number { return 3; }
}

export class ZAIImageEditAdapter implements IGenerationProvider {
  readonly config: ProviderConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor() {
    this.config = { ...ZAI_CONFIG, type: "image-edit", id: "zai-image-edit" };
  }

  private async init() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  async generate(params: {
    image: string | Blob;
    prompt: string;
    size?: string;
  }): Promise<ProviderResult> {
    const zai = await this.init();
    const start = Date.now();

    const size = normalizeImageSize(params.size);
    const response = await withRateLimitRetry(() =>
      zai.images.generations.edit({
        model: "flux-krea-v2" as any,
        image: params.image as any,
        prompt: params.prompt,
        size: size as any,
      })
    );

    const base64 = (response.data?.[0] as any)?.base64 || "";
    const url = (response.data?.[0] as any)?.url;
    const evidence: ProviderEvidence = {
      truthLevel: "VERIFIED",
      model: "flux-krea-v2",
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: { base64, url, size },
      providerId: this.config.id,
      cost: 0,
      latencyMs: Date.now() - start,
      evidence,
    };
  }

  async isAvailable(): Promise<boolean> {
    try { await this.init(); return true; } catch { return false; }
  }

  getCapabilities(): string[] {
    return ["images.generations.edit", "nl-editing"];
  }

  estimateCost(): number { return 3; }
}

export class ZAIVoiceAdapter implements IGenerationProvider {
  readonly config: ProviderConfig;
  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;

  constructor() {
    this.config = { ...ZAI_CONFIG, type: "voice", id: "zai-voice" };
  }

  private async init() {
    if (!this.zai) this.zai = await ZAI.create();
    return this.zai;
  }

  async generate(params: { text: string; voice?: string }): Promise<ProviderResult> {
    const zai = await this.init();
    const start = Date.now();
    
    const voice = (params.voice || "tongtong") as any;
    const response = await zai.audio.tts.create({
      model: "krea-tts-v1",
      voice,
      input: params.text,
    });

    const arrayBuffer = await (response as Response).arrayBuffer();
    const evidence: ProviderEvidence = {
      truthLevel: "VERIFIED",
      model: "krea-tts-v1",
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: { arrayBuffer, voice },
      providerId: this.config.id,
      cost: 0,
      latencyMs: Date.now() - start,
      evidence,
    };
  }

  async isAvailable(): Promise<boolean> {
    try { await this.init(); return true; } catch { return false; }
  }

  getCapabilities(): string[] {
    return ["audio.tts.create", "voices:tongtong,xiaoyi,zhiyan,zhichu"];
  }

  estimateCost(): number { return 3; }
}
