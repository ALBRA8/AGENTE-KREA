import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/commercial/templates
 * List available templates, optionally filtered by category or type.
 *
 * Query params: ?category=beauty&type=ad&q=search
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") as string | null;
    const type = url.searchParams.get("type") as string | null;
    const query = url.searchParams.get("q") as string | null;

    const mod = await import("@/lib/commercial/template-gallery");

    let templates;

    if (query) {
      templates = mod.searchTemplates(query);
    } else if (category) {
      templates = mod.getTemplatesByCategory(category as any);
    } else if (type) {
      templates = mod.getTemplatesByType(type as any);
    } else {
      templates = mod.getTemplateGallery();
    }

    return NextResponse.json({ success: true, data: templates, total: templates.length });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error fetching templates";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
