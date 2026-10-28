/**
 * Tests for KREA ARNÉS — Bridges + SkillPlugin + KnowledgeRegistry
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AdapterRegistry,
  type AgentAdapter,
  type AgentIdentity,
  type AgentResponse,
  type EvidenceTag,
  type HealthStatus,
} from "../agent-adapter";
import { BridgeRegistry } from "../bridges/types";
import { KreaHarness } from "../krea-harness";
import { SkillRegistry, type ISkillPlugin, type SkillContext, type SkillCategory, type SkillResult } from "../harness/types";
import { KnowledgeRegistry, type IKnowledgeModule, type KnowledgeCategory } from "../harness/knowledge-registry";

// ─── Mock Adapter ──────────────────────────────────────────────────

class MockAdapter implements AgentAdapter {
  readonly adapterName: string;
  private connected = false;
  constructor(name: string) { this.adapterName = name; }
  get isConnected() { return this.connected; }
  getIdentity(): AgentIdentity {
    return { agentId: `mock-${this.adapterName}`, name: this.adapterName, version: "1.0.0", specialization: null, capabilities: ["reasoning"], autonomyLevel: "L3_SUGGEST", riskProfile: "LOW", providers: ["mock"], memoryDomains: ["default"] };
  }
  async initialize() { this.connected = true; }
  async shutdown() { this.connected = false; }
  async reason(prompt: string): Promise<AgentResponse> {
    return { content: `Mock: ${prompt}`, evidence: "INFERRED" as EvidenceTag, confidence: 0.5, provider: "mock", latencyMs: 10 };
  }
  async reasonStructured<T>(prompt: string, _schema: unknown): Promise<AgentResponse & { structured: T }> {
    return { content: '{"result":"mock"}', structured: { result: "mock" } as T, evidence: "INFERRED" as EvidenceTag, confidence: 0.5, provider: "mock", latencyMs: 10 };
  }
  async memoryWrite() { return { id: "mem-1", evidence: "VERIFIED" as EvidenceTag }; }
  async memoryRead() { return []; }
  async checkPermission() { return { allowed: true }; }
  async hashPassword(p: string) { return `hash:${p}`; }
  async verifyPassword(p: string, h: string) { return h === `hash:${p}`; }
  async validateToken() { return { valid: true, userId: "mock" }; }
  async auditLog() {}
  async healthCheck(): Promise<HealthStatus> {
    return { healthy: this.connected, agent: this.adapterName, components: { runtime: this.connected ? "UP" as const : "DOWN" as const }, latencyMs: 5 };
  }
}

// ─── Mock Bridge ───────────────────────────────────────────────────

class MockBridge {
  readonly bridgeId = "mock-bridge";
  readonly bridgeType = "mock" as const;
  readonly capabilities = ["chat", "mock"];
  private _isConnected = false;
  get isConnected() { return this._isConnected; }
  async initialize() { this._isConnected = true; }
  async shutdown() { this._isConnected = false; }
  async healthCheck() {
    return { status: this._isConnected ? "CONNECTED" as const : "DISCONNECTED" as const, latencyMs: 5 };
  }
}

// ─── Mock Skill Plugin ────────────────────────────────────────────

class MockSkillPlugin implements ISkillPlugin {
  readonly skillId = "mock-skill";
  readonly name = "Mock Skill";
  readonly version = "1.0.0";
  readonly category: SkillCategory = "product-brain";
  readonly capabilities = ["mock-op"];
  readonly dependencies: string[] = [];
  private _isReady = false;
  get isReady() { return this._isReady; }
  async initialize(_ctx: SkillContext) { this._isReady = true; }
  async shutdown() { this._isReady = false; }
  async healthCheck() { return { status: this._isReady ? "READY" as const : "DOWN" as const, latencyMs: 1 }; }
  async execute(op: string, _params: unknown): Promise<SkillResult> {
    return { success: true, data: { operation: op }, evidence: "VERIFIED" as EvidenceTag, latencyMs: 1 };
  }
  listOperations() { return this.capabilities; }
}

// ─── BridgeRegistry Tests ──────────────────────────────────────────

describe("BridgeRegistry", () => {
  it("registers and lists bridges", () => {
    const registry = new BridgeRegistry();
    const bridge = new MockBridge();
    registry.register(bridge);
    const list = registry.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("mock-bridge");
    expect(list[0].type).toBe("mock");
  });

  it("gets bridge by ID", () => {
    const registry = new BridgeRegistry();
    const bridge = new MockBridge();
    registry.register(bridge);
    expect(registry.get("mock-bridge")).toBe(bridge);
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("gets bridges by capability", () => {
    const registry = new BridgeRegistry();
    const bridge = new MockBridge();
    registry.register(bridge);
    const chatBridges = registry.getByCapability("chat");
    expect(chatBridges).toHaveLength(1);
    const unknownBridges = registry.getByCapability("unknown");
    expect(unknownBridges).toHaveLength(0);
  });

  it("unregisters a bridge", () => {
    const registry = new BridgeRegistry();
    const bridge = new MockBridge();
    registry.register(bridge);
    registry.unregister("mock-bridge");
    expect(registry.list()).toHaveLength(0);
  });
});

// ─── SkillRegistry Tests ───────────────────────────────────────────

describe("SkillRegistry", () => {
  let registry: SkillRegistry;
  let context: SkillContext;

  beforeEach(() => {
    registry = new SkillRegistry();
    const mockAdapter = new MockAdapter("test");
    context = {
      agent: {
        reason: async (prompt: string) => ({ content: `Mock: ${prompt}`, evidence: "INFERRED", confidence: 0.5, provider: "mock", latencyMs: 10 }),
        reasonStructured: async <T,>(prompt: string) => ({ result: "mock" } as T),
      },
      bridges: { get: () => undefined },
      skills: { get: () => undefined },
    };
  });

  it("registers and initializes a skill", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    expect(skill.isReady).toBe(true);
    expect(registry.list()).toHaveLength(1);
  });

  it("lists skills with metadata", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    const list = registry.list();
    expect(list[0].id).toBe("mock-skill");
    expect(list[0].ready).toBe(true);
    expect(list[0].category).toBe("product-brain");
  });

  it("executes a skill operation", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    const result = await registry.execute("mock-skill", "mock-op", {});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ operation: "mock-op" });
  });

  it("returns error for unregistered skill", async () => {
    const result = await registry.execute("nonexistent", "op", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("not registered");
  });

  it("unregisters and shuts down a skill", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    await registry.unregister("mock-skill");
    expect(skill.isReady).toBe(false);
    expect(registry.list()).toHaveLength(0);
  });

  it("health checks all skills", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    const health = await registry.healthCheckAll();
    expect(health["mock-skill"].status).toBe("READY");
  });

  it("filters skills by category", async () => {
    registry.setContext(context);
    const skill = new MockSkillPlugin();
    await registry.register(skill);
    const brainSkills = registry.getByCategory("product-brain");
    expect(brainSkills).toHaveLength(1);
    const factorySkills = registry.getByCategory("product-factory");
    expect(factorySkills).toHaveLength(0);
  });
});

// ─── KnowledgeRegistry Tests ───────────────────────────────────────

describe("KnowledgeRegistry", () => {
  let registry: KnowledgeRegistry;

  beforeEach(() => {
    registry = new KnowledgeRegistry();
  });

  it("registers and lists knowledge modules", () => {
    const mod: IKnowledgeModule = {
      moduleId: "test-module",
      name: "Test Module",
      version: "1.0",
      category: "product-brain" as KnowledgeCategory,
      capabilities: ["test"],
      sourceFiles: ["test.ts"],
      healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    registry.register(mod);
    expect(registry.listIds()).toContain("test-module");
    expect(registry.list()).toHaveLength(1);
  });

  it("groups modules by category", () => {
    const m1: IKnowledgeModule = {
      moduleId: "m1", name: "M1", version: "1.0", category: "product-brain" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    const m2: IKnowledgeModule = {
      moduleId: "m2", name: "M2", version: "1.0", category: "product-factory" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    registry.register(m1);
    registry.register(m2);
    expect(registry.getByCategory("product-brain")).toHaveLength(1);
    expect(registry.getByCategory("product-factory")).toHaveLength(1);
  });

  it("computes stats", () => {
    const m1: IKnowledgeModule = {
      moduleId: "m1", name: "M1", version: "1.0", category: "product-brain" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    const m2: IKnowledgeModule = {
      moduleId: "m2", name: "M2", version: "1.0", category: "product-brain" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    registry.register(m1);
    registry.register(m2);
    const stats = registry.stats();
    expect(stats.total).toBe(2);
    expect(stats.byCategory["product-brain"]).toBe(2);
  });

  it("health checks all modules", async () => {
    const mod: IKnowledgeModule = {
      moduleId: "test", name: "Test", version: "1.0", category: "product-brain" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    registry.register(mod);
    const health = await registry.healthCheckAll();
    expect(health["test"].status).toBe("AVAILABLE");
  });

  it("unregisters a module", () => {
    const mod: IKnowledgeModule = {
      moduleId: "test", name: "Test", version: "1.0", category: "product-brain" as KnowledgeCategory, capabilities: [], sourceFiles: [], healthCheck: async () => ({ status: "AVAILABLE" }),
    };
    registry.register(mod);
    registry.unregister("test");
    expect(registry.listIds()).toHaveLength(0);
  });
});

// ─── KreaHarness v2.1 Integration Tests ────────────────────────────

describe("KreaHarness v2.1", () => {
  it("registers knowledge on mount", async () => {
    const harness = new KreaHarness();
    const adapter = new MockAdapter("test-agent");
    await harness.mount(adapter);

    const status = harness.status();
    expect(status.initialized).toBe(true);
    expect(status.knowledgeModules.length).toBeGreaterThan(20);
    expect(status.knowledgeStats.total).toBeGreaterThan(20);
  });

  it("reports bridge and skill status", async () => {
    const harness = new KreaHarness();
    const adapter = new MockAdapter("test-agent");
    await harness.mount(adapter);

    const status = harness.status();
    expect(status).toHaveProperty("bridges");
    expect(status).toHaveProperty("skills");
    expect(status).toHaveProperty("knowledgeStats");
    expect(status).toHaveProperty("philosophy");
  });

  it("swaps agent preserving knowledge and skills", async () => {
    const harness = new KreaHarness();
    await harness.mount(new MockAdapter("agent-1"));

    const knowledgeBefore = harness.status().knowledgeModules;
    const statsBefore = harness.status().knowledgeStats;

    const result = await harness.swapAgent(new MockAdapter("agent-2"));

    expect(result.previousAgent).toBe("agent-1");
    expect(result.newAgent).toBe("agent-2");
    expect(result.knowledgePreserved).toBe(true);

    const knowledgeAfter = harness.status().knowledgeModules;
    const statsAfter = harness.status().knowledgeStats;
    expect(knowledgeBefore).toEqual(knowledgeAfter);
    expect(statsBefore).toEqual(statsAfter);
  });

  it("provides skill execution through harness", async () => {
    const harness = new KreaHarness();
    await harness.mount(new MockAdapter("test-agent"));

    // Register a skill
    const skill = new MockSkillPlugin();
    await harness.registerSkill(skill);

    const result = await harness.executeSkill("mock-skill", "mock-op", { test: true });
    expect(result.success).toBe(true);
  });

  it("knowledge health is always UP", async () => {
    const harness = new KreaHarness();
    await harness.mount(new MockAdapter("test-agent"));

    const health = await harness.healthCheck();
    expect(health.knowledge).toBe("UP");
  });
});
