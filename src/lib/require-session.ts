/**
 * requireSession — guard de sesión compartido para TODOS los handlers
 * (hallazgo 1.1: el middleware solo verificaba que el header EXISTIERA;
 * `Authorization: x` pasaba. La validación real contra la BD vive aquí y se
 * usa en cada handler no público).
 *
 * Uso:
 *   const auth = await requireSession(req);
 *   if (auth.response) return auth.response;
 *   const user = auth.user; // SessionUser validado contra la BD
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type RequireSessionResult =
  | { user: SessionUser; response?: undefined }
  | { user?: undefined; response: NextResponse };

/** Token Bearer crudo del header Authorization (sin validar). */
export function bearerToken(req: NextRequest): string {
  return req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";
}

/** Valida la sesión contra la BD. Si no es válida, devuelve la respuesta 401 lista para retornar. */
export async function requireSession(req: NextRequest): Promise<RequireSessionResult> {
  const user = await getSessionUser(bearerToken(req));
  if (!user) {
    return {
      response: NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 }
      ),
    };
  }
  return { user };
}
