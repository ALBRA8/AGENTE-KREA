import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { security } from "@/lib/auth";

/** Demo password – must be set via env in production */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "demo123";

export async function POST(req: NextRequest) {
  // Block auto-login in production unless DEMO_PASSWORD is explicitly configured
  if (process.env.NODE_ENV === "production" && !process.env.DEMO_PASSWORD) {
    return NextResponse.json(
      { error: "Auto-login deshabilitado en producción sin DEMO_PASSWORD configurado" },
      { status: 403 }
    );
  }

  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = security.rateLimit(`autologin:${ip}`, 10, 60 * 1000); // 10 per minute per IP
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo más tarde." },
        { status: 429 }
      );
    }

    // Find or create demo user
    let user = await db.user.findUnique({ where: { email: "demo@p360.com" } });

    if (!user) {
      // Hash the demo password before storing
      const hashedPassword = security.hashPassword(DEMO_PASSWORD);
      user = await db.user.create({
        data: {
          name: "Usuario Demo",
          email: "demo@p360.com",
          password: hashedPassword,
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
