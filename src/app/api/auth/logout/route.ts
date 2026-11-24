import { NextRequest, NextResponse } from "next/server";
import { security } from "@/lib/auth";
import { requireSession, bearerToken } from "@/lib/require-session";

/**
 * POST /api/auth/logout — revoca la sesión actual (hallazgo 1.5: el "logout"
 * de la UI solo borraba localStorage; el token seguía válido en la BD).
 * Aceptación: tras logout, el token viejo devuelve 401.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSession(req);
  if (auth.response) return auth.response;

  const token = bearerToken(req);
  const revoked = await security.revokeToken(token);

  await security.auditLog({
    action: "logout",
    resource: "session",
    userId: auth.user.id,
    result: revoked ? "success" : "error",
    ip: req.headers.get("x-real-ip") || undefined,
  });

  return NextResponse.json({ success: revoked });
}
