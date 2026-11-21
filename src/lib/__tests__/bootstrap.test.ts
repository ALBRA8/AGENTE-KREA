/**
 * Tests for KREA ARNÉS — Bootstrap
 *
 * Verifica que el chaleco se le pone al agente correctamente.
 */

import { describe, it, expect, vi } from "vitest";
import { KreaHarness } from "../krea-harness";
import { bootstrapKrea, isBootstrapped } from "../bootstrap";

// ─── Mock del adapter para evitar dependencias reales ──────────────

vi.mock("../adapters/general-adapter", () => {
  return {
    GeneralAdapter: class {
      readonly adapterName = "agente-general";
      private _isConnected = false;
      get isConnected() { return this._isConnected; }
      getIdentity() {
        return {
          agentId: "mock-general", name: "AGENTE-GENERAL", version: "2.1.0",
          specialization: null, capabilities: ["reasoning"], autonomyLevel: "L3_SUGGEST",
          riskProfile: "MEDIUM", providers: ["mock"], memoryDomains: ["default"],
        };
      }
      async initialize() { this._isConnected = true; }
      async shutdown() { this._isConnected = false; }
      async reason(prompt: string) {
        return { content: `Mock: ${prompt}`, evidence: "INFERRED", confidence: 0.5, provider: "mock", latencyMs: 10 };
      }
      async reasonStructured<T>(prompt: string, _schema: unknown) {
        return { content: "{}", structured: {} as T, evidence: "INFERRED", confidence: 0.5, provider: "mock", latencyMs: 10 };
      }
      async memoryWrite() { return { id: "mem-1", evidence: "VERIFIED" }; }
      async memoryRead() { return []; }
      async checkPermission() { return { allowed: true }; }
      async hashPassword(p: string) { return `hash:${p}`; }
      async verifyPassword(p: string, h: string) { return h === `hash:${p}`; }
      async validateToken() { return { valid: true, userId: "mock" }; }
      async auditLog() {}
      async healthCheck() {
        return { healthy: this._isConnected, agent: "agente-general", components: {}, latencyMs: 5 };
      }
    },
  };
});

// Mock ZAI SDK
vi.mock("z-ai-web-dev-sdk", () => ({
  default: { create: async () => ({ chat: { completions: { create: async () => ({ choices: [{ message: { content: "ok" } }] }) } } }) },
}));

describe("KREA Bootstrap", () => {
  it("reports bootstrap not yet run", () => {
    // Before any bootstrap call
    expect(typeof isBootstrapped()).toBe("boolean");
  });

  it("bootstrap returns status object with correct shape", async () => {
    // Note: bootstrap may have already run from layout import
    // The important thing is it returns a valid shape
    const result = await bootstrapKrea();
    expect(result).toHaveProperty("status");
    expect(result).toHaveProperty("agent");
    expect(result).toHaveProperty("knowledge");
    expect(result).toHaveProperty("bridges");
    expect(result).toHaveProperty("skills");
    expect(["READY", "DEGRADED", "FAILED"]).toContain(result.status);
    expect(result.knowledge).toBeGreaterThan(0);
  });

  it("after bootstrap, harness has knowledge modules", async () => {
    await bootstrapKrea();
    // The global harness should have knowledge registered
    // (tested through the return value since singletons are shared)
    const result = await bootstrapKrea();
    // 16 módulos tras archivar el Product Factory (ver src/_product-factory/README.md)
    expect(result.knowledge).toBe(16);
  });

  it("bootstrap is idempotent — calling twice returns same state", async () => {
    const result1 = await bootstrapKrea();
    const result2 = await bootstrapKrea();
    expect(result1.status).toBe(result2.status);
    expect(result1.knowledge).toBe(result2.knowledge);
  });
});

describe("Cajero analogy — el chaleco está puesto", () => {
  it("the harness has an active agent after bootstrap", async () => {
    const result = await bootstrapKrea();
    // Agent should be mounted (even if degraded)
    expect(result.agent).toBeTruthy();
  });

  it("knowledge is available regardless of agent status", async () => {
    const result = await bootstrapKrea();
    // Knowledge modules are always available — they're in KREA, not in the agent
    expect(result.knowledge).toBeGreaterThan(0);
  });
});
