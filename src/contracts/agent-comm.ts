/**
 * Agent Communication Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines how AGENTE-KREA communicates with other agents in the ALBRA ecosystem.
 * Every inter-agent communication is:
 * - Traceable: execution_id, correlation_id for full lineage
 * - Authenticated: requester identity is verified
 * - Validable: requests/responses conform to contracts
 * - Auditable: all communications are logged
 * - Decoupled: no direct coupling to other agent implementations
 *
 * Communication protocols:
 * - CONTRACT: Direct contract-based request/response
 * - MCP: Model Context Protocol for capability exchange
 * - API: RESTful API calls
 * - EVENT: Asynchronous event-based communication
 */

import { randomUUID } from "crypto";

// ─── Communication Protocol ──────────────────────────────────────────────────

/** Protocol used for inter-agent communication */
export type CommProtocol = "contract" | "mcp" | "api" | "event";

// ─── Request Priority ────────────────────────────────────────────────────────

/** Priority of a request */
export type RequestPriority = "critical" | "high" | "medium" | "low";

// ─── Request Status ──────────────────────────────────────────────────────────

/** Status of a request */
export type RequestStatus = "PENDING" | "SENT" | "RECEIVED" | "PROCESSING" | "COMPLETED" | "FAILED" | "TIMEOUT" | "REJECTED";

// ─── Response Status ─────────────────────────────────────────────────────────

/** Status of a response */
export type ResponseStatus = "SUCCESS" | "PARTIAL" | "FAILED" | "NOT_FOUND" | "UNAUTHORIZED" | "RATE_LIMITED" | "TIMEOUT" | "ERROR";

// ─── Constraint ──────────────────────────────────────────────────────────────

/** Constraint on a request (e.g., budget, time, quality) */
export interface RequestConstraint {
  /** Constraint name */
  name: string;
  /** Constraint type */
  type: "budget" | "time" | "quality" | "format" | "privacy" | "custom";
  /** Constraint value */
  value: unknown;
  /** Whether this constraint is strict (cannot be violated) or soft (best-effort) */
  strict: boolean;
  /** Description */
  description: string;
}

// ─── Agent Request ───────────────────────────────────────────────────────────

/**
 * A request from one agent to another.
 * This is the primary unit of inter-agent communication.
 */
export interface AgentRequest {
  /** Unique request identifier */
  requestId: string;

  /** Protocol used for this request */
  protocol: CommProtocol;

  /** Agent making the request */
  requester: string;

  /** Agent being requested */
  target: string;

  /** What is being requested (capability or operation) */
  objective: string;

  /** Input data for the request */
  input: Record<string, unknown>;

  /** Constraints on the request */
  constraints: RequestConstraint[];

  /** What format the requester expects the output in */
  requestedOutput: string;

  /** Priority of the request */
  priority: RequestPriority;

  /** Execution ID for tracing */
  executionId: string;

  /** Correlation ID for linking related communications */
  correlationId: string;

  /** Request timestamp */
  timestamp: string;

  /** Timeout in ms (0 = no timeout) */
  timeoutMs: number;

  /** Current status */
  status: RequestStatus;

  /** Evidence supporting this request */
  evidenceIds: string[];

  /** Whether a response is expected */
  expectsResponse: boolean;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ─── Agent Response ──────────────────────────────────────────────────────────

/**
 * A response from one agent to another.
 */
export interface AgentResponse {
  /** Response identifier */
  responseId: string;

  /** The request this responds to */
  requestId: string;

  /** Protocol used */
  protocol: CommProtocol;

  /** Agent sending the response */
  responder: string;

  /** Agent that made the request */
  requester: string;

  /** Response status */
  status: ResponseStatus;

  /** Result data */
  result: Record<string, unknown>;

  /** Evidence supporting the result */
  evidenceIds: string[];

  /** Confidence in the result (0-1) */
  confidence: number;

  /** Execution ID for tracing */
  executionId: string;

  /** Correlation ID */
  correlationId: string;

  /** Response timestamp */
  timestamp: string;

  /** Duration taken to process (ms) */
  durationMs: number;

  /** Warnings or caveats about the result */
  warnings: string[];

  /** Credits consumed by fulfilling this request */
  creditsConsumed: number;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ─── Communication Audit Record ──────────────────────────────────────────────

/** Audit record for inter-agent communication */
export interface CommAuditRecord {
  /** Audit ID */
  auditId: string;
  /** Request ID */
  requestId: string;
  /** Response ID (if response was sent) */
  responseId?: string;
  /** Protocol used */
  protocol: CommProtocol;
  /** Requester */
  requester: string;
  /** Target */
  target: string;
  /** Objective */
  objective: string;
  /** When request was sent */
  sentAt: string;
  /** When response was received */
  receivedAt?: string;
  /** Total duration */
  durationMs?: number;
  /** Whether communication succeeded */
  success: boolean;
  /** Error if failed */
  error?: string;
}

// ─── Agent Info ──────────────────────────────────────────────────────────────

/** Information about a known agent in the ecosystem */
export interface AgentInfo {
  /** Agent ID */
  agentId: string;
  /** Agent name */
  name: string;
  /** Communication endpoint (URL, path, or identifier) */
  endpoint: string;
  /** Supported protocols */
  protocols: CommProtocol[];
  /** Capabilities this agent offers */
  capabilities: string[];
  /** Whether the agent is currently available */
  available: boolean;
  /** Last health check */
  lastHealthCheck?: string;
  /** Typical response time in ms */
  avgResponseMs?: number;
}

// ─── Agent Communication Client ──────────────────────────────────────────────

/**
 * AgentCommClient — Client for sending requests to other agents.
 * Handles request construction, validation, tracing, and auditing.
 */
export class AgentCommClient {
  /** The agent ID of this client */
  private agentId: string;

  /** Known agents in the ecosystem */
  private knownAgents: Map<string, AgentInfo> = new Map();

  /** Audit log for all communications */
  private auditLog: CommAuditRecord[] = [];

  /** Pending requests awaiting response */
  private pendingRequests: Map<string, AgentRequest> = new Map();

  /** Maximum audit log size */
  private maxAuditSize: number;

  /** Custom transport handlers per protocol */
  private transportHandlers: Map<CommProtocol, (request: AgentRequest) => Promise<AgentResponse>> = new Map();

  constructor(agentId: string, maxAuditSize: number = 10000) {
    this.agentId = agentId;
    this.maxAuditSize = maxAuditSize;
  }

  /**
   * Register a known agent in the ecosystem.
   */
  registerAgent(info: AgentInfo): void {
    this.knownAgents.set(info.agentId, info);
  }

  /**
   * Register a transport handler for a protocol.
   * The handler is responsible for actually sending the request.
   */
  registerTransport(protocol: CommProtocol, handler: (request: AgentRequest) => Promise<AgentResponse>): void {
    this.transportHandlers.set(protocol, handler);
  }

  /**
   * Send a request to another agent.
   * Validates the target, constructs the request, and dispatches via the appropriate transport.
   */
  async sendRequest(params: {
    target: string;
    objective: string;
    input: Record<string, unknown>;
    protocol?: CommProtocol;
    constraints?: RequestConstraint[];
    requestedOutput?: string;
    priority?: RequestPriority;
    executionId?: string;
    correlationId?: string;
    timeoutMs?: number;
    evidenceIds?: string[];
    expectsResponse?: boolean;
  }): Promise<{ request: AgentRequest; response: AgentResponse | null }> {
    const targetInfo = this.knownAgents.get(params.target);

    // Validate target
    if (!targetInfo) {
      const request = this.createRequest(params, "contract");
      request.status = "REJECTED";
      return {
        request,
        response: this.createErrorResponse(request, "NOT_FOUND", `Unknown agent: ${params.target}`),
      };
    }

    if (!targetInfo.available) {
      const request = this.createRequest(params, params.protocol || "contract");
      request.status = "REJECTED";
      return {
        request,
        response: this.createErrorResponse(request, "UNAUTHORIZED", `Agent ${params.target} is not available`),
      };
    }

    // Determine protocol
    const protocol = params.protocol || this.determineProtocol(targetInfo, params.objective);

    // Validate protocol support
    if (!targetInfo.protocols.includes(protocol)) {
      const request = this.createRequest(params, protocol);
      request.status = "REJECTED";
      return {
        request,
        response: this.createErrorResponse(request, "ERROR", `Agent ${params.target} does not support protocol ${protocol}`),
      };
    }

    // Create the request
    const request = this.createRequest(params, protocol);
    request.status = "SENT";

    // Track pending request
    if (request.expectsResponse) {
      this.pendingRequests.set(request.requestId, request);
    }

    // Create audit record
    const audit: CommAuditRecord = {
      auditId: randomUUID(),
      requestId: request.requestId,
      protocol,
      requester: this.agentId,
      target: params.target,
      objective: params.objective,
      sentAt: new Date().toISOString(),
      success: false,
    };

    // Send via transport
    const transport = this.transportHandlers.get(protocol);
    if (!transport) {
      request.status = "FAILED";
      audit.error = `No transport handler for protocol ${protocol}`;
      this.recordAudit(audit);
      return {
        request,
        response: this.createErrorResponse(request, "ERROR", audit.error),
      };
    }

    try {
      const response = await transport(request);
      request.status = "COMPLETED";

      // Update audit
      audit.responseId = response.responseId;
      audit.receivedAt = new Date().toISOString();
      audit.durationMs = Date.now() - new Date(request.timestamp).getTime();
      audit.success = response.status === "SUCCESS" || response.status === "PARTIAL";

      // Remove from pending
      this.pendingRequests.delete(request.requestId);

      this.recordAudit(audit);
      return { request, response };
    } catch (error) {
      request.status = "FAILED";
      const errorMessage = error instanceof Error ? error.message : String(error);

      audit.error = errorMessage;
      audit.receivedAt = new Date().toISOString();
      audit.durationMs = Date.now() - new Date(request.timestamp).getTime();

      this.pendingRequests.delete(request.requestId);
      this.recordAudit(audit);

      return {
        request,
        response: this.createErrorResponse(request, "ERROR", errorMessage),
      };
    }
  }

  /**
   * Create a response to an incoming request.
   */
  createResponse(params: {
    request: AgentRequest;
    status: ResponseStatus;
    result: Record<string, unknown>;
    evidenceIds?: string[];
    confidence?: number;
    executionId?: string;
    warnings?: string[];
    creditsConsumed?: number;
  }): AgentResponse {
    const startedAt = new Date(params.request.timestamp).getTime();
    return {
      responseId: randomUUID(),
      requestId: params.request.requestId,
      protocol: params.request.protocol,
      responder: this.agentId,
      requester: params.request.requester,
      status: params.status,
      result: params.result,
      evidenceIds: params.evidenceIds || [],
      confidence: params.confidence ?? 1.0,
      executionId: params.executionId || params.request.executionId,
      correlationId: params.request.correlationId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      warnings: params.warnings || [],
      creditsConsumed: params.creditsConsumed || 0,
    };
  }

  // ── Query Methods ─────────────────────────────────────────────────────

  /** Get known agents */
  getKnownAgents(): AgentInfo[] {
    return Array.from(this.knownAgents.values());
  }

  /** Get a known agent by ID */
  getAgent(agentId: string): AgentInfo | undefined {
    return this.knownAgents.get(agentId);
  }

  /** Get audit log */
  getAuditLog(limit?: number): CommAuditRecord[] {
    const log = [...this.auditLog];
    return limit ? log.slice(-limit) : log;
  }

  /** Get audit records for a specific target */
  getAuditByTarget(target: string): CommAuditRecord[] {
    return this.auditLog.filter((a) => a.target === target);
  }

  /** Get pending requests */
  getPendingRequests(): AgentRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  /** Get communication stats */
  getStats(): {
    totalCommunications: number;
    successful: number;
    failed: number;
    byProtocol: Record<CommProtocol, number>;
    byTarget: Record<string, number>;
    pendingCount: number;
  } {
    const byProtocol: Record<CommProtocol, number> = { contract: 0, mcp: 0, api: 0, event: 0 };
    const byTarget: Record<string, number> = {};

    let successful = 0;
    let failed = 0;

    for (const audit of this.auditLog) {
      byProtocol[audit.protocol]++;
      byTarget[audit.target] = (byTarget[audit.target] || 0) + 1;
      if (audit.success) successful++;
      else failed++;
    }

    return {
      totalCommunications: this.auditLog.length,
      successful,
      failed,
      byProtocol,
      byTarget,
      pendingCount: this.pendingRequests.size,
    };
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  private createRequest(
    params: {
      target: string;
      objective: string;
      input: Record<string, unknown>;
      constraints?: RequestConstraint[];
      requestedOutput?: string;
      priority?: RequestPriority;
      executionId?: string;
      correlationId?: string;
      timeoutMs?: number;
      evidenceIds?: string[];
      expectsResponse?: boolean;
    },
    protocol: CommProtocol,
  ): AgentRequest {
    return {
      requestId: randomUUID(),
      protocol,
      requester: this.agentId,
      target: params.target,
      objective: params.objective,
      input: params.input,
      constraints: params.constraints || [],
      requestedOutput: params.requestedOutput || "any",
      priority: params.priority || "medium",
      executionId: params.executionId || randomUUID(),
      correlationId: params.correlationId || randomUUID(),
      timestamp: new Date().toISOString(),
      timeoutMs: params.timeoutMs || 30000,
      status: "PENDING",
      evidenceIds: params.evidenceIds || [],
      expectsResponse: params.expectsResponse !== false,
    };
  }

  private createErrorResponse(request: AgentRequest, status: ResponseStatus, error: string): AgentResponse {
    return {
      responseId: randomUUID(),
      requestId: request.requestId,
      protocol: request.protocol,
      responder: request.target,
      requester: request.requester,
      status,
      result: { error },
      evidenceIds: [],
      confidence: 0,
      executionId: request.executionId,
      correlationId: request.correlationId,
      timestamp: new Date().toISOString(),
      durationMs: 0,
      warnings: [error],
      creditsConsumed: 0,
    };
  }

  private determineProtocol(target: AgentInfo, objective: string): CommProtocol {
    // Prefer contract for direct requests
    if (target.protocols.includes("contract")) return "contract";
    // MCP for capability discovery/exchange
    if (target.protocols.includes("mcp") && objective.includes("capability")) return "mcp";
    // API for simple requests
    if (target.protocols.includes("api")) return "api";
    // Event for async/notification
    if (target.protocols.includes("event")) return "event";
    // Fallback to first available
    return target.protocols[0] || "api";
  }

  private recordAudit(audit: CommAuditRecord): void {
    this.auditLog.push(audit);
    if (this.auditLog.length > this.maxAuditSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditSize);
    }
  }
}

// ─── KREA Ecosystem Agents ───────────────────────────────────────────────────

/**
 * Known agents in the ALBRA ecosystem that KREA can communicate with.
 */
export const ALBRA_ECOSYSTEM_AGENTS: AgentInfo[] = [
  {
    agentId: "nex-scope",
    name: "NEX-SCOPE",
    endpoint: "/api/agent/nex-scope",
    protocols: ["contract", "event"],
    capabilities: ["research", "context_analysis", "data_analysis", "report_generation"],
    available: false, // Not yet integrated
  },
  {
    agentId: "youtube-automation",
    name: "YOUTUBE-AUTOMATION",
    endpoint: "/api/agent/youtube-automation",
    protocols: ["contract", "api"],
    capabilities: ["video_production", "audio_editing", "thumbnail_generation", "upload"],
    available: false,
  },
  {
    agentId: "agente-leads",
    name: "AGENTE-LEADS",
    endpoint: "/api/agent/agente-leads",
    protocols: ["contract", "event"],
    capabilities: ["lead_generation", "nurturing", "qualification", "crm_sync"],
    available: false,
  },
  {
    agentId: "chismoso",
    name: "CHISMOSO",
    endpoint: "/api/agent/chismoso",
    protocols: ["event", "api"],
    capabilities: ["trend_analysis", "signal_detection", "opportunity_alerts", "market_monitoring"],
    available: false,
  },
];

/**
 * Create the AgentCommClient for AGENTE-KREA.
 */
export function createKreaCommClient(): AgentCommClient {
  const client = new AgentCommClient("krea");

  for (const agent of ALBRA_ECOSYSTEM_AGENTS) {
    client.registerAgent(agent);
  }

  return client;
}
