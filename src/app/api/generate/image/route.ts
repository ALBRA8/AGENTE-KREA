import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { writeFileSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const COST = 3;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { prompt, style } = await req.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();
    const fullPrompt = style
      ? `${prompt}, ${style}, professional quality, high resolution, detailed`
      : `${prompt}, professional quality, high resolution, detailed`;

    const response = await zai.images.generations.create({
      prompt: fullPrompt,
      size: "1024x1024",
    });

    const base64 = response.data[0].base64;
    const filename = `${randomUUID()}.png`;
    const filepath = join(process.cwd(), "public", "generated", filename);
    writeFileSync(filepath, Buffer.from(base64, "base64"));

    await db.generation.create({
      data: {
        userId: user.id,
        type: "image",
        title: prompt.substring(0, 80),
        prompt,
        result: `/generated/${filename}`,
        credits: COST,
      },
    });

    return NextResponse.json({ imageUrl: `/generated/${filename}`, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando imagen";
    // Refund credits on error
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}