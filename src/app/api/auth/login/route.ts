import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { security } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = security.rateLimit(`login:${ip}`, 10, 60 * 1000); // 10 login attempts per minute per IP
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de login. Intenta de nuevo más tarde." },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      // Audit log failed login (unknown user)
      await security.auditLog({
        action: "login",
        resource: "user",
        result: "denied",
        details: { email, reason: "user_not_found" },
        ip,
      });
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    // Verify password using SecurityManager (supports both hashed and legacy plaintext)
    const valid = security.verifyPassword(password, user.password);
    if (!valid) {
      // Audit log failed login (wrong password)
      await security.auditLog({
        action: "login",
        resource: "user",
        userId: user.id,
        result: "denied",
        details: { reason: "invalid_password" },
        ip,
      });
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    // Generate session token
    const token = await security.generateToken(user.id);

    // Audit log successful login
    await security.auditLog({
      action: "login",
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al iniciar sesión";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
