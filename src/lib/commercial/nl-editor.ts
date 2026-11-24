/**
 * KREA Commercial — Natural Language Editor
 *
 * Permite editar creativos existentes con instrucciones en
 * lenguaje natural: "haz el fondo más oscuro", "cambia el CTA a rojo",
 * "agrega un badge de descuento del 30%".
 *
 * Inspirado por ecom-magic.ai: Natural Language Editing.
 */

import { getProvider } from "@/contracts/provider-registry";
import type { NLEditParams, NLEditResult, Language } from "./types";
import { LANG_STRINGS } from "../commercial-creative-engine";

// ─── NL Edit Prompt Builder ────────────────────────────────────────

function buildEditPrompt(originalImage: string, editInstruction: string, language: Language): string {
  const ls = LANG_STRINGS[language];

  const promptParts: string[] = [];

  promptParts.push("You are a professional creative editor. Apply the following edit to this image:");
  promptParts.push(`Edit instruction: "${editInstruction}"`);
  promptParts.push(
    "Preserve the overall composition and style. Apply only the requested changes. Maintain commercial quality."
  );
  promptParts.push(ls.langInstruction);
  promptParts.push("High quality, production-ready, no watermarks.");

  return promptParts.join(" ");
}

// ─── Natural Language Editing ──────────────────────────────────────

export async function editCreativeWithNL(params: NLEditParams): Promise<NLEditResult> {
  const { originalImage, editInstruction, language = "es" } = params;

  const prompt = buildEditPrompt(originalImage, editInstruction, language);

  try {
    // Use image-edit capability via the unified provider layer
    const editResult = await getProvider("image-edit").generate({
      image: originalImage,
      prompt,
    });

    const imageData = (editResult.data as { base64?: string; url?: string }) ?? undefined;

    // Hallazgo 2.1/2.2: edición sin imagen → pasar al fallback con error real.
    if (!editResult.success || (!imageData?.base64 && !imageData?.url)) {
      throw new Error(editResult.error || "La edición no produjo imagen");
    }

    return {
      success: true,
      imageBase64: imageData?.base64 ?? undefined,
      imageUrl: imageData?.url ?? undefined,
      editInstruction,
      prompt,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    // Fallback: generate a new image with the edit instruction as part of the prompt
    try {
      const fallbackPrompt = `Based on the instruction "${editInstruction}", create a revised version. ${prompt}`;
      const genResult = await getProvider("image").generate({
        prompt: fallbackPrompt,
        size: "1024x1024",
      });
      const genData = (genResult.data as { base64?: string; url?: string }) ?? undefined;

      // Hallazgo 2.1/2.2: el fallback sin imagen = fallo total (reembolso).
      if (!genResult.success || (!genData?.base64 && !genData?.url)) {
        return {
          success: false,
          editInstruction,
          prompt,
          generatedAt: new Date().toISOString(),
        };
      }

      return {
        success: true,
        imageBase64: genData?.base64 ?? undefined,
        imageUrl: genData?.url ?? undefined,
        editInstruction,
        prompt: fallbackPrompt,
        generatedAt: new Date().toISOString(),
      };
    } catch {
      return {
        success: false,
        editInstruction,
        prompt,
        generatedAt: new Date().toISOString(),
      };
    }
  }
}
