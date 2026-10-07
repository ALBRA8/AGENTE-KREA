import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, deductCredits } from "@/lib/auth";
import { db } from "@/lib/db";
import ZAI from "z-ai-web-dev-sdk";
import {
  generatePdf,
  defaultPdfConfig,
  type PdfChapter,
  type PdfConfig,
} from "@/lib/pdf-factory";
import path from "path";
import fs from "fs/promises";

const COST = 8;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const user = await getSessionUser(token || "");
  if (!user)
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { topic, chapters = 5, targetAudience = "general" } = await req.json();
  if (!topic)
    return NextResponse.json({ error: "Tema requerido" }, { status: 400 });

  const ok = await deductCredits(user.id, COST);
  if (!ok)
    return NextResponse.json(
      { error: "Créditos insuficientes" },
      { status: 402 }
    );

  try {
    // Step 1: Generate content with ZAI
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

    const markdown = response.choices[0]?.message?.content || "";
    if (!markdown) {
      await db.user.update({
        where: { id: user.id },
        data: { credits: { increment: COST } },
      });
      return NextResponse.json(
        { error: "No se pudo generar contenido" },
        { status: 500 }
      );
    }

    // Step 2: Parse markdown into chapters
    const pdfChapters = parseMarkdownToChapters(markdown);

    // Step 3: Extract title
    const titleMatch = markdown.match(/^#\s+(.+)$/m);
    const bookTitle = titleMatch ? titleMatch[1] : topic;

    // Step 4: Generate real PDF
    const outputDir =
      process.env.KREA_PDF_OUTPUT_DIR || path.join(process.cwd(), "download");
    await fs.mkdir(outputDir, { recursive: true });

    const config: PdfConfig = {
      ...defaultPdfConfig(bookTitle, user.name || "KREA"),
      subject: topic,
    };

    const pdfResult = await generatePdf(
      config,
      pdfChapters,
      undefined,
      outputDir
    );

    if (!pdfResult.success || !pdfResult.filePath) {
      await db.user.update({
        where: { id: user.id },
        data: { credits: { increment: COST } },
      });
      return NextResponse.json(
        { error: "Error generando PDF" },
        { status: 500 }
      );
    }

    // Step 5: Save to Generation table with file path
    await db.generation.create({
      data: {
        userId: user.id,
        type: "ebook",
        title: bookTitle.substring(0, 80),
        prompt: topic,
        result: pdfResult.filePath, // Store the REAL file path
        credits: COST,
      },
    });

    // Step 6: Return with real metadata
    return NextResponse.json({
      content: markdown, // Still return markdown for preview
      pdfPath: pdfResult.filePath,
      pdfFileName: pdfResult.fileName,
      fileSize: pdfResult.fileSize,
      pageCount: pdfResult.pageCount,
      metadata: pdfResult.metadata,
      evidence: pdfResult.evidence,
      credits: user.credits - COST,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error generando eBook";
    await db.user.update({
      where: { id: user.id },
      data: { credits: { increment: COST } },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Parse markdown text into PdfChapter array.
 */
function parseMarkdownToChapters(markdown: string): PdfChapter[] {
  const chapters: PdfChapter[] = [];
  const lines = markdown.split("\n");
  let currentTitle = "Introducción";
  let currentContent: string[] = [];

  for (const line of lines) {
    // Chapter headers (## or ###)
    const chapterMatch = line.match(/^#{2,3}\s+(.+)$/);
    if (chapterMatch) {
      // Save previous chapter
      if (currentContent.length > 0) {
        chapters.push({
          title: currentTitle,
          content: currentContent.join("\n").trim(),
        });
      }
      currentTitle = chapterMatch[1];
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last chapter
  if (currentContent.length > 0) {
    chapters.push({
      title: currentTitle,
      content: currentContent.join("\n").trim(),
    });
  }

  // If no chapters parsed, put everything in one chapter
  if (chapters.length === 0) {
    chapters.push({
      title: "Contenido",
      content: markdown,
    });
  }

  return chapters;
}
