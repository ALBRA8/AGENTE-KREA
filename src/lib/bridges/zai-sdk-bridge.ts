/**
 * KREA ARNÉS — ZAI SDK Bridge
 *
 * Bridge que conecta KREA con el z-ai-web-dev-sdk.
 * Este es el bridge PRIMARIO para capacidades cognitivas (LLM, image, voice).
 *
 * El z-ai-web-dev-sdk es un paquete Node.js — no necesita subprocess.
 * Es el proveedor real de IA que KREA usa a través del arnés.
 *
 * Flujo:
 *   KREA (arnés) → AgentAdapter → ZaiSdkBridge → z-ai-web-dev-sdk → AI Provider
 */

import ZAI from "z-ai-web-dev-sdk";
import type { EvidenceTag } from "../agent-adapter";
import type {
  IBridge,
  BridgeHealth,
  BridgeCallResult,
  ZaiChatParams,
  ZaiImageParams,
  ZaiImageEditParams,
  ZaiVoiceParams,
  ZaiChatResult,
  ZaiImageResult,
  ZaiImageEditResult,
  ZaiVoiceResult,
} from "./types";

// ─── ZaiSdkBridge ──────────────────────────────────────────────────

export class ZaiSdkBridge implements IBridge {
  readonly bridgeId = "zai-sdk";
  readonly bridgeType = "zai-sdk" as const;
  readonly capabilities = [
    "chat.completions",
    "images.generations",
    "images.edits",
    "audio.tts",
    "multi-turn",
    "system-prompts",
    "structured-output",
  ];

  private zai: Awaited<ReturnType<typeof ZAI.create>> | null = null;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  async initialize(): Promise<void> {
    try {
      this.zai = await ZAI.create();
      this._isConnected = true;
    } catch (error) {
      this._isConnected = false;
      console.warn("[ZaiSdkBridge] Failed to initialize ZAI SDK:", error);
    }
  }

  async shutdown(): Promise<void> {
    this.zai = null;
    this._isConnected = false;
  }

  async healthCheck(): Promise<BridgeHealth> {
    if (!this._isConnected || !this.zai) {
      return { status: "DISCONNECTED", latencyMs: 0, details: "ZAI SDK not initialized" };
    }
    const start = Date.now();
    try {
      // Simple ping: try a minimal chat completion
      await this.zai.chat.completions.create({
        messages: [{ role: "user", content: "ping" }],
      });
      return { status: "CONNECTED", latencyMs: Date.now() - start };
    } catch (error) {
      return { status: "DEGRADED", latencyMs: Date.now() - start, details: String(error) };
    }
  }

  private async ensureConnected(): Promise<NonNullable<typeof this.zai>> {
    if (!this.zai) {
      await this.initialize();
    }
    if (!this.zai) {
      throw new Error("ZAI SDK unavailable — cannot connect to provider");
    }
    return this.zai;
  }

  // ─── Chat (LLM) ──────────────────────────────────────────────

  async chat(params: ZaiChatParams): Promise<ZaiChatResult> {
    const start = Date.now();
    try {
      const zai = await this.ensureConnected();

      const response = await zai.chat.completions.create({
        messages: params.messages as any,
        ...(params.temperature !== undefined && { temperature: params.temperature }),
        ...(params.maxTokens !== undefined && { max_tokens: params.maxTokens }),
        ...(params.model && { model: params.model }),
      });

      const content = response.choices?.[0]?.message?.content || "";
      const model = response.model || params.model || "zai-chat";

      return {
        success: true,
        data: {
          content,
          model,
          tokensUsed: response.usage
            ? { input: response.usage.prompt_tokens || 0, output: response.usage.completion_tokens || 0 }
            : undefined,
        },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    } catch (error) {
      return {
        success: false,
        error: `ZAI chat failed: ${error}`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    }
  }

  // ─── Image Generation ────────────────────────────────────────

  async generateImage(params: ZaiImageParams): Promise<ZaiImageResult> {
    const start = Date.now();
    try {
      const zai = await this.ensureConnected();

      const response = await zai.images.generations.create({
        model: (params.model || "flux-krea-v2") as any,
        prompt: params.prompt,
        size: (params.size || "1024x1024") as any,
      });

      const base64 = (response.data?.[0] as any)?.base64 || "";
      const url = (response.data?.[0] as any)?.url;

      return {
        success: true,
        data: { base64, url, size: params.size || "1024x1024" },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    } catch (error) {
      return {
        success: false,
        error: `ZAI image generation failed: ${error}`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    }
  }

  // ─── Image Editing ───────────────────────────────────────────

  async editImage(params: ZaiImageEditParams): Promise<ZaiImageEditResult> {
    const start = Date.now();
    try {
      const zai = await this.ensureConnected();

      const response = await zai.images.generations.edit({
        model: (params.model || "flux-krea-v2") as any,
        image: params.image as any,
        prompt: params.prompt,
        size: (params.size || "1024x1024") as any,
      });

      const base64 = (response.data?.[0] as any)?.base64 || "";
      const url = (response.data?.[0] as any)?.url;

      return {
        success: true,
        data: { base64, url, size: params.size || "1024x1024" },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    } catch (error) {
      return {
        success: false,
        error: `ZAI image edit failed: ${error}`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    }
  }

  // ─── Voice (TTS) ─────────────────────────────────────────────

  async generateSpeech(params: ZaiVoiceParams): Promise<ZaiVoiceResult> {
    const start = Date.now();
    try {
      const zai = await this.ensureConnected();

      const voice = (params.voice || "tongtong") as any;
      const response = await zai.audio.tts.create({
        model: (params.model || "krea-tts-v1") as any,
        voice,
        input: params.text,
      });

      // TTS response is a Response object with audio data
      const arrayBuffer = await (response as Response).arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      return {
        success: true,
        data: { audioBase64: base64, voice: params.voice || "tongtong" },
        evidence: "VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    } catch (error) {
      return {
        success: false,
        error: `ZAI TTS failed: ${error}`,
        evidence: "NOT_VERIFIED" as EvidenceTag,
        latencyMs: Date.now() - start,
        provider: "zai",
      };
    }
  }

  // ─── Generic call (for AgentAdapter compatibility) ───────────

  async call(method: string, params: unknown): Promise<BridgeCallResult> {
    switch (method) {
      case "chat":
        return this.chat(params as ZaiChatParams);
      case "generateImage":
        return this.generateImage(params as ZaiImageParams);
      case "generateSpeech":
        return this.generateSpeech(params as ZaiVoiceParams);
      case "editImage":
        return this.editImage(params as ZaiImageEditParams);
      default:
        return {
          success: false,
          error: `Unknown method: ${method}`,
          evidence: "NOT_VERIFIED" as EvidenceTag,
          latencyMs: 0,
          provider: "zai",
        };
    }
  }
}

// ─── Singleton ─────────────────────────────────────────────────────

export const zaiSdkBridge = new ZaiSdkBridge();
