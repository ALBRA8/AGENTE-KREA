import { NextResponse } from "next/server";
import { KreaDoctorV2 } from "@/lib/doctor-v2";

/**
 * GET /api/adn/doctor
 * Runs the expanded Doctor V2 health check (no auth required — health endpoint).
 */
export async function GET() {
  try {
    const doctor = new KreaDoctorV2();
    const report = await doctor.runFullCheck();
    const statusCode =
      report.overallStatus === "HEALTHY"
        ? 200
        : report.overallStatus === "DEGRADED"
          ? 200
          : 503;
    return NextResponse.json(report, { status: statusCode });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error running health check";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
