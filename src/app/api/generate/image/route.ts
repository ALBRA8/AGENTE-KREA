import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits, refundCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import { getProvider } from "@/contracts/provider-registry";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";

const COST = 3;

// ZAI SDK requires size between 512-2880 and multiple of 32
const VALID_SIZES = ["512x512", "768x768", "1024x1024", "1024x1536", "1536x1024"] as const;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { prompt, style, size = "1024x1024" } = await req.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const fullPrompt = style
      ? `${prompt}, ${style}, professional quality, high resolution, detailed`
      : `${prompt}, professional quality, high resolution, detailed`;

    // Validate size: must be 512-2880 and multiple of 32
    const selectedSize = VALID_SIZES.includes(size as any) ? size : "1024x1024";

    const response = await getProvider("image").generate({
      prompt: fullPrompt,
      size: selectedSize,
    });
    if (!response.success) throw new Error(response.error || "Proveedor de imagen falló");

    // Provider returns { data: { base64, size } }
    const base64 = ((response.data as { base64?: string })?.base64) || "";
    if (!base64) throw new Error("No se recibió imagen de la API");

    // Ensure generated directory exists
    const genDir = join(process.cwd(), "public", "generated");
    mkdirSync(genDir, { recursive: true });

    const filename = `${randomUUID()}.png`;
    const filepath = join(genDir, filename);
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
    await refundCredits(user.id, COST);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
