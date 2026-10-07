import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { SkillManager } from "@/lib/skills";

const skillManager = new SkillManager();

/**
 * GET /api/adn/skills
 * List skills (no auth required for reading).
 * Query params: status, domain
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as
      | "PROPOSED" | "VALIDATING" | "ACTIVE" | "DEPRECATED" | "RETIRED"
      | undefined;

    const skills = await skillManager.list({ status });

    return NextResponse.json({ skills, total: skills.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error listing skills";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/adn/skills
 * Register a new skill (auth required).
 * Body: name, description, purpose, procedure, trigger, prerequisites, toolsRequired
 */
export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get("authorization")?.replace("Bearer ", "");
    const user = await getSessionUser(token || "");
    if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

    const body = await req.json();
    const { name, description, purpose, procedure, trigger, prerequisites, toolsRequired } = body;

    if (!name || !description || !purpose || !procedure) {
      return NextResponse.json(
        { error: "name, description, purpose, and procedure are required" },
        { status: 400 }
      );
    }

    const result = await skillManager.register({
      name,
      description,
      purpose,
      procedure,
      trigger,
      prerequisites,
      toolsRequired,
      origin: "MANUAL",
    });

    return NextResponse.json(result, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error registering skill";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
