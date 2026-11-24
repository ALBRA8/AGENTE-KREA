import { NextRequest, NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   Middleware – Security headers + CORS.

   Hallazgo 1.1: el middleware PRETENDÍA autenticar (solo verificaba que el
   header Authorization EXISTIERA — `Authorization: x` pasaba). La validación
   real de sesión vive en cada handler vía `requireSession()` (@/lib/
   require-session). El middleware NO autentica: solo cabeceras.

   Hallazgo 1.3: con CORS_ORIGINS vacío se REFLEJABA cualquier Origin
   (cors libre). Ahora: sin allowlist explícita, se DENIEGA el CORS
   cross-origin (mismo comportamiento que .env.example documenta).
   ═══════════════════════════════════════════════════════════════ */

/** Allowed CORS origins (comma-separated in env). EMPTY = deny cross-origin. */
const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ?? ""
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/* ── Main middleware ── */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const response = NextResponse.next();

  /* ── 1. Security headers (all responses) ── */
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  /* ── 2. CORS – only for API routes; deny-by-default ── */
  if (pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      response.headers.set("Access-Control-Allow-Origin", origin);
      response.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
      response.headers.set("Access-Control-Max-Age", "86400");
    }

    // Handle preflight
    if (req.method === "OPTIONS") {
      return new NextResponse(null, { status: 204, headers: response.headers });
    }
  }

  return response;
}

/* ── Matcher – run on all routes except static assets ── */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
