/**
 * Event Contract — ADN GENERAL DEL AGENTE V1.0
 *
 * Defines the event system for decoupled, traceable communication
 * within the agent and across the ecosystem. Events are the backbone
 * of the reactive architecture: capabilities emit events, and other
 * capabilities or agents can subscribe and react.
 *
 * Every event is traceable (has execution_id, correlation_id, evidence),
 * and carries its own priority and status for processing guarantees.
 */

import { randomUUID } from "crypto";

// ─── Event Types ─────────────────────────────────────────────────────────────

/** Base domain event types for AGENTE-KREA */
export type DomainEventType =
  // ── Detection Events ──────────────────────────────────────────────
  | "OPPORTUNITY_DETECTED"       // A business opportunity was identified
  | "PROBLEM_DETECTED"           // A problem or issue was detected
  | "SIGNAL_DETECTED"            // A market/behavioral signal was detected
  | "ANOMALY_DETECTED"           // An anomaly was detected in data/behavior

  // ── Generation Events ─────────────────────────────────────────────
  | "GENERATION_REQUESTED"       // A generation was requested
  | "GENERATION_STARTED"         // A generation execution started
  | "GENERATION_SUCCEEDED"       // A generation completed successfully
  | "GENERATION_FAILED"          // A generation failed
  | "GENERATION_REFUNDED"        // Credits were refunded for a failed generation

  // ── Product Events ────────────────────────────────────────────────
  | "PRODUCT_HYPOTHESIS_CREATED" // A new product/content hypothesis was created
  | "PRODUCT_VALIDATED"          // A hypothesis was validated
  | "PRODUCT_REJECTED"           // A hypothesis was rejected

  // ── Campaign Events ───────────────────────────────────────────────
  | "CAMPAIGN_METRICS_UPDATED"   // Campaign metrics were updated
  | "CAMPAIGN_MILESTONE_REACHED" // A campaign milestone was reached
  | "CAMPAIGN_ALERT_TRIGGERED"   // A campaign alert was triggered

  // ── Credit Events ─────────────────────────────────────────────────
  | "CREDITS_DEDUCTED"           // Credits were deducted from a user
  | "CREDITS_REFUNDED"           // Credits were refunded to a user
  | "CREDITS_LOW"                // User credits are running low
  | "CREDITS_EXHAUSTED"          // User has no credits remaining

  // ── Agent Lifecycle Events ────────────────────────────────────────
  | "AGENT_STARTED"             // Agent started up
  | "AGENT_STOPPED"             // Agent is shutting down
  | "AGENT_HEALTH_CHANGED"      // Agent health status changed
  | "AGENT_DEGRADED"            // Agent autonomy was degraded
  | "AGENT_PROMOTED"            // Agent autonomy was promoted

  // ── Communication Events ──────────────────────────────────────────
  | "AGENT_REQUEST_RECEIVED"    // Request received from another agent
  | "AGENT_RESPONSE_SENT"       // Response sent to another agent
  | "DELEGATION_REQUESTED"      // Task delegation was requested
  | "DELEGATION_COMPLETED"      // Delegated task completed

  // ── System Events ─────────────────────────────────────────────────
  | "POLICY_VIOLATION"          // A policy violation was detected
  | "APPROVAL_REQUESTED"        // An approval was requested
  | "APPROVAL_GRANTED"          // An approval was granted
  | "APPROVAL_DENIED"           // An approval was denied
  | "ERROR_OCCURRED"            // An error occurred

  // ── Custom ────────────────────────────────────────────────────────
  | "CUSTOM";                   // Custom event type

// ─── Event Priority ─────────────────────────────────────────────────────────

/** Priority of an event for processing ordering */
export type EventPriority = "critical" | "high" | "medium" | "low";

/** Numeric value for priority comparison */
export const EVENT_PRIORITY_VALUE: Record<EventPriority, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

// ─── Event Status ────────────────────────────────────────────────────────────

/** Processing status of an event */
export type EventStatus = "EMITTED" | "RECEIVED" | "PROCESSING" | "PROCESSED" | "FAILED" | "EXPIRED";

// ─── Event Definition ────────────────────────────────────────────────────────

/**
 * A single event in the event system.
 * Every event is traceable, typed, and carries evidence.
 */
export interface Event {
  /** Unique event identifier */
  eventId: string;

  /** Event type */
  eventType: DomainEventType;

  /** Custom event name (for CUSTOM type) */
  customType?: string;

  /** Agent that emitted this event */
  sourceAgent: string;

  /** Target agent (empty for broadcast) */
  targetAgent: string;

  /** ISO timestamp of emission */
  timestamp: string;

  /** Event payload — typed data specific to the event type */
  payload: Record<string, unknown>;

  /** Evidence IDs supporting this event */
  evidenceIds: string[];

  /** Execution ID this event belongs to */
  executionId?: string;

  /** Correlation ID for linking related events */
  correlationId?: string;

  /** Causation ID — the event that caused this event */
  causationId?: string;

  /** Priority for processing */
  priority: EventPriority;

  /** Current processing status */
  status: EventStatus;

  /** Time-to-live in ms (0 = no expiry) */
  ttlMs: number;

  /** Expiry timestamp */
  expiresAt?: string;

  /** Metadata */
  metadata?: Record<string, unknown>;
}

// ─── Event Handler ───────────────────────────────────────────────────────────

/** Function type for event handlers */
export type EventHandler = (event: Event) => Promise<void>;

/** Subscription record */
export interface EventSubscription {
  /** Subscription ID */
  subscriptionId: string;
  /** Event type to subscribe to (or * for all) */
  eventType: DomainEventType | "*";
  /** Source agent filter (or * for all) */
  sourceAgent: string;
  /** Handler function */
  handler: EventHandler;
  /** Whether this subscription is active */
  active: boolean;
  /** When the subscription was created */
  createdAt: string;
}

// ─── Event Bus ───────────────────────────────────────────────────────────────

/**
 * EventBus — Decoupled event emission and subscription system.
 * Events are processed asynchronously with priority ordering.
 * All events are traceable via execution and correlation IDs.
 */
export class EventBus {
  private subscriptions: Map<string, EventSubscription> = new Map();
  private eventLog: Event[] = [];
  private maxLogSize: number;
  private processing: boolean = false;
  private queue: Event[] = [];

  constructor(maxLogSize: number = 10000) {
    this.maxLogSize = maxLogSize;
  }

  /**
   * Subscribe to events of a specific type.
   * Returns a subscription ID that can be used to unsubscribe.
   */
  subscribe(
    eventType: DomainEventType | "*",
    handler: EventHandler,
    options?: {
      sourceAgent?: string;
    },
  ): string {
    const subscriptionId = randomUUID();
    const subscription: EventSubscription = {
      subscriptionId,
      eventType,
      sourceAgent: options?.sourceAgent || "*",
      handler,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscriptionId, subscription);
    return subscriptionId;
  }

  /**
   * Unsubscribe from events.
   */
  unsubscribe(subscriptionId: string): void {
    const sub = this.subscriptions.get(subscriptionId);
    if (sub) {
      sub.active = false;
    }
  }

  /**
   * Emit an event to the bus.
   * The event will be queued and processed asynchronously.
   */
  async emit(event: Omit<Event, "eventId" | "timestamp" | "status">): Promise<Event> {
    const fullEvent: Event = {
      ...event,
      eventId: randomUUID(),
      timestamp: new Date().toISOString(),
      status: "EMITTED",
    };

    // Set expiry if TTL is set
    if (fullEvent.ttlMs > 0) {
      fullEvent.expiresAt = new Date(Date.now() + fullEvent.ttlMs).toISOString();
    }

    // Log the event
    this.eventLog.push(fullEvent);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog = this.eventLog.slice(-this.maxLogSize);
    }

    // Queue for processing
    this.queue.push(fullEvent);
    this.queue.sort((a, b) => EVENT_PRIORITY_VALUE[b.priority] - EVENT_PRIORITY_VALUE[a.priority]);

    // Process the queue
    await this.processQueue();

    return fullEvent;
  }

  /**
   * Emit a simple event with minimal required fields.
   */
  async emitSimple(params: {
    eventType: DomainEventType;
    sourceAgent: string;
    targetAgent?: string;
    payload: Record<string, unknown>;
    priority?: EventPriority;
    executionId?: string;
    correlationId?: string;
    evidenceIds?: string[];
  }): Promise<Event> {
    return this.emit({
      eventType: params.eventType,
      sourceAgent: params.sourceAgent,
      targetAgent: params.targetAgent || "",
      payload: params.payload,
      evidenceIds: params.evidenceIds || [],
      executionId: params.executionId,
      correlationId: params.correlationId,
      priority: params.priority || "medium",
      ttlMs: 0,
    });
  }

  // ── Query Methods ─────────────────────────────────────────────────────

  /** Get events by type */
  getByType(eventType: DomainEventType): Event[] {
    return this.eventLog.filter((e) => e.eventType === eventType);
  }

  /** Get events by source agent */
  getBySource(sourceAgent: string): Event[] {
    return this.eventLog.filter((e) => e.sourceAgent === sourceAgent);
  }

  /** Get events by correlation ID */
  getByCorrelation(correlationId: string): Event[] {
    return this.eventLog.filter((e) => e.correlationId === correlationId);
  }

  /** Get events by execution ID */
  getByExecution(executionId: string): Event[] {
    return this.eventLog.filter((e) => e.executionId === executionId);
  }

  /** Get the full event log */
  getEventLog(limit?: number): Event[] {
    const log = [...this.eventLog];
    return limit ? log.slice(-limit) : log;
  }

  /** Get recent events */
  getRecent(count: number = 10): Event[] {
    return this.eventLog.slice(-count);
  }

  /** Get event statistics */
  getStats(): {
    totalEvents: number;
    byType: Partial<Record<DomainEventType, number>>;
    byPriority: Record<EventPriority, number>;
    byStatus: Record<EventStatus, number>;
    activeSubscriptions: number;
  } {
    const byType: Partial<Record<DomainEventType, number>> = {};
    const byPriority: Record<EventPriority, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    const byStatus: Record<EventStatus, number> = {
      EMITTED: 0, RECEIVED: 0, PROCESSING: 0, PROCESSED: 0, FAILED: 0, EXPIRED: 0,
    };

    for (const event of this.eventLog) {
      byType[event.eventType] = (byType[event.eventType] || 0) + 1;
      byPriority[event.priority]++;
      byStatus[event.status]++;
    }

    const activeSubscriptions = Array.from(this.subscriptions.values())
      .filter((s) => s.active).length;

    return {
      totalEvents: this.eventLog.length,
      byType,
      byPriority,
      byStatus,
      activeSubscriptions,
    };
  }

  // ── Private Methods ───────────────────────────────────────────────────

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;

      // Check if expired
      if (event.expiresAt && new Date(event.expiresAt) < new Date()) {
        event.status = "EXPIRED";
        continue;
      }

      event.status = "RECEIVED";

      // Find matching subscriptions
      const matchingSubs = Array.from(this.subscriptions.values()).filter(
        (sub) =>
          sub.active &&
          (sub.eventType === "*" || sub.eventType === event.eventType) &&
          (sub.sourceAgent === "*" || sub.sourceAgent === event.sourceAgent)
      );

      // Process each handler
      for (const sub of matchingSubs) {
        try {
          event.status = "PROCESSING";
          await sub.handler(event);
          event.status = "PROCESSED";
        } catch {
          event.status = "FAILED";
          // Continue processing other handlers even if one fails
        }
      }

      // If no handlers matched, mark as processed
      if (event.status === "RECEIVED") {
        event.status = "PROCESSED";
      }
    }

    this.processing = false;
  }
}

// ─── Event Builder ───────────────────────────────────────────────────────────

/**
 * Fluent builder for creating events.
 */
export class EventBuilder {
  private event: Partial<Event> = {};

  ofType(type: DomainEventType): this {
    this.event.eventType = type;
    return this;
  }

  fromSource(sourceAgent: string): this {
    this.event.sourceAgent = sourceAgent;
    return this;
  }

  toTarget(targetAgent: string): this {
    this.event.targetAgent = targetAgent;
    return this;
  }

  withPayload(payload: Record<string, unknown>): this {
    this.event.payload = payload;
    return this;
  }

  withPriority(priority: EventPriority): this {
    this.event.priority = priority;
    return this;
  }

  withExecutionId(executionId: string): this {
    this.event.executionId = executionId;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.event.correlationId = correlationId;
    return this;
  }

  withCausationId(causationId: string): this {
    this.event.causationId = causationId;
    return this;
  }

  withEvidence(evidenceIds: string[]): this {
    this.event.evidenceIds = evidenceIds;
    return this;
  }

  withTtl(ttlMs: number): this {
    this.event.ttlMs = ttlMs;
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): this {
    this.event.metadata = metadata;
    return this;
  }

  build(): Omit<Event, "eventId" | "timestamp" | "status"> {
    return {
      eventType: this.event.eventType || "CUSTOM",
      sourceAgent: this.event.sourceAgent || "krea",
      targetAgent: this.event.targetAgent || "",
      payload: this.event.payload || {},
      evidenceIds: this.event.evidenceIds || [],
      executionId: this.event.executionId,
      correlationId: this.event.correlationId,
      causationId: this.event.causationId,
      priority: this.event.priority || "medium",
      ttlMs: this.event.ttlMs || 0,
      metadata: this.event.metadata,
      customType: this.event.customType,
    };
  }
}
