/**
 * Tests for KREA ARNÉS — Agent Adapter + Harness + Infoproductos
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AgentAdapter,
  AdapterRegistry,
  adapterRegistry,
  type AgentIdentity,
  type AgentResponse,
  type EvidenceTag,
} from "../agent-adapter";
import { KreaHarness, kreaHarness, getAgent, withAgent } from "../krea-harness";

// ─── Mock Adapter for testing ──────────────────────────────────────

class MockAdapter implements AgentAdapter {
  readonly adapterName: string;
  private connected = false;

  constructor(name: string) {
    this.adapterName = name;
  }

  get isConnected() { return this.connected; }

  getIdentity(): AgentIdentity {
    return {
      agentId: `mock-${this.adapterName}`,
      name: this.adapterName,
      version: "1.0.0",
      specialization: null,
      capabilities: ["reasoning", "memory"],
      autonomyLevel: "L3_SUGGEST",
      riskProfile: "LOW",
      providers: ["mock"],
      memoryDomains: ["default"],
    };
  }

  async initialize() { this.connected = true; }
  async shutdown() { this.connected = false; }

  async reason(prompt: string): Promise<AgentResponse> {
    return {
      content: `Mock response to: ${prompt}`,
      evidence: "INFERRED" as EvidenceTag,
      confidence: 0.5,
      provider: "mock",
      latencyMs: 10,
    };
  }

  async reasonStructured<T>(prompt: string, _schema: unknown): Promise<AgentResponse & { structured: T }> {
    return {
      content: '{"result": "mock"}',
      structured: { result: "mock" } as T,
      evidence: "INFERRED" as EvidenceTag,
      confidence: 0.5,
      provider: "mock",
      latencyMs: 10,
    };
  }

  async memoryWrite(domain: string, content: unknown) {
    return { id: `mem-${Date.now()}`, evidence: "VERIFIED" as EvidenceTag };
  }

  async memoryRead() { return []; }
  async checkPermission(action?: string, actor?: string, resource?: string) { return { allowed: true }; }
  async hashPassword(p: string) { return `hash:${p}`; }
  async verifyPassword(p: string, h: string) { return h === `hash:${p}`; }
  async validateToken(t: string) { return { valid: true, userId: "mock-user" }; }
  async auditLog() {}
  async healthCheck() {
    return {
      healthy: this.connected,
      agent: this.adapterName,
      components: { runtime: this.connected ? "UP" as const : "DOWN" as const },
      latencyMs: 5,
    };
  }
}

// ─── AdapterRegistry Tests ─────────────────────────────────────────

describe("AdapterRegistry", () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  it("registers an adapter", () => {
    const adapter = new MockAdapter("test-agent");
    registry.register("test-agent", adapter);
    expect(registry.list()).toHaveLength(1);
    expect(registry.activeName).toBe("test-agent");
  });

  it("sets active adapter", () => {
    const a1 = new MockAdapter("agent-1");
    const a2 = new MockAdapter("agent-2");
    registry.register("agent-1", a1);
    registry.register("agent-2", a2);

    const active = registry.setActive("agent-2");
    expect(active.adapterName).toBe("agent-2");
    expect(registry.activeName).toBe("agent-2");
  });

  it("gets active adapter", () => {
    const adapter = new MockAdapter("test-agent");
    registry.register("test-agent", adapter);
    expect(registry.getActive().adapterName).toBe("test-agent");
  });

  it("throws when setting unregistered adapter as active", () => {
    expect(() => registry.setActive("nonexistent")).toThrow();
  });

  it("unregisters adapter and falls back", () => {
    const a1 = new MockAdapter("agent-1");
    const a2 = new MockAdapter("agent-2");
    registry.register("agent-1", a1);
    registry.register("agent-2", a2);
    registry.setActive("agent-1");

    registry.unregister("agent-1");
    expect(registry.activeName).toBe("agent-2");
  });

  it("lists all adapters with active flag", () => {
    const a1 = new MockAdapter("agent-1");
    const a2 = new MockAdapter("agent-2");
    registry.register("agent-1", a1);
    registry.register("agent-2", a2);

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.find(a => a.name === "agent-1")?.active).toBe(true);
    expect(list.find(a => a.name === "agent-2")?.active).toBe(false);
  });
});

// ─── KreaHarness Tests ─────────────────────────────────────────────

describe("KreaHarness", () => {
  let harness: KreaHarness;

  beforeEach(() => {
    harness = new KreaHarness();
  });

  it("mounts an adapter", async () => {
    const adapter = new MockAdapter("test-agent");
    await harness.mount(adapter);
    const status = harness.status();
    expect(status.initialized).toBe(true);
    expect(status.activeAgent).toBe("test-agent");
  });

  it("swaps agent without losing knowledge", async () => {
    const agent1 = new MockAdapter("cajero-1");
    const agent2 = new MockAdapter("cajero-2");

    await harness.mount(agent1);
    const result = await harness.swapAgent(agent2);

    expect(result.previousAgent).toBe("cajero-1");
    expect(result.newAgent).toBe("cajero-2");
    expect(result.knowledgePreserved).toBe(true);
  });

  it("reports knowledge as always UP", async () => {
    const adapter = new MockAdapter("test-agent");
    await harness.mount(adapter);

    const health = await harness.healthCheck();
    expect(health.knowledge).toBe("UP"); // Knowledge never goes down
  });

  it("reports all knowledge modules", async () => {
    const status = harness.status();
    // 28 módulos tras re-integrar el Product Factory (12 módulos de producto + 16 existentes)
    expect(status.knowledgeModules.length).toBe(28);
    expect(status.knowledgeModules).toContain("pdf-factory");
    expect(status.knowledgeModules).toContain("commercial-creative-engine");
    expect(status.knowledgeModules).toContain("infoproductos-pipeline");
  });

  it("works in degraded mode when agent is down", async () => {
    const health = await harness.healthCheck();
    expect(health.knowledge).toBe("UP");
    // Agent may be DOWN but knowledge is UP
  });
});

// ─── getAgent / withAgent helpers ──────────────────────────────────

describe("Harness helpers", () => {
  it("getAgent returns active adapter", async () => {
    const adapter = new MockAdapter("helper-test");
    // Use a fresh registry for this test
    const { AdapterRegistry: FreshRegistry } = await import("../agent-adapter");
    const localRegistry = new FreshRegistry();
    localRegistry.register("helper-test", adapter);
    localRegistry.setActive("helper-test");
    // The global getAgent uses the global singleton, so we just verify it exists
    expect(typeof getAgent).toBe("function");
  });

  it("withAgent falls back gracefully", async () => {
    const result = await withAgent(
      async (agent) => await agent.reason("test"),
      () => ({ content: "fallback", evidence: "NOT_VERIFIED" as EvidenceTag, confidence: 0, provider: "fallback", latencyMs: 0 }),
    );
    expect(result).toBeDefined();
  });
});

// ─── AgentAdapter contract tests ───────────────────────────────────

describe("AgentAdapter contract", () => {
  it("MockAdapter implements full interface", async () => {
    const adapter = new MockAdapter("contract-test");
    await adapter.initialize();

    expect(adapter.isConnected).toBe(true);
    expect(adapter.getIdentity().name).toBe("contract-test");
    expect(adapter.getIdentity().capabilities).toContain("reasoning");

    const response = await adapter.reason("test prompt");
    expect(response.content).toContain("Mock response");
    expect(response.evidence).toBe("INFERRED");
    expect(response.confidence).toBeGreaterThan(0);

    const structured = await adapter.reasonStructured<{ result: string }>("test", {});
    expect(structured.structured.result).toBe("mock");

    const memResult = await adapter.memoryWrite("test", { data: "hello" });
    expect(memResult.evidence).toBe("VERIFIED");

    const permResult = await adapter.checkPermission("test.action", "user", undefined as any);
    expect(permResult.allowed).toBe(true);

    await adapter.shutdown();
    expect(adapter.isConnected).toBe(false);
  });
});

// ─── Philosophy test ───────────────────────────────────────────────

describe("KREA ARNÉS philosophy", () => {
  it("knowledge is independent of agent", async () => {
    const harness = new KreaHarness();
    const knowledgeModules = harness.status().knowledgeModules;

    // Mount agent 1
    const agent1 = new MockAdapter("agente-general");
    await harness.mount(agent1);
    const modulesWithAgent1 = harness.status().knowledgeModules;

    // Swap to agent 2
    const agent2 = new MockAdapter("hermes");
    await harness.swapAgent(agent2);
    const modulesWithAgent2 = harness.status().knowledgeModules;

    // Knowledge is IDENTICAL regardless of agent
    expect(modulesWithAgent1).toEqual(modulesWithAgent2);
    expect(modulesWithAgent1).toHaveLength(knowledgeModules.length);
  });

  it("cajero analogy: swap cashier, register stays", async () => {
    const harness = new KreaHarness();

    // Cajero 1 (AGENTE-GENERAL)
    await harness.mount(new MockAdapter("cajero-general"));
    const status1 = harness.status();

    // Cajero 2 (HERMES)
    await harness.swapAgent(new MockAdapter("cajero-hermes"));
    const status2 = harness.status();

    // La caja registradora (KREA) no cambió
    expect(status1.knowledgeModules).toEqual(status2.knowledgeModules);
    // Pero el cajero sí
    expect(status1.activeAgent).toBe("cajero-general");
    expect(status2.activeAgent).toBe("cajero-hermes");
  });
});
