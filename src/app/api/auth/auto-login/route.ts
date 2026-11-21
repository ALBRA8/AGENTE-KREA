import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { security } from "@/lib/auth";
import { getClientIp } from "@/lib/client-ip";

/**
 * POST /api/auth/auto-login
 *
 * Frictionless demo entry — GATED behind DEMO_MODE=true (default: false).
 * Disabled by default in every environment, including development.
 *
 * When enabled:
 *  - The demo user is created ONCE with 50 credits and never recreated/reset.
 *  - Its password is a random value generated at server start and NEVER used
 *    for login (auto-login issues a session token directly); it only exists
 *    because the User model requires it. It is not logged or exposed.
 *  - If the database is unavailable → 503 (no fake users).
 */
// Ephemeral random password — unknowable, never printed, never used for login.
const EPHEMERAL_DEMO_PASSWORD = crypto.randomBytes(32).toString("hex");

export async function POST(req: NextRequest) {
  // Hard gate: opt-in only. Default OFF everywhere (dev, preview, production).
  if (process.env.DEMO_MODE !== "true") {
    return NextResponse.json(
      { error: "Auto-login deshabilitado. Configura DEMO_MODE=true para habilitarlo." },
      { status: 403 }
    );
  }

  try {
    // Rate limit by client IP
    const ip = getClientIp(req);
    const rl = security.rateLimit(`autologin:${ip}`, 10, 60 * 1000); // 10 per minute per IP
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo más tarde." },
        { status: 429 }
      );
    }

    // Find or create demo user — creation happens exactly once, credits are
    // never reset by subsequent calls (no infinite-credit loophole).
    let user = await db.user.findUnique({ where: { email: "demo@p360.com" } });

    if (!user) {
      user = await db.user.create({
        data: {
          name: "Usuario Demo",
          email: "demo@p360.com",
          password: security.hashPassword(EPHEMERAL_DEMO_PASSWORD),
          credits: 50,
          plan: "starter",
        },
      });
    }

    // Generate session token
    const token = await security.generateToken(user.id);

    // Audit log
    await security.auditLog({
      action: "auto_login",
      resource: "user",
      userId: user.id,
      result: "success",
      ip,
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        plan: user.plan,
      },
    });
  } catch {
    // DB unavailable – return 503 Service Unavailable (no fake user)
    return NextResponse.json(
      { error: "Servicio no disponible. Inténtalo de nuevo más tarde." },
      { status: 503 }
    );
  }
}

