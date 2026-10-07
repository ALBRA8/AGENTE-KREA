import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { AgentCommManager } from "@/lib/agent-comm";
import { db } from "@/lib/db";

const agentCommManager = new AgentCommManager();

/**
 * GET /api/adn/agent-comm
 * List agent interactions (no auth required for reading).
 * Query params: agent, status, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const agent = searchParams.get("agent") || undefined;
    const status = searchParams.get("status") as
      | "PENDING" | "SENT" | "RECEIVED" | "SUCCEEDED" | "FAILED" | "TIMEOUT"
      | undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    const interactions = await agentCommManager.getHistory({
      targetAgent: agent,
      status,
      limit,
    });

    return NextResponse.json({ interactions, total: interactions.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing agent interactions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/agent-comm
 * Send request to another agent (auth required).
 * Body: target, objective, input
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { target, objective, input } = body;

    if (!target || !objective) {
      return NextResponse.json(
        { error: "target and objective are required" },
        { status: 400 }
      );
    }

    const response = await agentCommManager.sendRequest({
      target,
      objective,
      input: input || {},
    });

    // Log audit event
    await db.auditEvent.create({
      data: {
        action: "agent_comm_request",
        resource: `agent:${target}`,
        userId: user.id,
        result: response.status === "SUCCEEDED" ? "SUCCESS" : "FAILURE",
        details: JSON.stringify({ objective, interactionId: response.interactionId }),
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error sending agent request";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
