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

  async generate(params: { messages: Array<{ role: string; content: string }> }): Promise<ProviderResult> {
    const zai = await this.init();
    const start = Date.now();
    
    const response = await zai.chat.completions.create({
      messages: params.messages as any,
    });

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
    
    const size = params.size || "1024x1024";
    const response = await zai.images.generations.create({
      model: "flux-krea-v2",
      prompt: params.prompt,
      size: size as any,
      n: 1,
    });

    const base64 = response.data[0]?.base64 || "";
    const evidence: ProviderEvidence = {
      truthLevel: "VERIFIED",
      model: "flux-krea-v2",
      timestamp: new Date().toISOString(),
    };

    return {
      success: true,
      data: { base64, size },
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
