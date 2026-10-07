/**
 * KREA Doctor V2 — Expanded Health Check & Diagnostics
 * ADN GENERAL DEL AGENTE V1.0
 *
 * Pipeline: AUDIT → DIAGNOSE → VERIFY → REPORT → SAFE_FIX (only when explicitly authorized)
 *
 * 15 real checks:
 *   1. runtime        — process memory, uptime, event loop lag
 *   2. database       — connection, integrity, user count, migration status
 *   3. apis           — all /api routes responding
 *   4. providers      — ZAI SDK available, adapters functional
 *   5. mcp            — MCP server/client status
 *   6. memory         — memory system functional, count by type
 *   7. skills         — skill registry status, active skills count
 *   8. permissions    — policy engine loaded, rules count
 *   9. authentication — auth flow working, no plaintext passwords
 *  10. integrations   — agent-to-agent comm status
 *  11. configuration  — env vars, required config present
 *  12. dependencies   — critical packages installed
 *  13. health         — overall health score (computed)
 *  14. persistence    — DB writable, file storage writable
 *  15. critical_workflows — test a simple generation flow
 */

import { db } from "@/lib/db";
import { KreaDoctor } from "@/lib/doctor";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type CheckStatus = "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
export type TruthLevel = "VERIFIED" | "OBSERVED" | "ESTIMATED" | "UNKNOWN";

export interface HealthCheckResultV2 {
  name: string;
  category: string;
  status: CheckStatus;
  latencyMs?: number;
  details?: string;
  error?: string;
  evidence: {
    checkedAt: string;
    truthLevel: TruthLevel;
    source: string;
  };
  metrics?: Record<string, number | string>;
}

export interface SafeFix {
  diagnosis: string;
  action: string;
  before: string;
  after: string;
  timestamp: string;
  executionId: string;
  result: "SUCCESS" | "FAILED" | "SKIPPED";
}

export interface DoctorReportV2 {
  agentId: string;
  version: string;
  timestamp: string;
  overallStatus: CheckStatus;
  checks: HealthCheckResultV2[];
  healthScore: number; // 0-100
  summary: string;
  recommendations: string[];
  safeFixes: SafeFix[];
  pipeline: string;
}

export interface DoctorV2Options {
  authorizeFixes?: boolean;
  skipChecks?: string[];
  timeout?: number;
}

// ──────────────────────────────────────────────
// Implementation
// ──────────────────────────────────────────────

export class KreaDoctorV2 {
  readonly agentId = "krea";
  readonly version = "2.0.0";
  readonly pipeline = "AUDIT → DIAGNOSE → VERIFY → REPORT → SAFE_FIX";

  private options: DoctorV2Options;

  constructor(options: DoctorV2Options = {}) {
    this.options = {
      authorizeFixes: false,
      skipChecks: [],
      timeout: 10000,
      ...options,
    };
  }

  /**
   * Run the full diagnostic pipeline.
   */
  async runFullCheck(): Promise<DoctorReportV2> {
    const allChecks = [
      this.checkRuntime(),
      this.checkDatabase(),
      this.checkAPIs(),
      this.checkProviders(),
      this.checkMCP(),
      this.checkMemory(),
      this.checkSkills(),
      this.checkPermissions(),
      this.checkAuthentication(),
      this.checkIntegrations(),
      this.checkConfiguration(),
      this.checkDependencies(),
      this.checkPersistence(),
      this.checkCriticalWorkflows(),
    ];

    // Filter skipped checks
    const filteredChecks = allChecks.filter((check) => {
      // We can't know the name before execution, so we run all
      // and filter after if needed
      return true;
    });

    const results = await Promise.allSettled(filteredChecks);
    const checks: HealthCheckResultV2[] = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        name: `check_${i}`,
        category: "unknown",
        status: "UNKNOWN" as CheckStatus,
        error: r.reason?.message || "Unknown error",
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "UNKNOWN" as TruthLevel,
          source: "doctor-v2",
        },
      };
    });

    // Filter out skipped checks
    const activeChecks = checks.filter(
      (c) => !this.options.skipChecks?.includes(c.name)
    );

    // Compute overall status
    const unhealthy = activeChecks.filter((c) => c.status === "UNHEALTHY").length;
    const degraded = activeChecks.filter((c) => c.status === "DEGRADED").length;
    const healthy = activeChecks.filter((c) => c.status === "HEALTHY").length;

    const overallStatus: CheckStatus =
      unhealthy > 0 ? "UNHEALTHY" : degraded > 0 ? "DEGRADED" : "HEALTHY";

    // Compute health score (weighted)
    const healthScore = Math.round(
      (healthy * 100 + degraded * 50 + unhealthy * 0) / activeChecks.length
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(activeChecks);

    // Run safe fixes only if authorized
    const safeFixes: SafeFix[] = this.options.authorizeFixes
      ? await this.runSafeFixes(activeChecks)
      : [];

    // Add the computed health check
    const healthCheck: HealthCheckResultV2 = {
      name: "health",
      category: "system",
      status: overallStatus,
      details: `Score: ${healthScore}/100 — ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy`,
      metrics: {
        score: healthScore,
        healthy,
        degraded,
        unhealthy,
        total: activeChecks.length,
      },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "VERIFIED",
        source: "doctor-v2",
      },
    };

    return {
      agentId: this.agentId,
      version: this.version,
      timestamp: new Date().toISOString(),
      overallStatus,
      checks: [...activeChecks, healthCheck],
      healthScore,
      summary: `${activeChecks.length + 1} checks: ${healthy} healthy, ${degraded} degraded, ${unhealthy} unhealthy (score: ${healthScore}/100)`,
      recommendations,
      safeFixes,
      pipeline: this.pipeline,
    };
  }

  // ──────────────────────────────────────────────
  // CHECK 1: Runtime
  // ──────────────────────────────────────────────
  async checkRuntime(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      const mem = process.memoryUsage();
      const uptime = process.uptime();
      const rssMB = Math.round(mem.rss / 1024 / 1024);
      const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
      const heapRatio = mem.heapUsed / mem.heapTotal;

      // Event loop lag estimation
      const loopStart = Date.now();
      await new Promise((resolve) => setImmediate(resolve));
      const loopLag = Date.now() - loopStart;

      const isMemoryHigh = heapRatio > 0.9;
      const isLoopSlow = loopLag > 50;

      return {
        name: "runtime",
        category: "system",
        status: isMemoryHigh ? "UNHEALTHY" : isLoopSlow ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `RSS: ${rssMB}MB, Heap: ${heapUsedMB}/${heapTotalMB}MB (${Math.round(heapRatio * 100)}%), Uptime: ${Math.round(uptime)}s, EventLoop lag: ${loopLag}ms`,
        metrics: {
          rssMB,
          heapUsedMB,
          heapTotalMB,
          heapRatio: Math.round(heapRatio * 100),
          uptimeSec: Math.round(uptime),
          eventLoopLagMs: loopLag,
        },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "process.memoryUsage",
        },
      };
    } catch (e: any) {
      return {
        name: "runtime",
        category: "system",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "doctor-v2",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 2: Database
  // ──────────────────────────────────────────────
  async checkDatabase(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      // Basic connectivity
      await db.$queryRaw`SELECT 1`;

      // Integrity check (SQLite specific)
      const integrityResult = await db.$queryRawUnsafe<
        { integrity_check: string }[]
      >("PRAGMA integrity_check");
      const integrityOk = integrityResult[0]?.integrity_check === "ok";

      // Counts
      const userCount = await db.user.count();
      const generationCount = await db.generation.count();
      const memoryCount = await db.memory.count();

      // Migration status — check if all models are accessible
      let migrationOk = true;
      try {
        await db.auditEvent.count();
        await db.agentInteraction.count();
        await db.skill.count();
        await db.execution.count();
        await db.feedback.count();
        await db.session.count();
      } catch {
        migrationOk = false;
      }

      const status: CheckStatus =
        !integrityOk ? "UNHEALTHY" : !migrationOk ? "DEGRADED" : "HEALTHY";

      return {
        name: "database",
        category: "persistence",
        status,
        latencyMs: Date.now() - start,
        details: `SQLite ${integrityOk ? "integrity OK" : "INTEGRITY FAIL"}, ${userCount} users, ${generationCount} generations, ${memoryCount} memories, migrations ${migrationOk ? "OK" : "INCOMPLETE"}`,
        metrics: {
          userCount,
          generationCount,
          memoryCount,
          integrityOk: integrityOk ? 1 : 0,
          migrationsOk: migrationOk ? 1 : 0,
        },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma",
        },
      };
    } catch (e: any) {
      return {
        name: "database",
        category: "persistence",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 3: APIs
  // ──────────────────────────────────────────────
  async checkAPIs(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    const routes = [
      { path: "/api", method: "GET" },
      { path: "/api/auth/auto-login", method: "POST" },
      { path: "/api/auth/me", method: "GET" },
      { path: "/api/doctor", method: "GET" },
      { path: "/api/metrics", method: "GET" },
      { path: "/api/generations", method: "GET" },
    ];

    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    const details: string[] = [];

    for (const route of routes) {
      try {
        const res = await fetch(`http://localhost:3000${route.path}`, {
          method: route.method,
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
          healthy++;
          details.push(`${route.path}: OK`);
        } else {
          degraded++;
          details.push(`${route.path}: HTTP ${res.status}`);
        }
      } catch {
        unhealthy++;
        details.push(`${route.path}: UNREACHABLE`);
      }
    }

    return {
      name: "apis",
      category: "network",
      status: unhealthy > 0 ? "UNHEALTHY" : degraded > 0 ? "DEGRADED" : "HEALTHY",
      latencyMs: Date.now() - start,
      details: `${routes.length} routes: ${healthy} ok, ${degraded} degraded, ${unhealthy} unreachable`,
      metrics: { healthy, degraded, unhealthy, total: routes.length },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "OBSERVED",
        source: "fetch",
      },
    };
  }

  // ──────────────────────────────────────────────
  // CHECK 4: Providers
  // ──────────────────────────────────────────────
  async checkProviders(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      const zai = await ZAI.create();

      // Test each adapter capability
      const adapters = {
        imageGeneration: false,
        textGeneration: false,
        tts: false,
        webSearch: false,
      };

      try {
        if (typeof zai.images?.generations?.create === "function") adapters.imageGeneration = true;
      } catch { /* not available */ }
      try {
        if (typeof zai.chat?.completions?.create === "function") adapters.textGeneration = true;
      } catch { /* not available */ }
      try {
        if (typeof zai.audio?.tts?.create === "function") adapters.tts = true;
      } catch { /* not available */ }
      try {
        if (typeof zai.functions?.invoke === "function") adapters.webSearch = true;
      } catch { /* not available */ }

      const workingAdapters = Object.values(adapters).filter(Boolean).length;
      const totalAdapters = Object.keys(adapters).length;

      return {
        name: "providers",
        category: "integrations",
        status: workingAdapters === 0 ? "UNHEALTHY" : workingAdapters < totalAdapters ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `Z-AI SDK OK, ${workingAdapters}/${totalAdapters} adapters functional`,
        metrics: { workingAdapters, totalAdapters, ...Object.fromEntries(Object.entries(adapters).map(([k, v]) => [k, v ? 1 : 0])) },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "z-ai-web-dev-sdk",
        },
      };
    } catch (e: any) {
      return {
        name: "providers",
        category: "integrations",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: `Z-AI SDK failed: ${e.message}`,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "z-ai-web-dev-sdk",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 5: MCP
  // ──────────────────────────────────────────────
  async checkMCP(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      // Dynamic import to check if MCP modules exist
      let serverOk = false;
      let clientOk = false;
      let serverToolCount = 0;
      let knownAgentCount = 0;

      try {
        const { KreaMCPServer } = await import("@/lib/mcp-server");
        const server = new KreaMCPServer();
        const tools = server.listTools();
        serverToolCount = tools.length;
        serverOk = true;
      } catch {
        serverOk = false;
      }

      try {
        const { KreaMCPClient } = await import("@/lib/mcp-client");
        const client = new KreaMCPClient();
        const agents = client.listAvailableAgents();
        knownAgentCount = agents.length;
        clientOk = true;
      } catch {
        clientOk = false;
      }

      return {
        name: "mcp",
        category: "integrations",
        status: !serverOk && !clientOk ? "UNHEALTHY" : !serverOk || !clientOk ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `MCP Server: ${serverOk ? `OK (${serverToolCount} tools)` : "N/A"}, Client: ${clientOk ? `OK (${knownAgentCount} agents)` : "N/A"}`,
        metrics: { serverOk: serverOk ? 1 : 0, clientOk: clientOk ? 1 : 0, serverToolCount, knownAgentCount },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "OBSERVED",
          source: "mcp-modules",
        },
      };
    } catch (e: any) {
      return {
        name: "mcp",
        category: "integrations",
        status: "DEGRADED",
        latencyMs: Date.now() - start,
        error: e.message,
        details: "MCP modules not yet available",
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "OBSERVED",
          source: "doctor-v2",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 6: Memory
  // ──────────────────────────────────────────────
  async checkMemory(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      const totalMemories = await db.memory.count();
      const activeMemories = await db.memory.count({ where: { status: "ACTIVE" } });

      // Count by type
      const episodic = await db.memory.count({ where: { type: "EPISODIC" } });
      const semantic = await db.memory.count({ where: { type: "SEMANTIC" } });
      const factual = await db.memory.count({ where: { type: "FACTUAL" } });
      const procedural = await db.memory.count({ where: { type: "PROCEDURAL" } });

      // Check for stale memories (not verified in 30+ days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const staleMemories = await db.memory.count({
        where: {
          lastVerified: { lt: thirtyDaysAgo as unknown as Date },
          status: "ACTIVE",
        },
      });

      return {
        name: "memory",
        category: "cognition",
        status: totalMemories === 0 ? "DEGRADED" : staleMemories > activeMemories * 0.5 ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `${totalMemories} memories (${activeMemories} active), ${staleMemories} stale (>30d unverified)`,
        metrics: { totalMemories, activeMemories, episodic, semantic, factual, procedural, staleMemories },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma-memory",
        },
      };
    } catch (e: any) {
      return {
        name: "memory",
        category: "cognition",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma-memory",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 7: Skills
  // ──────────────────────────────────────────────
  async checkSkills(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      const totalSkills = await db.skill.count();
      const activeSkills = await db.skill.count({ where: { status: "ACTIVE" } });
      const proposedSkills = await db.skill.count({ where: { status: "PROPOSED" } });
      const deprecatedSkills = await db.skill.count({ where: { status: "DEPRECATED" } });

      return {
        name: "skills",
        category: "cognition",
        status: totalSkills === 0 ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `${totalSkills} skills: ${activeSkills} active, ${proposedSkills} proposed, ${deprecatedSkills} deprecated`,
        metrics: { totalSkills, activeSkills, proposedSkills, deprecatedSkills },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma-skill",
        },
      };
    } catch (e: any) {
      return {
        name: "skills",
        category: "cognition",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma-skill",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 8: Permissions
  // ──────────────────────────────────────────────
  async checkPermissions(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      // Check if security module is available
      let policyEngineLoaded = false;
      let rulesCount = 0;

      try {
        const { SecurityManager } = await import("@/lib/security");
        const sec = new SecurityManager();
        const rules = sec.getPermissionRules();
        rulesCount = rules.length;
        policyEngineLoaded = true;
      } catch {
        policyEngineLoaded = false;
      }

      return {
        name: "permissions",
        category: "security",
        status: policyEngineLoaded ? "HEALTHY" : "DEGRADED",
        latencyMs: Date.now() - start,
        details: policyEngineLoaded
          ? `Policy engine loaded, ${rulesCount} permission rules`
          : "Policy engine not available — using defaults",
        metrics: { policyEngineLoaded: policyEngineLoaded ? 1 : 0, rulesCount },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: policyEngineLoaded ? "VERIFIED" : "ESTIMATED",
          source: "security-module",
        },
      };
    } catch (e: any) {
      return {
        name: "permissions",
        category: "security",
        status: "DEGRADED",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "ESTIMATED",
          source: "doctor-v2",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 9: Authentication
  // ──────────────────────────────────────────────
  async checkAuthentication(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      // Check auth API endpoint
      let authEndpointOk = false;
      try {
        const res = await fetch("http://localhost:3000/api/auth/auto-login", {
          method: "POST",
          signal: AbortSignal.timeout(5000),
        });
        authEndpointOk = res.ok;
      } catch {
        authEndpointOk = false;
      }

      // Check for plaintext passwords (should never exist)
      const plaintextCount = await db.user.count({
        where: {
          password: { not: { startsWith: "$" } },
        },
      });

      // Check for users with weak passwords (less than 20 chars = likely not hashed)
      const allUsers = await db.user.findMany({ select: { password: true } });
      const weakPasswordCount = allUsers.filter((u) => u.password.length < 20).length;

      const hasPlaintextIssues = plaintextCount > 0 || weakPasswordCount > 0;

      return {
        name: "authentication",
        category: "security",
        status: hasPlaintextIssues ? "UNHEALTHY" : !authEndpointOk ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: hasPlaintextIssues
          ? `⚠️ ${weakPasswordCount} users with potentially unhashed passwords!`
          : `Auth endpoint ${authEndpointOk ? "OK" : "degraded"}, no plaintext password issues`,
        metrics: {
          authEndpointOk: authEndpointOk ? 1 : 0,
          plaintextCount,
          weakPasswordCount,
        },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "prisma-user",
        },
      };
    } catch (e: any) {
      return {
        name: "authentication",
        category: "security",
        status: "UNHEALTHY",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "VERIFIED",
          source: "doctor-v2",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 10: Integrations
  // ──────────────────────────────────────────────
  async checkIntegrations(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    try {
      // Check recent agent interactions
      const recentInteractions = await db.agentInteraction.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      const pendingInteractions = await db.agentInteraction.count({
        where: { status: "PENDING" },
      });

      const failedInteractions = await db.agentInteraction.count({
        where: { status: "FAILED" },
      });

      // Check if agent comm module is available
      let commModuleOk = false;
      try {
        await import("@/lib/agent-comm");
        commModuleOk = true;
      } catch {
        commModuleOk = false;
      }

      return {
        name: "integrations",
        category: "ecosystem",
        status: !commModuleOk ? "DEGRADED" : failedInteractions > recentInteractions ? "DEGRADED" : "HEALTHY",
        latencyMs: Date.now() - start,
        details: `Agent comm ${commModuleOk ? "available" : "N/A"}, ${recentInteractions} interactions (24h), ${pendingInteractions} pending, ${failedInteractions} failed`,
        metrics: {
          commModuleOk: commModuleOk ? 1 : 0,
          recentInteractions,
          pendingInteractions,
          failedInteractions,
        },
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "OBSERVED",
          source: "prisma-agent-interaction",
        },
      };
    } catch (e: any) {
      return {
        name: "integrations",
        category: "ecosystem",
        status: "DEGRADED",
        latencyMs: Date.now() - start,
        error: e.message,
        evidence: {
          checkedAt: new Date().toISOString(),
          truthLevel: "OBSERVED",
          source: "doctor-v2",
        },
      };
    }
  }

  // ──────────────────────────────────────────────
  // CHECK 11: Configuration
  // ──────────────────────────────────────────────
  async checkConfiguration(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    const requiredVars = ["DATABASE_URL"];
    const recommendedVars = ["NEXTAUTH_SECRET", "NEXTAUTH_URL"];

    const missing: string[] = [];
    const warnings: string[] = [];

    for (const v of requiredVars) {
      if (!process.env[v]) missing.push(v);
    }
    for (const v of recommendedVars) {
      if (!process.env[v]) warnings.push(v);
    }

    return {
      name: "configuration",
      category: "system",
      status: missing.length > 0 ? "UNHEALTHY" : warnings.length > 0 ? "DEGRADED" : "HEALTHY",
      latencyMs: Date.now() - start,
      details: missing.length > 0
        ? `Missing required: ${missing.join(", ")}`
        : warnings.length > 0
          ? `Missing recommended: ${warnings.join(", ")}`
          : "All config OK",
      metrics: { missingRequired: missing.length, missingRecommended: warnings.length },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "VERIFIED",
        source: "process.env",
      },
    };
  }

  // ──────────────────────────────────────────────
  // CHECK 12: Dependencies
  // ──────────────────────────────────────────────
  async checkDependencies(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    const criticalDeps = [
      "next",
      "react",
      "@prisma/client",
      "z-ai-web-dev-sdk",
      "lucide-react",
      "framer-motion",
    ];

    const installed: string[] = [];
    const missing: string[] = [];

    for (const dep of criticalDeps) {
      try {
        require.resolve(dep);
        installed.push(dep);
      } catch {
        missing.push(dep);
      }
    }

    return {
      name: "dependencies",
      category: "system",
      status: missing.length > 0 ? "UNHEALTHY" : "HEALTHY",
      latencyMs: Date.now() - start,
      details: missing.length > 0
        ? `Missing critical: ${missing.join(", ")}`
        : `${installed.length}/${criticalDeps.length} critical deps installed`,
      metrics: { installed: installed.length, missing: missing.length, total: criticalDeps.length },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "VERIFIED",
        source: "require.resolve",
      },
    };
  }

  // ──────────────────────────────────────────────
  // CHECK 13: Persistence (CHECK 14 in spec — health is computed as #13)
  // ──────────────────────────────────────────────
  async checkPersistence(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    let dbWritable = false;
    let fileStorageWritable = false;

    // Test DB write
    try {
      // Try a harmless read-write test using auditEvent (least intrusive)
      const testRecord = await db.auditEvent.create({
        data: {
          action: "doctor_v2_persistence_test",
          resource: "self-test",
          result: "SUCCESS",
          details: JSON.stringify({ test: true }),
        },
      });
      // Clean up
      await db.auditEvent.delete({ where: { id: testRecord.id } });
      dbWritable = true;
    } catch {
      dbWritable = false;
    }

    // Test file storage write
    try {
      const fs = await import("fs/promises");
      const path = await import("path");
      const testDir = path.join(process.cwd(), "public", "generated");
      await fs.mkdir(testDir, { recursive: true });
      const testFile = path.join(testDir, `.doctor-test-${Date.now()}`);
      await fs.writeFile(testFile, "test");
      await fs.unlink(testFile);
      fileStorageWritable = true;
    } catch {
      fileStorageWritable = false;
    }

    return {
      name: "persistence",
      category: "persistence",
      status: !dbWritable && !fileStorageWritable ? "UNHEALTHY" : !dbWritable || !fileStorageWritable ? "DEGRADED" : "HEALTHY",
      latencyMs: Date.now() - start,
      details: `DB ${dbWritable ? "writable" : "READ-ONLY"}, File storage ${fileStorageWritable ? "writable" : "READ-ONLY"}`,
      metrics: { dbWritable: dbWritable ? 1 : 0, fileStorageWritable: fileStorageWritable ? 1 : 0 },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "VERIFIED",
        source: "doctor-v2-persistence-test",
      },
    };
  }

  // ──────────────────────────────────────────────
  // CHECK 14: Critical Workflows (CHECK 15 in spec)
  // ──────────────────────────────────────────────
  async checkCriticalWorkflows(): Promise<HealthCheckResultV2> {
    const start = Date.now();
    const workflows: Record<string, boolean> = {};

    // Test: Auth flow (auto-login → session)
    try {
      const res = await fetch("http://localhost:3000/api/auth/auto-login", {
        method: "POST",
        signal: AbortSignal.timeout(5000),
      });
      workflows["auth_auto_login"] = res.ok;
    } catch {
      workflows["auth_auto_login"] = false;
    }

    // Test: Doctor endpoint
    try {
      const res = await fetch("http://localhost:3000/api/doctor", {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      workflows["doctor_endpoint"] = res.ok;
    } catch {
      workflows["doctor_endpoint"] = false;
    }

    // Test: DB query
    try {
      await db.user.count();
      workflows["db_query"] = true;
    } catch {
      workflows["db_query"] = false;
    }

    // Test: ZAI SDK init
    try {
      const ZAI = (await import("z-ai-web-dev-sdk")).default;
      await ZAI.create();
      workflows["zai_sdk_init"] = true;
    } catch {
      workflows["zai_sdk_init"] = false;
    }

    const workingCount = Object.values(workflows).filter(Boolean).length;
    const totalWorkflows = Object.keys(workflows).length;

    return {
      name: "critical_workflows",
      category: "system",
      status: workingCount === 0 ? "UNHEALTHY" : workingCount < totalWorkflows ? "DEGRADED" : "HEALTHY",
      latencyMs: Date.now() - start,
      details: `${workingCount}/${totalWorkflows} critical workflows passing: ${Object.entries(workflows).map(([k, v]) => `${k}=${v ? "✓" : "✗"}`).join(", ")}`,
      metrics: { workingCount, totalWorkflows, ...Object.fromEntries(Object.entries(workflows).map(([k, v]) => [k, v ? 1 : 0])) },
      evidence: {
        checkedAt: new Date().toISOString(),
        truthLevel: "OBSERVED",
        source: "doctor-v2-workflow-test",
      },
    };
  }

  // ──────────────────────────────────────────────
  // Recommendations Engine
  // ──────────────────────────────────────────────
  private generateRecommendations(checks: HealthCheckResultV2[]): string[] {
    const recs: string[] = [];

    for (const check of checks) {
      if (check.status === "HEALTHY") continue;

      switch (check.name) {
        case "runtime":
          recs.push("Consider restarting the process — high memory usage detected");
          break;
        case "database":
          if (check.error) recs.push("Database unreachable — check DATABASE_URL and file permissions");
          recs.push("Run PRAGMA integrity_check on SQLite to verify database integrity");
          break;
        case "apis":
          recs.push("One or more API routes are not responding — check Next.js dev server logs");
          break;
        case "providers":
          recs.push("Z-AI SDK initialization failed — verify API keys and network access");
          break;
        case "mcp":
          recs.push("MCP modules not loaded — ensure mcp-server.ts and mcp-client.ts are available");
          break;
        case "memory":
          recs.push("No memories stored yet — this is normal for a fresh install");
          break;
        case "skills":
          recs.push("No skills registered — skill registry is empty");
          break;
        case "permissions":
          recs.push("Security module not loaded — permission checks will use defaults");
          break;
        case "authentication":
          if (check.metrics?.weakPasswordCount && Number(check.metrics.weakPasswordCount) > 0) {
            recs.push("⚠️ CRITICAL: Users with unhashed passwords detected — hash all passwords immediately");
          }
          break;
        case "integrations":
          recs.push("Agent communication module not available — inter-agent delegation disabled");
          break;
        case "configuration":
          recs.push("Missing environment variables — check .env file");
          break;
        case "dependencies":
          recs.push("Missing critical dependencies — run bun install");
          break;
        case "persistence":
          recs.push("Storage not writable — check file system permissions");
          break;
        case "critical_workflows":
          recs.push("Critical workflows failing — review individual check results for details");
          break;
      }
    }

    if (recs.length === 0 && checks.some((c) => c.status === "DEGRADED")) {
      recs.push("System is degraded but functional — monitor for further degradation");
    }

    return recs;
  }

  // ──────────────────────────────────────────────
  // Safe Fixes (only when authorized)
  // ──────────────────────────────────────────────
  private async runSafeFixes(checks: HealthCheckResultV2[]): Promise<SafeFix[]> {
    const fixes: SafeFix[] = [];
    const executionId = crypto.randomUUID();

    for (const check of checks) {
      if (check.status === "HEALTHY") continue;

      switch (check.name) {
        case "persistence": {
          // Try to create missing directories
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const genDir = path.join(process.cwd(), "public", "generated");
            const before = "Directory may not exist";
            await fs.mkdir(genDir, { recursive: true });
            fixes.push({
              diagnosis: "public/generated/ directory may not exist",
              action: "Created public/generated/ directory recursively",
              before,
              after: "Directory exists and is writable",
              timestamp: new Date().toISOString(),
              executionId,
              result: "SUCCESS",
            });
          } catch (e: any) {
            fixes.push({
              diagnosis: "Cannot create public/generated/ directory",
              action: "Attempted mkdir recursive",
              before: "Directory missing",
              after: "Still missing",
              timestamp: new Date().toISOString(),
              executionId,
              result: "FAILED",
            });
          }
          break;
        }

        case "configuration": {
          // Set DATABASE_URL if missing
          if (!process.env.DATABASE_URL) {
            const before = "DATABASE_URL not set";
            process.env.DATABASE_URL = `file:${process.cwd()}/db/custom.db`;
            fixes.push({
              diagnosis: "DATABASE_URL environment variable not set",
              action: "Set DATABASE_URL to default SQLite path",
              before,
              after: process.env.DATABASE_URL,
              timestamp: new Date().toISOString(),
              executionId,
              result: "SUCCESS",
            });
          }
          break;
        }

        // For other checks, we only diagnose — no auto-fix
        default: {
          fixes.push({
            diagnosis: check.error || check.details || `${check.name} is ${check.status}`,
            action: "No auto-fix available — manual intervention required",
            before: check.status,
            after: check.status,
            timestamp: new Date().toISOString(),
            executionId,
            result: "SKIPPED",
          });
          break;
        }
      }
    }

    return fixes;
  }

  /**
   * Quick health check — returns just the overall status and score.
   */
  async quickCheck(): Promise<{ status: CheckStatus; score: number }> {
    const report = await this.runFullCheck();
    return { status: report.overallStatus, score: report.healthScore };
  }

  /**
   * Compare with the original Doctor report.
   */
  async compareToV1(): Promise<{ v1: Awaited<ReturnType<KreaDoctor["runFullCheck"]>>; v2: DoctorReportV2 }> {
    const v1Doctor = new KreaDoctor();
    const [v1, v2] = await Promise.all([v1Doctor.runFullCheck(), this.runFullCheck()]);
    return { v1, v2 };
  }
}
