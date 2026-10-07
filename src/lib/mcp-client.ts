/**
 * KREA MCP Client — ADN GENERAL DEL AGENTE V1.0
 *
 * Consumes external capabilities from other agents in the ecosystem.
 * Separates WHAT KREA OFFERS (server) from WHAT KREA CONSUMES (client).
 *
 * No direct coupling — uses contracts, API calls, and events.
 *
 * Ecosystem agents:
 *   - CHISMOSO        — Competitive intelligence & market analysis
 *   - NEX-SCOPE       — Scope definition & project planning
 *   - YOUTUBE-AUTOMATION — YouTube content automation
 *   - CRM-ALBRA       — CRM & customer relationship management
 *   - AGENTE-LEADS    — Lead generation & qualification
 *   - RADAR-SECOP2    — Public procurement radar (SECOP2)
 *
 * Architecture: This client discovers agents, resolves their capabilities,
 * and requests tool execution via their MCP-exposed API endpoints.
 * Communication is decoupled — agents may be local or remote.
 */

import { db } from "@/lib/db";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface EcosystemAgent {
  id: string;
  name: string;
  description: string;
  endpoint: string; // Base URL or API path for communication
  status: "available" | "unavailable" | "unknown";
  capabilities: AgentCapability[];
  lastDiscoveredAt: string;
  contractVersion: string;
}

export interface AgentCapability {
  toolName: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  creditCost: number;
}

export interface ToolRequest {
  agentId: string;
  toolName: string;
  params: Record<string, unknown>;
  requestId: string;
  timeout?: number;
}

export interface ToolResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  agentId: string;
  toolName: string;
  requestId: string;
  latencyMs: number;
  evidence: {
    timestamp: string;
    source: string;
    truthLevel: "VERIFIED" | "OBSERVED" | "ESTIMATED";
  };
}

export interface DiscoveryResult {
  agentId: string;
  found: boolean;
  capabilities: AgentCapability[];
  latencyMs: number;
  error?: string;
}

// ──────────────────────────────────────────────
// Known Ecosystem Agents Registry
// ──────────────────────────────────────────────

const ECOSYSTEM_REGISTRY: EcosystemAgent[] = [
  {
    id: "chismoso",
    name: "CHISMOSO",
    description: "Competitive intelligence & market analysis agent. Provides competitor monitoring, market trends, and strategic insights.",
    endpoint: "/api/agents/chismoso",
    status: "unknown",
    capabilities: [
      {
        toolName: "chismoso_analyze_competitors",
        description: "Analyze competitors in a given market/industry",
        inputSchema: { industry: { type: "string" }, region: { type: "string" } },
        outputSchema: { analysis: { type: "object" } },
        creditCost: 3,
      },
      {
        toolName: "chismoso_market_trends",
        description: "Get current market trends and insights",
        inputSchema: { topic: { type: "string" }, timeframe: { type: "string" } },
        outputSchema: { trends: { type: "array" } },
        creditCost: 2,
      },
      {
        toolName: "chismoso_monitor_mentions",
        description: "Monitor brand/product mentions across sources",
        inputSchema: { keywords: { type: "array" }, sources: { type: "array" } },
        outputSchema: { mentions: { type: "array" } },
        creditCost: 2,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
  {
    id: "nex-scope",
    name: "NEX-SCOPE",
    description: "Scope definition & project planning agent. Helps define project boundaries, deliverables, and resource allocation.",
    endpoint: "/api/agents/nex-scope",
    status: "unknown",
    capabilities: [
      {
        toolName: "nexscope_define_scope",
        description: "Define project scope with deliverables and constraints",
        inputSchema: { projectDescription: { type: "string" }, objectives: { type: "array" } },
        outputSchema: { scope: { type: "object" } },
        creditCost: 3,
      },
      {
        toolName: "nexscope_estimate_resources",
        description: "Estimate resources needed for a project",
        inputSchema: { scope: { type: "object" }, timeline: { type: "string" } },
        outputSchema: { estimate: { type: "object" } },
        creditCost: 2,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
  {
    id: "youtube-automation",
    name: "YOUTUBE-AUTOMATION",
    description: "YouTube content automation agent. Manages video uploads, thumbnails, metadata, and channel optimization.",
    endpoint: "/api/agents/youtube-automation",
    status: "unknown",
    capabilities: [
      {
        toolName: "youtube_upload_video",
        description: "Upload and publish a video to YouTube",
        inputSchema: { videoUrl: { type: "string" }, title: { type: "string" }, description: { type: "string" } },
        outputSchema: { videoId: { type: "string" }, url: { type: "string" } },
        creditCost: 5,
      },
      {
        toolName: "youtube_generate_thumbnail",
        description: "Generate optimized thumbnail for a video",
        inputSchema: { videoId: { type: "string" }, style: { type: "string" } },
        outputSchema: { thumbnailUrl: { type: "string" } },
        creditCost: 3,
      },
      {
        toolName: "youtube_analytics",
        description: "Get channel/video analytics",
        inputSchema: { channelId: { type: "string" }, period: { type: "string" } },
        outputSchema: { analytics: { type: "object" } },
        creditCost: 1,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
  {
    id: "crm-albra",
    name: "CRM-ALBRA",
    description: "CRM & customer relationship management agent. Manages contacts, deals, pipelines, and customer interactions.",
    endpoint: "/api/agents/crm-albra",
    status: "unknown",
    capabilities: [
      {
        toolName: "crm_create_contact",
        description: "Create or update a contact in CRM",
        inputSchema: { name: { type: "string" }, email: { type: "string" }, company: { type: "string" } },
        outputSchema: { contactId: { type: "string" } },
        creditCost: 1,
      },
      {
        toolName: "crm_get_pipeline",
        description: "Get sales pipeline status",
        inputSchema: { pipelineId: { type: "string" } },
        outputSchema: { pipeline: { type: "object" } },
        creditCost: 1,
      },
      {
        toolName: "crm_create_deal",
        description: "Create a deal/opportunity in the pipeline",
        inputSchema: { contactId: { type: "string" }, value: { type: "number" }, stage: { type: "string" } },
        outputSchema: { dealId: { type: "string" } },
        creditCost: 2,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
  {
    id: "agente-leads",
    name: "AGENTE-LEADS",
    description: "Lead generation & qualification agent. Finds, scores, and qualifies potential leads from various sources.",
    endpoint: "/api/agents/agente-leads",
    status: "unknown",
    capabilities: [
      {
        toolName: "leads_search",
        description: "Search for leads matching criteria",
        inputSchema: { criteria: { type: "object" }, sources: { type: "array" } },
        outputSchema: { leads: { type: "array" } },
        creditCost: 3,
      },
      {
        toolName: "leads_qualify",
        description: "Score and qualify a lead",
        inputSchema: { leadId: { type: "string" }, criteria: { type: "object" } },
        outputSchema: { score: { type: "number" }, qualification: { type: "string" } },
        creditCost: 2,
      },
      {
        toolName: "leads_enrich",
        description: "Enrich lead data with additional information",
        inputSchema: { leadId: { type: "string" } },
        outputSchema: { enrichedData: { type: "object" } },
        creditCost: 2,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
  {
    id: "radar-secop2",
    name: "RADAR-SECOP2",
    description: "Public procurement radar agent. Monitors SECOP2 (Colombian public procurement) for relevant opportunities.",
    endpoint: "/api/agents/radar-secop2",
    status: "unknown",
    capabilities: [
      {
        toolName: "radar_search_contracts",
        description: "Search public procurement contracts on SECOP2",
        inputSchema: { keywords: { type: "array" }, region: { type: "string" }, valueMin: { type: "number" } },
        outputSchema: { contracts: { type: "array" } },
        creditCost: 3,
      },
      {
        toolName: "radar_monitor_alerts",
        description: "Set up monitoring alerts for new procurement opportunities",
        inputSchema: { criteria: { type: "object" }, notifyEndpoint: { type: "string" } },
        outputSchema: { alertId: { type: "string" } },
        creditCost: 2,
      },
      {
        toolName: "radar_analyze_contract",
        description: "Analyze a specific procurement contract for fit",
        inputSchema: { contractId: { type: "string" }, profile: { type: "object" } },
        outputSchema: { analysis: { type: "object" }, fitScore: { type: "number" } },
        creditCost: 2,
      },
    ],
    lastDiscoveredAt: new Date().toISOString(),
    contractVersion: "1.0.0",
  },
];

// ──────────────────────────────────────────────
// KreaMCPClient
// ──────────────────────────────────────────────

export class KreaMCPClient {
  readonly name = "krea-mcp-client";
  readonly version = "1.0.0";

  // Runtime agent status cache
  private agentStatusCache = new Map<string, { status: EcosystemAgent["status"]; checkedAt: number }>();
  private cacheTTL = 5 * 60 * 1000; // 5 minutes

  /**
   * List all known ecosystem agents.
   */
  listAvailableAgents(): EcosystemAgent[] {
    return ECOSYSTEM_REGISTRY.map((agent) => ({
      ...agent,
      status: this.getCachedStatus(agent.id),
    }));
  }

  /**
   * Get a specific agent by ID.
   */
  getAgent(agentId: string): EcosystemAgent | undefined {
    const agent = ECOSYSTEM_REGISTRY.find((a) => a.id === agentId);
    if (!agent) return undefined;
    return { ...agent, status: this.getCachedStatus(agent.id) };
  }

  /**
   * Discover what capabilities an agent offers.
   * This performs a live check (if possible) or returns the registry data.
   */
  async discoverAgent(agentId: string): Promise<DiscoveryResult> {
    const start = Date.now();
    const agent = ECOSYSTEM_REGISTRY.find((a) => a.id === agentId);

    if (!agent) {
      return {
        agentId,
        found: false,
        capabilities: [],
        latencyMs: Date.now() - start,
        error: `Agent '${agentId}' not found in registry. Known: ${ECOSYSTEM_REGISTRY.map((a) => a.id).join(", ")}`,
      };
    }

    // Try to do a live capability discovery via the agent's endpoint
    try {
      const res = await fetch(`http://localhost:3000${agent.endpoint}/capabilities`, {
        method: "GET",
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = await res.json();
        const capabilities: AgentCapability[] = data.tools || data.capabilities || agent.capabilities;

        // Update status cache
        this.agentStatusCache.set(agentId, { status: "available", checkedAt: Date.now() });

        return {
          agentId,
          found: true,
          capabilities,
          latencyMs: Date.now() - start,
        };
      }

      // Agent endpoint returned non-OK — mark as unavailable but return registry data
      this.agentStatusCache.set(agentId, { status: "unavailable", checkedAt: Date.now() });

      return {
        agentId,
        found: true,
        capabilities: agent.capabilities,
        latencyMs: Date.now() - start,
      };
    } catch {
      // Network error — mark as unavailable but return registry data
      this.agentStatusCache.set(agentId, { status: "unavailable", checkedAt: Date.now() });

      return {
        agentId,
        found: true,
        capabilities: agent.capabilities,
        latencyMs: Date.now() - start,
      };
    }
  }

  /**
   * Request execution of a tool on another agent.
   * Communication is via API (decoupled — no direct function calls).
   */
  async requestTool(agentId: string, toolName: string, params: Record<string, unknown>, timeout?: number): Promise<ToolResponse> {
    const start = Date.now();
    const requestId = crypto.randomUUID();
    const agent = ECOSYSTEM_REGISTRY.find((a) => a.id === agentId);

    if (!agent) {
      return {
        success: false,
        error: `Agent '${agentId}' not found in registry`,
        agentId,
        toolName,
        requestId,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-client",
          truthLevel: "VERIFIED",
        },
      };
    }

    // Verify the tool exists in the agent's capabilities
    const capability = agent.capabilities.find((c) => c.toolName === toolName);
    if (!capability) {
      return {
        success: false,
        error: `Tool '${toolName}' not found on agent '${agentId}'. Available: ${agent.capabilities.map((c) => c.toolName).join(", ")}`,
        agentId,
        toolName,
        requestId,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-client",
          truthLevel: "VERIFIED",
        },
      };
    }

    // Log the outgoing request
    const interaction = await db.agentInteraction.create({
      data: {
        requesterAgent: "krea",
        targetAgent: agentId,
        objective: `Execute ${toolName}`,
        input: JSON.stringify(params),
        constraints: null,
        requestedOutput: JSON.stringify(capability.outputSchema),
        status: "SENT",
        correlationId: requestId,
      },
    });

    // Execute the tool call via the agent's API endpoint
    try {
      const res = await fetch(`http://localhost:3000${agent.endpoint}/tools/${toolName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...params, requestId }),
        signal: AbortSignal.timeout(timeout ?? 30000),
      });

      const data = await res.json();

      // Update interaction record
      await db.agentInteraction.update({
        where: { id: interaction.id },
        data: {
          status: res.ok ? "SUCCEEDED" : "FAILED",
          result: JSON.stringify(data),
          completedAt: new Date(),
        },
      });

      // Update agent status
      this.agentStatusCache.set(agentId, { status: "available", checkedAt: Date.now() });

      return {
        success: res.ok,
        data: res.ok ? data : undefined,
        error: res.ok ? undefined : data.error || `HTTP ${res.status}`,
        agentId,
        toolName,
        requestId,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: `agent:${agentId}`,
          truthLevel: "OBSERVED",
        },
      };
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      const isTimeout = e instanceof DOMException && e.name === "TimeoutError";

      // Update interaction record
      await db.agentInteraction.update({
        where: { id: interaction.id },
        data: {
          status: isTimeout ? "TIMEOUT" : "FAILED",
          result: JSON.stringify({ error: errorMessage, timedOut: isTimeout }),
          completedAt: new Date(),
        },
      });

      // Mark agent as potentially unavailable
      this.agentStatusCache.set(agentId, { status: "unavailable", checkedAt: Date.now() });

      return {
        success: false,
        error: isTimeout
          ? `Request to agent '${agentId}' timed out after ${timeout ?? 30000}ms`
          : `Failed to reach agent '${agentId}': ${errorMessage}`,
        agentId,
        toolName,
        requestId,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "krea-mcp-client",
          truthLevel: "OBSERVED",
        },
      };
    }
  }

  /**
   * Search for agents that can fulfill a specific capability.
   */
  findAgentsByCapability(toolName: string): EcosystemAgent[] {
    return ECOSYSTEM_REGISTRY.filter((agent) =>
      agent.capabilities.some((c) => c.toolName === toolName)
    ).map((agent) => ({
      ...agent,
      status: this.getCachedStatus(agent.id),
    }));
  }

  /**
   * Get the total cost of executing a tool (credits).
   */
  getToolCost(agentId: string, toolName: string): number {
    const agent = ECOSYSTEM_REGISTRY.find((a) => a.id === agentId);
    if (!agent) return 0;
    const cap = agent.capabilities.find((c) => c.toolName === toolName);
    return cap?.creditCost || 0;
  }

  /**
   * Bulk discover all agents — checks availability of each.
   */
  async discoverAll(): Promise<DiscoveryResult[]> {
    const results = await Promise.all(
      ECOSYSTEM_REGISTRY.map((agent) => this.discoverAgent(agent.id))
    );
    return results;
  }

  /**
   * Get ecosystem summary — which agents are available and their tool counts.
   */
  getEcosystemSummary(): {
    totalAgents: number;
    available: number;
    unavailable: number;
    unknown: number;
    totalCapabilities: number;
    agents: { id: string; name: string; status: string; toolCount: number }[];
  } {
    const agents = this.listAvailableAgents();
    const available = agents.filter((a) => a.status === "available").length;
    const unavailable = agents.filter((a) => a.status === "unavailable").length;
    const unknown = agents.filter((a) => a.status === "unknown").length;
    const totalCapabilities = agents.reduce((sum, a) => sum + a.capabilities.length, 0);

    return {
      totalAgents: agents.length,
      available,
      unavailable,
      unknown,
      totalCapabilities,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        toolCount: a.capabilities.length,
      })),
    };
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  private getCachedStatus(agentId: string): EcosystemAgent["status"] {
    const cached = this.agentStatusCache.get(agentId);
    if (!cached) return "unknown";
    if (Date.now() - cached.checkedAt > this.cacheTTL) return "unknown";
    return cached.status;
  }
}
