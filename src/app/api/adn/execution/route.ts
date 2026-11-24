import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ExecutionTracer } from "@/lib/execution";

const executionTracer = new ExecutionTracer();

/**
 * GET /api/adn/execution
 * List executions (auth required).
 * Query params: status, limit, userId
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as
      | "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED"
      | undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;
    // Hallazgo 1.2: el parámetro ?userId= lo ponía el cliente y sin él listaba
    // TODO. Se IGNORA el parámetro y se usa SIEMPRE la sesión real.
    const userId = user.id;

    const executions = await executionTracer.list({
      status,
      limit,
      userId,
    });

    return NextResponse.json({ executions, total: executions.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing executions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
