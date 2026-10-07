/**
 * KREA Agent Communication Manager — ADN GENERAL DEL AGENTE V1.0
 *
 * Manages agent-to-agent communication within the ecosystem.
 * Handles delegation, request/response, and interaction persistence.
 *
 * Principles:
 *   - Traceable: Every interaction is persisted in DB
 *   - Authenticated: Requests include authentication context
 *   - Validable: Responses are validated against expected schemas
 *   - Auditable: All interactions are logged via audit trail
 *   - Decoupled: Communication via contracts/API/events, not direct calls
 *
 * Delegation rules based on mission contract:
 *   - If a task is out_of_scope for KREA → delegate to appropriate agent
 *   - Delegation targets are determined by capability matching
 */

import { db } from "@/lib/db";
import { KreaMCPClient } from "@/lib/mcp-client";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type InteractionStatus = "PENDING" | "SENT" | "RECEIVED" | "SUCCEEDED" | "FAILED" | "TIMEOUT";

export interface AgentRequest {
  target: string;           // Target agent ID
  objective: string;        // What we want the agent to do
  input: Record<string, unknown>;  // Input data
  constraints?: Record<string, unknown>;  // Constraints/limitations
  expectedOutput?: Record<string, unknown>;  // Expected output schema
  timeout?: number;         // Timeout in ms
  priority?: "low" | "normal" | "high" | "critical";
  correlationId?: string;  // For tracking related interactions
}

export interface AgentResponse {
  interactionId: string;
  status: InteractionStatus;
  data?: unknown;
  error?: string;
  confidence: number;
  latencyMs: number;
  evidence: {
    timestamp: string;
    source: string;
    truthLevel: "VERIFIED" | "OBSERVED" | "ESTIMATED";
  };
}

export interface DelegationRule {
  taskPattern: RegExp;       // Regex pattern for task matching
  targetAgent: string;       // Agent to delegate to
  toolName: string;          // Tool to call on the target agent
  description: string;       // Human-readable description
  priority: "low" | "normal" | "high";
}

export interface DelegationResult {
  shouldDelegate: boolean;
  target?: string;
  tool?: string;
  reason: string;
}

// ──────────────────────────────────────────────
// Delegation Rules
// ──────────────────────────────────────────────

const DELEGATION_RULES: DelegationRule[] = [
  {
    taskPattern: /^(competitor|market|competitive)\s+(analysis|intelligence|research|monitor)/i,
    targetAgent: "chismoso",
    toolName: "chismoso_analyze_competitors",
    description: "Competitive analysis tasks → CHISMOSO",
    priority: "high",
  },
  {
    taskPattern: /^(market|industry)\s+(trends|insights|forecast)/i,
    targetAgent: "chismoso",
    toolName: "chismoso_market_trends",
    description: "Market trend analysis → CHISMOSO",
    priority: "normal",
  },
  {
    taskPattern: /^(scope|project)\s+(definition|planning|estimate)/i,
    targetAgent: "nex-scope",
    toolName: "nexscope_define_scope",
    description: "Project scope definition → NEX-SCOPE",
    priority: "high",
  },
  {
    taskPattern: /^(youtube|video)\s+(upload|publish|thumbnail|analytics)/i,
    targetAgent: "youtube-automation",
    toolName: "youtube_upload_video",
    description: "YouTube automation → YOUTUBE-AUTOMATION",
    priority: "normal",
  },
  {
    taskPattern: /^(contact|deal|pipeline|crm)\s+(create|update|get|manage)/i,
    targetAgent: "crm-albra",
    toolName: "crm_create_contact",
    description: "CRM operations → CRM-ALBRA",
    priority: "normal",
  },
  {
    taskPattern: /^(lead|prospect)\s+(search|find|qualify|enrich|generate)/i,
    targetAgent: "agente-leads",
    toolName: "leads_search",
    description: "Lead generation → AGENTE-LEADS",
    priority: "high",
  },
  {
    taskPattern: /^(secop|procurement|contract|public)\s+(search|monitor|analyze|alert)/i,
    targetAgent: "radar-secop2",
    toolName: "radar_search_contracts",
    description: "Public procurement → RADAR-SECOP2",
    priority: "high",
  },
];

// KREA's own scope — tasks that should NOT be delegated
const KREA_OWN_SCOPE = [
  /^(image|photo|picture|visual)\s+(generate|create|make)/i,
  /^(text|copy|content|ad)\s+(generate|create|write)/i,
  /^(voice|audio|tts|speech)\s+(generate|create|synthesize)/i,
  /^(ebook|book|document)\s+(generate|create|make)/i,
  /^(campaign|metrics|analytics)\s+(get|view|analyze)/i,
  /^(health|doctor|diagnostic|check)\s+(run|get|status)/i,
];

// ──────────────────────────────────────────────
// AgentCommManager
// ──────────────────────────────────────────────

export class AgentCommManager {
  readonly sourceAgent = "krea";
  private mcpClient = new KreaMCPClient();

  /**
   * Send a request to another agent.
   * Creates an AgentInteraction record and dispatches via MCP client.
   */
  async sendRequest(request: AgentRequest): Promise<AgentResponse> {
    const start = Date.now();
    const correlationId = request.correlationId || crypto.randomUUID();

    // 1. Create interaction record
    const interaction = await db.agentInteraction.create({
      data: {
        requesterAgent: this.sourceAgent,
        targetAgent: request.target,
        objective: request.objective,
        input: JSON.stringify(request.input),
        constraints: request.constraints ? JSON.stringify(request.constraints) : null,
        requestedOutput: request.expectedOutput ? JSON.stringify(request.expectedOutput) : null,
        status: "PENDING",
        correlationId,
      },
    });

    // 2. Log audit event
    await db.auditEvent.create({
      data: {
        action: "agent_comm_send",
        resource: `agent:${request.target}`,
        details: JSON.stringify({
          objective: request.objective,
          interactionId: interaction.id,
          correlationId,
        }),
        result: "SUCCESS",
      },
    });

    // 3. Update status to SENT
    await db.agentInteraction.update({
      where: { id: interaction.id },
      data: { status: "SENT" },
    });

    // 4. Find the appropriate tool to call on the target agent
    const targetAgent = this.mcpClient.getAgent(request.target);
    if (!targetAgent) {
      await db.agentInteraction.update({
        where: { id: interaction.id },
        data: {
          status: "FAILED",
          result: JSON.stringify({ error: `Unknown target agent: ${request.target}` }),
          completedAt: new Date(),
        },
      });

      return {
        interactionId: interaction.id,
        status: "FAILED",
        error: `Unknown target agent: ${request.target}`,
        confidence: 0,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "agent-comm",
          truthLevel: "VERIFIED",
        },
      };
    }

    // 5. Try to match a tool on the target agent
    const matchedTool = this.matchToolForObjective(request.objective, targetAgent.capabilities.map((c) => c.toolName));
    if (!matchedTool) {
      await db.agentInteraction.update({
        where: { id: interaction.id },
        data: {
          status: "FAILED",
          result: JSON.stringify({ error: `No matching tool on ${request.target} for objective: ${request.objective}` }),
          completedAt: new Date(),
        },
      });

      return {
        interactionId: interaction.id,
        status: "FAILED",
        error: `No matching tool on ${request.target} for: ${request.objective}`,
        confidence: 0,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "agent-comm",
          truthLevel: "ESTIMATED",
        },
      };
    }

    // 6. Execute via MCP client
    const toolResponse = await this.mcpClient.requestTool(
      request.target,
      matchedTool,
      request.input
    );

    // 7. Update interaction record with result
    const finalStatus: InteractionStatus = toolResponse.success ? "SUCCEEDED" : "FAILED";
    await db.agentInteraction.update({
      where: { id: interaction.id },
      data: {
        status: finalStatus,
        result: JSON.stringify(toolResponse.data || toolResponse.error),
        evidence: JSON.stringify(toolResponse.evidence),
        confidence: toolResponse.success ? 0.9 : 0.1,
        completedAt: new Date(),
      },
    });

    return {
      interactionId: interaction.id,
      status: finalStatus,
      data: toolResponse.data,
      error: toolResponse.error,
      confidence: toolResponse.success ? 0.9 : 0.1,
      latencyMs: Date.now() - start,
      evidence: toolResponse.evidence,
    };
  }

  /**
   * Handle a response from another agent.
   * Validates the response and updates the interaction record.
   */
  async handleResponse(interactionId: string, response: { data?: unknown; error?: string }): Promise<AgentResponse> {
    const start = Date.now();

    // Find the interaction
    const interaction = await db.agentInteraction.findUnique({
      where: { id: interactionId },
    });

    if (!interaction) {
      return {
        interactionId,
        status: "FAILED",
        error: `Interaction ${interactionId} not found`,
        confidence: 0,
        latencyMs: Date.now() - start,
        evidence: {
          timestamp: new Date().toISOString(),
          source: "agent-comm",
          truthLevel: "VERIFIED",
        },
      };
    }

    // Validate response against expected output schema (if defined)
    let validationResult = true;
    if (interaction.requestedOutput && response.data) {
      try {
        const expectedSchema = JSON.parse(interaction.requestedOutput);
        validationResult = this.validateResponse(response.data, expectedSchema);
      } catch {
        validationResult = true; // If we can't parse the schema, assume valid
      }
    }

    const status: InteractionStatus = response.error
      ? "FAILED"
      : validationResult
        ? "SUCCEEDED"
        : "RECEIVED"; // Received but not yet validated

    // Update interaction
    await db.agentInteraction.update({
      where: { id: interactionId },
      data: {
        status,
        result: JSON.stringify(response.data || response.error),
        confidence: status === "SUCCEEDED" ? 0.9 : 0.5,
        completedAt: new Date(),
      },
    });

    // Audit
    await db.auditEvent.create({
      data: {
        action: "agent_comm_response",
        resource: `agent:${interaction.targetAgent}`,
        details: JSON.stringify({
          interactionId,
          status,
          validationResult,
        }),
        result: status === "SUCCEEDED" ? "SUCCESS" : "FAILURE",
      },
    });

    return {
      interactionId,
      status,
      data: response.data,
      error: response.error,
      confidence: status === "SUCCEEDED" ? 0.9 : 0.5,
      latencyMs: Date.now() - start,
      evidence: {
        timestamp: new Date().toISOString(),
        source: `agent:${interaction.targetAgent}`,
        truthLevel: validationResult ? "VERIFIED" : "ESTIMATED",
      },
    };
  }

  /**
   * Check if a task should be delegated to another agent.
   */
  canDelegate(task: string): DelegationResult {
    // First check if the task is within KREA's own scope
    for (const pattern of KREA_OWN_SCOPE) {
      if (pattern.test(task)) {
        return {
          shouldDelegate: false,
          reason: `Task '${task}' is within KREA's own scope — handle internally`,
        };
      }
    }

    // Check delegation rules
    for (const rule of DELEGATION_RULES) {
      if (rule.taskPattern.test(task)) {
        return {
          shouldDelegate: true,
          target: rule.targetAgent,
          tool: rule.toolName,
          reason: rule.description,
        };
      }
    }

    // No matching rule — don't delegate
    return {
      shouldDelegate: false,
      reason: `No delegation rule matches task '${task}' — handle within KREA or reject`,
    };
  }

  /**
   * Get the best delegation target for a task.
   */
  getDelegationTarget(task: string): DelegationResult {
    return this.canDelegate(task);
  }

  /**
   * Auto-delegate a task if appropriate.
   * If delegation is warranted, sends the request automatically.
   */
  async autoDelegate(
    task: string,
    input: Record<string, unknown>,
    options?: { priority?: AgentRequest["priority"]; correlationId?: string }
  ): Promise<AgentResponse | null> {
    const delegation = this.canDelegate(task);

    if (!delegation.shouldDelegate || !delegation.target) {
      return null;
    }

    return this.sendRequest({
      target: delegation.target,
      objective: task,
      input,
      priority: options?.priority || "normal",
      correlationId: options?.correlationId,
    });
  }

  /**
   * Get interaction history for a given correlation ID or target agent.
   */
  async getHistory(options: {
    correlationId?: string;
    targetAgent?: string;
    status?: InteractionStatus;
    limit?: number;
  }): Promise<unknown[]> {
    const where: Record<string, unknown> = {
      requesterAgent: this.sourceAgent,
    };

    if (options.correlationId) where.correlationId = options.correlationId;
    if (options.targetAgent) where.targetAgent = options.targetAgent;
    if (options.status) where.status = options.status;

    const interactions = await db.agentInteraction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: options.limit || 50,
    });

    return interactions.map((i) => ({
      id: i.id,
      target: i.targetAgent,
      objective: i.objective,
      status: i.status,
      confidence: i.confidence,
      input: this.safeJsonParse(i.input),
      result: this.safeJsonParse(i.result),
      createdAt: i.createdAt,
      completedAt: i.completedAt,
    }));
  }

  /**
   * Get all delegation rules.
   */
  getDelegationRules(): DelegationRule[] {
    return [...DELEGATION_RULES];
  }

  /**
   * Get pending interactions that may have timed out.
   */
  async getTimedOutInteractions(timeoutMs: number = 60000): Promise<unknown[]> {
    const cutoff = new Date(Date.now() - timeoutMs);
    return db.agentInteraction.findMany({
      where: {
        requesterAgent: this.sourceAgent,
        status: { in: ["PENDING", "SENT"] },
        createdAt: { lt: cutoff },
      },
    });
  }

  /**
   * Mark timed-out interactions as TIMEOUT.
   */
  async cleanupTimedOut(timeoutMs: number = 60000): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutMs);
    const result = await db.agentInteraction.updateMany({
      where: {
        requesterAgent: this.sourceAgent,
        status: { in: ["PENDING", "SENT"] },
        createdAt: { lt: cutoff },
      },
      data: {
        status: "TIMEOUT",
        completedAt: new Date(),
      },
    });
    return result.count;
  }

  /**
   * Get communication stats.
   */
  async getStats(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    timedOut: number;
    byAgent: Record<string, number>;
  }> {
    const [total, succeeded, failed, pending, timedOut] = await Promise.all([
      db.agentInteraction.count({ where: { requesterAgent: this.sourceAgent } }),
      db.agentInteraction.count({ where: { requesterAgent: this.sourceAgent, status: "SUCCEEDED" } }),
      db.agentInteraction.count({ where: { requesterAgent: this.sourceAgent, status: "FAILED" } }),
      db.agentInteraction.count({ where: { requesterAgent: this.sourceAgent, status: { in: ["PENDING", "SENT"] } } }),
      db.agentInteraction.count({ where: { requesterAgent: this.sourceAgent, status: "TIMEOUT" } }),
    ]);

    // Count by target agent
    const allInteractions = await db.agentInteraction.findMany({
      where: { requesterAgent: this.sourceAgent },
      select: { targetAgent: true },
    });
    const byAgent: Record<string, number> = {};
    for (const i of allInteractions) {
      byAgent[i.targetAgent] = (byAgent[i.targetAgent] || 0) + 1;
    }

    return { total, succeeded, failed, pending, timedOut, byAgent };
  }

  // ──────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────

  /**
   * Match a tool on the target agent that best fits the objective.
   */
  private matchToolForObjective(objective: string, availableTools: string[]): string | null {
    if (availableTools.length === 0) return null;

    // Try to match by keyword in the objective
    const objLower = objective.toLowerCase();

    // First: exact match if the objective mentions a tool name
    for (const tool of availableTools) {
      if (objLower.includes(tool.toLowerCase())) return tool;
    }

    // Second: keyword-based matching
    const keywords: Record<string, string[]> = {
      "competitor": ["analyze", "chismoso"],
      "market": ["trends", "chismoso"],
      "scope": ["define", "nexscope"],
      "youtube": ["upload", "video"],
      "contact": ["create", "crm"],
      "deal": ["create", "crm"],
      "lead": ["search", "leads"],
      "procurement": ["search", "radar"],
      "secop": ["search", "radar"],
    };

    for (const [keyword, hints] of Object.entries(keywords)) {
      if (objLower.includes(keyword)) {
        // Find a tool that contains any of the hints
        for (const tool of availableTools) {
          for (const hint of hints) {
            if (tool.toLowerCase().includes(hint.toLowerCase())) return tool;
          }
        }
      }
    }

    // Fallback: return the first available tool
    return availableTools[0] || null;
  }

  /**
   * Validate response data against expected schema (basic).
   */
  private validateResponse(data: unknown, schema: Record<string, unknown>): boolean {
    if (!data || typeof data !== "object") return false;
    if (!schema || typeof schema !== "object") return true; // No schema = always valid

    // Basic validation: check if expected keys exist
    const dataObj = data as Record<string, unknown>;
    const schemaKeys = Object.keys(schema);
    if (schemaKeys.length === 0) return true;

    // At least some keys should match
    const matchingKeys = schemaKeys.filter((k) => k in dataObj);
    return matchingKeys.length > 0;
  }

  /**
   * Safe JSON parse — returns null on failure.
   */
  private safeJsonParse(str: string | null | undefined): unknown {
    if (!str) return null;
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
}
