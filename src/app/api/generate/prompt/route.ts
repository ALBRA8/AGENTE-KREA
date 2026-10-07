import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";

const COST = 2;

const CATEGORY_PROMPTS: Record<string, string> = {
  image: `Eres un experto en ingeniería de prompts para IA generativa de imágenes. Transforma pedidos simples en descripciones técnicas profesionales.

ELEMENTOS OBLIGATORIOS en cada prompt:
- **Sujeto**: Apariencia, vestimenta, pose, expresión detallada.
- **Escenario**: Ambiente, profundidad de campo, elementos de fondo.
- **Iluminación**: Tipo (natural, estudio, dramática, golden hour), dirección e intensidad.
- **Estilo Técnico**: Cámara (Sony A7R IV, Canon EOS R5), lente (85mm f/1.8), ISO, Octave Render, Unreal Engine 5.
- **Calidad**: 8k, ultra-detallado, hiper-realista, masterpiece.

REGLAS: Genera el prompt en INGLÉS. Una sola oración densa. Responde SOLO con el prompt generado.`,

  video: `Eres un experto en prompts para generación de video IA estilo Veo3. Creas prompts breves pero densos en detalles de movimiento y atmósfera.

ESTRUCTURA: Acción clara + Estilo Visual + Movimiento de Cámara (pan, tilt, dolly, tracking) + Movimiento del Sujeto + Atmósfera (colores, clima, sentimiento).

REGLAS CRÍTICAS: Videos de 5-8 segundos MÁXIMO. UNA sola escena. Si el pedido requiere múltiples escenas o diálogos extensos, RECHAZA y explica. Prompt en INGLÉS. Máximo 3-4 oraciones. Responde SOLO con el prompt.`,

  animate: `Eres un experto en prompts para animar imágenes estáticas (5-8 segundos).

Enfoque: Movimiento sutil y cinematográfico (viento, partículas, cambio de expresión, agua, humo). Mantener consistencia visual con la imagen original. Usar: "fluid motion", "cinematic transition", "subtle animation".

REGLAS: Prompt en INGLÉS. Máximo 2-3 oraciones. Movimientos sutiles NO transformaciones drásticas. Responde SOLO con el prompt.`,

  clone: `Eres un especialista en prompts para clonación de rostros con IA (estilo Gemini) con realismo extremo.

FIDELIDAD OBLIGATORIA: Cabello (color, corte, textura), Rostro (formato, proporciones, boca, nariz, ojos, cejas), Piel (tono, textura realista), Expresión (según solicitud).

TÉCNICO: 4K, hiper-realista, ultra-detallado. Iluminación: dirección (lateral, frontal), intensidad, estilo (estudio profesional, Rembrandt, butterfly).

REGLAS: Prompt en INGLÉS. Prioridad absoluta a fidelidad facial. Responde SOLO con el prompt.`,

  default: `Eres Krea, un asistente experto en creación de contenido con IA. Ayudas a crear prompts profesionales para imágenes, videos, ebooks, guiones y más.

Cuando el usuario te pida crear algo, genera un prompt profesional, detallado y listo para usar en la herramienta de IA correspondiente.

Si es para IMÁGENES: Incluye sujeto, escenario, iluminación, cámara, lente, calidad (en inglés).
Si es para VIDEOS: Describe acción, estilo visual, movimiento de cámara, atmósfera (en inglés, max 5-8s).
Si es para EBOOKS: Genera estructura completa con títulos, subtítulos e índice (en español).
Si es para GUIONES: Hook, desarrollo, CTA con indicaciones de ritmo (en español).

Responde siempre en español excepto los prompts para imágenes/videos que van en inglés.`,
};

function detectCategory(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("imagen") || lower.includes("foto") || lower.includes("creativo") || lower.includes("diseño") || lower.includes("ilustración") || lower.includes("thumbnail")) return "image";
  if (lower.includes("video") || lower.includes("veo3") || lower.includes("animación") || lower.includes("reel") || lower.includes("tiktok")) return "video";
  if (lower.includes("anima") || lower.includes("movimiento") || lower.includes("dinámic")) return "animate";
  if (lower.includes("clon") || lower.includes("rostro") || lower.includes("gemini") || lower.includes("cara") || lower.includes("retrato")) return "clone";
  return "default";
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { description, category: reqCategory } = await req.json();
  if (!description) return NextResponse.json({ error: "Descripción requerida" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok) return NextResponse.json({ error: "Créditos insuficientes" }, { status: 402 });

  try {
    const zai = await ZAI.create();
    const category = reqCategory || detectCategory(description);
    const systemPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default;

    const response = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: description },
      ],
    });

    const prompt = response.choices[0]?.message?.content || "Sin resultados";

    await db.generation.create({
      data: {
        userId: user.id,
        type: "prompt",
        title: description.substring(0, 80),
        prompt: description,
        result: prompt,
        credits: COST,
      },
    });

    return NextResponse.json({ prompt, credits: user.credits - COST });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando prompt";
    await db.user.update({ where: { id: user.id }, data: { credits: { increment: COST } } });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
