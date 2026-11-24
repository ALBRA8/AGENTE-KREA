import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits, refundCredits } from "@/lib/auth";
import { enforceCostRateLimit, costOf } from "@/lib/credit-service";
import { db } from "@/lib/db";
import { getProvider } from "@/contracts/provider-registry";

const COST = costOf("generate:subtitle"); // hallazgo 2.7: una sola fuente de costos (credit-service)

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Hallazgo 1.6: rate limit de coste ANTES de cobrar (429 sin cobro).
  const rl = enforceCostRateLimit(user.id, "generate:subtitle");
  if (!rl.ok) return NextResponse.json({ error: rl.error }, { status: rl.status });

  const { videoUrl, language = "es" } = await req.json();

  // Hallazgo 2.8: esta ruta NO descarga ni transcribe video (no hay ASR ni
  // ingesta). Antes aceptaba videoUrl y le pedía al LLM "extraer el texto de
  // esta página de video" — imposible → SRT de plantilla por 2 créditos.
  // Ahora: videoUrl → 400 explícito, se genera SOLO desde texto.
  if (videoUrl) {
    return NextResponse.json(
      { error: "La ingestión/transcripción de video no está implementada. Genera subtítulos desde texto; videoUrl no se acepta." },
      { status: 400 }
    );
  }

  const newBalance = await deductCredits(user.id, COST); // hallazgo 2.7: saldo real tras el cobro
  if (newBalance === null) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const textProvider = getProvider("text");


    const prompt = `Genera subtítulos en formato SRT en ${language} para un video promocional de 60 segundos sobre marketing digital. Incluye tiempos realistas y duración coherente entre líneas.`;

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

    return NextResponse.json({ srt: result, credits: newBalance });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando subtítulos";
    await refundCredits(user.id, COST);
    return NextResponse.json({ success: false, error: msg, refunded: true }, { status: 500 }); // hallazgo 2.1/2.8: reembolso explícito y visible
  }
}