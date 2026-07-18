import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const COST = 8;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { topic, chapters = 5, targetAudience = "general" } = await req.json();
  if (!topic) return NextResponse.json({ error: "Tema requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();
    const prompt = `Genera un eBook completo en español sobre "${topic}" para ${targetAudience}.
Debe tener exactamente ${chapters} capítulos.

FORMATO DE RESPUESTA (sigue este formato exactamente):

# TÍTULO DEL EBOOK
## Subtítulo atractivo

## Capítulo 1: [Nombre del capítulo]
[Contenido completo del capítulo con al menos 3 párrafos sustanciales]

## Capítulo 2: [Nombre del capítulo]
[Contenido completo del capítulo]

... (continúa para todos los capítulos)

## Conclusión
[Resumen y llamada a la acción final]

Genera contenido de alta calidad, profesional y útil. Cada capítulo debe tener información valiosa y actionable.`;

    const response = await zai.chat.completions.create({
      messages: [
        {
          role: "system",
          content:
            "Eres un escritor profesional de eBooks. Generas contenido completo, bien estructurado, con información valuable y formato limpio en markdown. Escribes siempre en español.",
        },
        { role: "user", content: prompt },
      ],
    });

    const result = response.choices[0]?.message?.content || "Sin resultados";

    await db.generation.create({
      data: {
        userId: user.id,
        type: "ebook",
        title: topic.substring(0, 80),
        prompt: topic,
        result,
        credits: COST,
      },
    });

    return NextResponse.json({ content: result, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando eBook";
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}