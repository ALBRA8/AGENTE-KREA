import { NextResponse } from "next/server";
import { KREA_IDENTITY } from "@/contracts/identity";

/**
 * GET /api/adn/identity
 * Returns the KREA Identity Contract (public — no auth required).
 */
export async function GET() {
  try {
    return NextResponse.json(KREA_IDENTITY);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving identity contract";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
