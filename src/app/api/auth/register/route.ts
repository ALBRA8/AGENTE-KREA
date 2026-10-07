import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { security } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const rl = security.rateLimit(`register:${ip}`, 5, 60 * 1000); // 5 registrations per minute per IP
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos de registro. Intenta de nuevo más tarde." },
        { status: 429 }
      );
    }

    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Todos los campos son requeridos" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Este email ya está registrado" }, { status: 409 });
    }

    // Hash password before storing
    const hashedPassword = security.hashPassword(password);

    const user = await db.user.create({
      data: { name, email, password: hashedPassword, credits: 50, plan: "starter" },
    });

    // Generate session token
    const token = await security.generateToken(user.id);

    // Audit log
    await security.auditLog({
      action: "register",
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
    const msg = e instanceof Error ? e.message : "Error al registrar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
