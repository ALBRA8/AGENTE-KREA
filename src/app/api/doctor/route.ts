import { NextRequest, NextResponse } from "next/server";
import { KreaDoctor } from "@/lib/doctor";
import { requireSession } from "@/lib/require-session";

export async function GET(req: NextRequest) {
  // Hallazgo 1.1: el doctor expone la configuración interna (rutas, credenciales
  // implícitas, versión) — sesión real. La lista pública queda en /api/health.
  const auth = await requireSession(req);
  if (auth.response) return auth.response;
  const doctor = new KreaDoctor();
  const report = await doctor.runFullCheck();
  const statusCode = report.overallStatus === "HEALTHY" ? 200 : report.overallStatus === "DEGRADED" ? 200 : 503;
  return NextResponse.json(report, { status: statusCode });
}
