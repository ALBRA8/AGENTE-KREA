import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST() {
  try {
    // Ensure DB and tables exist
    try {
      await db.$executeRawUnsafe("SELECT 1 FROM User LIMIT 1");
    } catch {
      // Tables don't exist yet, try to create them
      try {
        const { execSync } = require("child_process");
        execSync("npx prisma db push --skip-generate --accept-data-loss 2>/dev/null", {
          cwd: process.cwd(),
          timeout: 15000,
        });
      } catch {}
    }

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
  } catch (e: unknown) {
    // If DB is completely unavailable, return a fake demo user
    // The app will work in limited mode (no persistence)
    return NextResponse.json({
      id: "demo-fallback",
      name: "Usuario Demo",
      email: "demo@p360.com",
      credits: 50,
      plan: "starter",
    });
  }
}