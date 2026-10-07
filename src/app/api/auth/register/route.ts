import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SecurityManager } from "@/lib/security";
import { createSession } from "@/lib/auth";

const security = new SecurityManager();

export async function POST(req: NextRequest) {
  try {
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

    const hashedPassword = security.hashPassword(password);

    const user = await db.user.create({
      data: { name, email, password: hashedPassword, credits: 50, plan: "starter" },
    });

    const token = await createSession(user.id);

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        plan: user.plan,
      },
      token,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al registrar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
