import { NextResponse } from "next/server";
import { KreaDoctor } from "@/lib/doctor";

export async function GET() {
  const doctor = new KreaDoctor();
  const report = await doctor.runFullCheck();
  const statusCode = report.overallStatus === "HEALTHY" ? 200 : report.overallStatus === "DEGRADED" ? 200 : 503;
  return NextResponse.json(report, { status: statusCode });
}
