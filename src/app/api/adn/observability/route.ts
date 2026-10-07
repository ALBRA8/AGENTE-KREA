import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ObservabilityManager } from "@/lib/observability";

const observabilityManager = new ObservabilityManager();

/**
 * GET /api/adn/observability
 * Get metrics/dashboard data (auth required).
 * Query param: range=1h|24h|7d|30d
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "24h";

    // Parse time range
    const now = new Date();
    let start: Date;
    switch (range) {
      case "1h":
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case "7d":
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "24h":
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
    }

    const [metrics, dashboard] = await Promise.all([
      observabilityManager.getMetrics({ start, end: now }),
      observabilityManager.getDashboard(),
    ]);

    return NextResponse.json({
      range,
      from: start.toISOString(),
      to: now.toISOString(),
      metrics,
      dashboard,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error retrieving observability data";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
