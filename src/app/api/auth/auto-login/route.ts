import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Find or create demo user
    let user = await db.user.findUnique({ where: { email: "demo@p360.com" } });

    if (!user) {
      user = await db.user.create({
        data: {
          name: "Usuario Demo",
          email: "demo@p360.com",
          password: "demo123",
          credits: 50,
          plan: "starter",
        },
      });
    }

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      credits: user.credits,
      plan: user.plan,
    });
  } catch {
    // If DB is unavailable, return fallback user
    return NextResponse.json({
      id: "demo-fallback",
      name: "Usuario Demo",
      email: "demo@p360.com",
      credits: 50,
      plan: "starter",
    });
  }
}