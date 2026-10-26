import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/commercial/edit
 * Edit an existing creative using natural language instructions.
 *
 * Body: { originalImage, editInstruction, language? }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { originalImage, editInstruction, language } = body;

    if (!originalImage) {
      return NextResponse.json({ error: "Missing required field: originalImage" }, { status: 400 });
    }
    if (!editInstruction) {
      return NextResponse.json({ error: "Missing required field: editInstruction" }, { status: 400 });
    }

    const { editCreativeWithNL } = await import("@/lib/commercial/nl-editor");
    const result = await editCreativeWithNL({
      originalImage,
      editInstruction,
      language: language ?? "es",
    });

    return NextResponse.json({ success: true, data: result });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error editing creative";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
