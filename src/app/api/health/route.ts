import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export async function GET() {
  try {
    await db.user.count({ take: 1 });
    return NextResponse.json({ status: "ok", db: true, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: false, timestamp: new Date().toISOString() }, { status: 503 });
  }
}
