import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { EventBus, EventBuilder, type DomainEventType, type EventPriority } from "@/contracts/event";
import { db } from "@/lib/db";

// Singleton event bus
const eventBus = new EventBus();

/**
 * GET /api/adn/events
 * List recent events (no auth required for reading).
 * Query params: type, source, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") as DomainEventType | undefined;
    const source = searchParams.get("source") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    let events;

    if (type) {
      events = eventBus.getByType(type);
    } else if (source) {
      events = eventBus.getBySource(source);
    } else {
      events = eventBus.getEventLog(limit);
    }

    // Also fetch persisted events from the audit log
    const auditEvents = await db.auditEvent.findMany({
      where: {
        action: { contains: "event" },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      events,
      auditEvents,
      stats: eventBus.getStats(),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing events";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/events
 * Emit an event (auth required).
 * Body: type, payload, target
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { type, payload, target } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Event type is required" },
        { status: 400 }
      );
    }

    const event = await eventBus.emitSimple({
      eventType: type as DomainEventType,
      sourceAgent: "krea",
      targetAgent: target || "",
      payload: payload || {},
      priority: "medium",
    });

    // Persist to audit log
    await db.auditEvent.create({
      data: {
        action: `event:${type}`,
        resource: `event:${event.eventId}`,
        userId: user.id,
        result: "SUCCESS",
        details: JSON.stringify({ type, target, eventId: event.eventId }),
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error emitting event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
