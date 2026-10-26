import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/batch
 * Execute a batch of creative generation jobs in parallel.
 *
 * Body: { items: Array<{ type, params }>, concurrency? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { items, concurrency } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing or invalid: items (must be a non-empty array)" }, { status: 400 });
    }

    const { executeBatch } = await import("@/lib/commercial/batch-pipeline");
    const result = await executeBatch(items, concurrency ?? 3);

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error executing batch";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
