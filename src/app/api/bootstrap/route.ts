import { NextResponse } from "next/server";

/**
 * GET /api/bootstrap — Inicializa KREA (pone el chaleco al agente)
 *
 * Este endpoint es el "interruptor" que enciende KREA.
 * Se llama al arrancar la app o cuando se necesita reinicializar.
 *
 * Es idempotente — llamarlo múltiples veces no tiene efecto negativo.
 */
export async function GET() {
  try {
    const { bootstrapKrea } = await import("@/lib/bootstrap");
    const result = await bootstrapKrea();

    return NextResponse.json({
      krea: "ARNÉS — Bootstrap",
      ...result,
      philosophy: "El agente es intercambiable. El conocimiento queda en KREA.",
    });
  } catch (error) {
    return NextResponse.json({
      krea: "ARNÉS — Bootstrap FAILED",
      status: "FAILED",
      error: String(error),
    }, { status: 500 });
  }
}
