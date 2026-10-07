import { NextResponse } from "next/server";
import { createKreaToolRegistry } from "@/contracts/tool";

/**
 * GET /api/adn/tools
 * Returns all KREA tools (public — no auth required).
 */
export async function GET() {
  try {
    const registry = createKreaToolRegistry();
    const tools = registry.getAll();
    return NextResponse.json({
      tools,
      total: tools.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving tools";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
