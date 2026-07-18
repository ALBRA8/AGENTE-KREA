import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const COST = 2;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { videoUrl, language = "es" } = await req.json();

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();

    let videoText = "";
    if (videoUrl) {
      try {
        const pageResult = await zai.functions.invoke("page_reader", { url: videoUrl });
        videoText = pageResult.data?.html
          ? pageResult.data.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().substring(0, 2000)
          : "";
      } catch {
        videoText = "";
      }
    }

    const prompt = videoText
      ? `Genera subtítulos en formato SRT para el siguiente contenido de video en ${language}. El texto del video es:\n\n${videoText}\n\nGenera los subtítulos con tiempos realistas, sincronizados y en ${language}. Formato SRT estricto.`
      : `Genera un template de subtítulos en formato SRT en ${language} para un video promocional de 60 segundos sobre marketing digital. Incluye tiempos realistas.`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en subtitulado profesional. Generas subtítulos SRT perfectamente sincronizados. Siempre respondes en el formato SRT estándar.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = response.choices[0]?.message?.content || "Sin resultados";

    await db.generation.create({
      data: {
        userId: user.id,
        type: "subtitle",
        title: videoUrl ? `Subtítulos: ${videoUrl.substring(0, 60)}` : "Subtítulos template",
        prompt: videoUrl || "Template SRT",
        result,
        credits: COST,
      },
    });

    return NextResponse.json({ srt: result, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando subtítulos";
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}