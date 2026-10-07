import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { MemoryManager } from "@/lib/memory";

const memoryManager = new MemoryManager();

/**
 * GET /api/adn/memory
 * Recall memories (no auth required for reading).
 * Query params: domain, type, limit
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get("domain") || undefined;
    const type = searchParams.get("type") as "EPISODIC" | "SEMANTIC" | "FACTUAL" | "PROCEDURAL" | undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 20;

    const memories = await memoryManager.recall(
      { domain, type },
      { limit }
    );

    return NextResponse.json({ memories, total: memories.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error recalling memories";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/memory
 * Store a new memory (auth required).
 * Body: domain, type, content, source, sourceType
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { domain, type, content, source, sourceType } = body;

    if (!domain || !type || !content) {
      return NextResponse.json(
        { error: "domain, type, and content are required" },
        { status: 400 }
      );
    }

    const result = await memoryManager.store("krea", domain, type, content, {
      userId: user.id,
      source: source || "api",
      sourceType: sourceType || "USER",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error storing memory";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/adn/memory
 * Invalidate a memory (auth required).
 * Body: id, reason
 */
export async function DELETE(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { id, reason } = body;

    if (!id) {
      return NextResponse.json({ error: "Memory id is required" }, { status: 400 });
    }

    await memoryManager.invalidate(id, reason || "Invalidated via API");

    return NextResponse.json({ success: true, id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error invalidating memory";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
