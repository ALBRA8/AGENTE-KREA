import { NextRequest, NextResponse } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   Middleware – Security headers, CORS for API routes, Auth guard
   ═══════════════════════════════════════════════════════════════ */

/** Routes that require a valid session token */
const PROTECTED_ROUTES = ["/api/harness", "/api/bootstrap", "/api/doctor"];

/** Allowed CORS origins (comma-separated in env, fallback to same-origin) */
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

  /* ── 2. CORS – only for API routes ── */
  if (pathname.startsWith("/api/")) {
    const origin = req.headers.get("origin");
    if (origin && (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin))) {
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

  /* ── 3. Auth guard for sensitive routes ── */
  if (PROTECTED_ROUTES.some((r) => pathname.startsWith(r))) {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json(
        { error: "Autenticación requerida" },
        { status: 401 }
      );
    }
    // Token validation is handled by each route handler;
    // middleware only ensures a token is present.
  }

  return response;
}

/* ── Matcher – run on all routes except static assets ── */
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
