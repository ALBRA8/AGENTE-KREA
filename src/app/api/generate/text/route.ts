import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const COST = 2;

const SYSTEM_PROMPTS: Record<string, string> = {
  copy: `Eres un experto copywriter especializado en marketing digital y conversión. Genera textos persuasivos, titulares que captan atención y descripciones que venden. Responde siempre en español. Formato limpio y listo para usar.`,

  social: `Eres un experto en contenido para redes sociales (Instagram, TikTok, Facebook, X). Genera posts, captions, hooks y CTAs que generan engagement viral. Responde siempre en español. Incluye emojis apropiados.`,

  email: `Eres un experto en email marketing. Genera asuntos de email, secuencias de nurturing, emails de venta y newsletters que abren y convierten. Responde siempre en español.`,

  script: `Eres un experto en guiones para videos (YouTube, TikTok, reels, ads). Genera scripts con hook, desarrollo y CTA. Incluye indicaciones de ritmo y tono. Responde siempre en español.`,

  subtitle: `Eres un experto en subtitulado y traducción de videos. Genera subtítulos precisos, con tiempos y formato SRT. Responde siempre en español.`,
};

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { prompt, type = "copy" } = await req.json();
  if (!prompt) return NextResponse.json({ error: "Prompt requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();
    const systemPrompt = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.copy;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    const result = response.choices[0]?.message?.content || "Sin resultados";

    await db.generation.create({
      data: {
        userId: user.id,
        type: "text",
        title: prompt.substring(0, 80),
        prompt,
        result,
        credits: COST,
      },
    });

    return NextResponse.json({ text: result, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando texto";
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}