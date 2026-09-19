import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const COST = 3;

const VALID_VOICES = ["tongtong", "xiaoyi", "zhiyan", "zhichu"];

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { text, voice = "tongtong" } = await req.json();
  if (!text) return NextResponse.json({ error: "Texto requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();
    const selectedVoice = VALID_VOICES.includes(voice) ? voice : "tongtong";

    const response = await zai.audio.tts.create({
      input: text,
      voice: selectedVoice,
    });

    // ZAI SDK TTS returns a Response object — read as arrayBuffer
    const arrayBuf = await (response as Response).arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    // Ensure generated directory exists
    const genDir = join(process.cwd(), "public", "generated");
    mkdirSync(genDir, { recursive: true });

    const filename = `${randomUUID()}.mp3`;
    const filepath = join(genDir, filename);
    writeFileSync(filepath, buffer);

    await db.generation.create({
      data: {
        userId: user.id,
        type: "voice",
        title: text.substring(0, 80),
        prompt: text,
        result: `/generated/${filename}`,
        credits: COST,
      },
    });

    return NextResponse.json({ audioUrl: `/generated/${filename}`, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando voz";
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
