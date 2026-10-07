import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SecurityManager } from "@/lib/security";
import { createSession } from "@/lib/auth";

const security = new SecurityManager();

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

    const valid = security.verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    }

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
    const msg = e instanceof Error ? e.message : "Error al iniciar sesión";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
