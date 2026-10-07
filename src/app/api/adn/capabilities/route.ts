import { NextResponse } from "next/server";
import { createKreaRegistry } from "@/contracts/capability";

/**
 * GET /api/adn/capabilities
 * Returns all KREA capabilities (public — no auth required).
 */
export async function GET() {
  try {
    const registry = createKreaRegistry();
    const capabilities = registry.getAll();
    const stats = registry.getStats();
    return NextResponse.json({
      capabilities,
      stats,
      total: capabilities.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving capabilities";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
