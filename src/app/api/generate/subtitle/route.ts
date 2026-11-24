import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits, refundCredits } from "@/lib/auth";
import { enforceCostRateLimit } from "@/lib/credit-service";
import { db } from "@/lib/db";
import { getProvider } from "@/contracts/provider-registry";

const COST = 2;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Hallazgo 1.6: rate limit de coste ANTES de cobrar (429 sin cobro).
  const rl = enforceCostRateLimit(user.id, "generate:subtitle");
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const { videoUrl, language = "es" } = await req.json();

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const textProvider = getProvider("text");

    let videoText = "";
    if (videoUrl) {
      try {
        // page_reader vive en el SDK de funciones; el texto de la página se
        // convierte en input para el proveedor de texto.
        const pageResult = await textProvider.generate({
          messages: [
            { role: "user", content: `Extrae el texto principal de esta página de video y devuélvelo en texto plano: ${videoUrl}` },
          ],
        });
        videoText = ((pageResult.data as { content?: string })?.content ?? "").substring(0, 2000);
      } catch {
        videoText = "";
      }
    }

    const prompt = videoText
      ? `Genera subtítulos en formato SRT para el siguiente contenido de video en ${language}. El texto del video es:\n\n${videoText}\n\nGenera los subtítulos con tiempos realistas, sincronizados y en ${language}. Formato SRT estricto.`
      : `Genera un template de subtítulos en formato SRT en ${language} para un video promocional de 60 segundos sobre marketing digital. Incluye tiempos realistas.`;

    const response = await textProvider.generate({
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en subtitulado profesional. Generas subtítulos SRT perfectamente sincronizados. Siempre respondes en el formato SRT estándar.",
        },
        { role: "user", content: prompt },
      ],
    });
    if (!response.success) throw new Error(response.error || "Proveedor de texto falló");

    const result = ((response.data as { content?: string })?.content) || "Sin resultados";

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
    await refundCredits(user.id, COST);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}