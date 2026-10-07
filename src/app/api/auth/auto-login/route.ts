import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SecurityManager } from "@/lib/security";
import { createSession } from "@/lib/auth";

const security = new SecurityManager();

export async function POST() {
  try {
    // Find or create demo user
    let user = await db.user.findUnique({ where: { email: "demo@p360.com" } });

    if (!user) {
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
  } catch {
    // If DB is unavailable, return fallback user (no session token — limited access)
    return NextResponse.json({
      user: {
        id: "demo-fallback",
        name: "Usuario Demo",
        email: "demo@p360.com",
        credits: 50,
        plan: "starter",
      },
      token: null,
    });
  }
}
