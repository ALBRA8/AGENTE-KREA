import { NextResponse } from "next/server";
import { KREA_MISSION } from "@/contracts/mission";

/**
 * GET /api/adn/mission
 * Returns the KREA Mission Contract (public — no auth required).
 */
export async function GET() {
  try {
    return NextResponse.json(KREA_MISSION);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving mission contract";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
