import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { security } from "@/lib/auth";

export async function POST(req: NextRequest) {
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
      const hashedPassword = security.hashPassword("demo123");
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
    // If DB is unavailable, return fallback user (no session token in fallback)
    return NextResponse.json({
      token: null,
      user: {
        id: "demo-fallback",
        name: "Usuario Demo",
        email: "demo@p360.com",
        credits: 50,
        plan: "starter",
      },
    });
  }
}
