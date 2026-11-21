import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  CREATED: { ready: "READY" },
  READY: { send: "SENT" },
  SENT: { acknowledge: "ACKNOWLEDGED" },
  ACKNOWLEDGED: { complete: "COMPLETED" },
};

/**
 * POST /api/product/handoff/[id]
 * Perform an action on a handoff (ready, send, acknowledge, complete).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "") || "";
  const user = await getSessionUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const handoff = await db.handoff.findUnique({
      where: { id },
      include: { dossier: { select: { userId: true } } },
    });

    if (!handoff || handoff.dossier.userId !== user.id) {
      return NextResponse.json({ error: "Handoff not found" }, { status: 404 });
    }

    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }

    const transitions = VALID_TRANSITIONS[handoff.status];
    if (!transitions || !transitions[action]) {
      return NextResponse.json(
        { error: `Invalid action "${action}" for status "${handoff.status}"` },
        { status: 400 }
      );
    }

    const updated = await db.handoff.update({
      where: { id },
      data: { status: transitions[action] },
    });

    return NextResponse.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error updating handoff";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
